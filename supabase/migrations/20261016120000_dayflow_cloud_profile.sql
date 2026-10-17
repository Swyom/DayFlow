-- DayFlow cloud storage: mandatory profiles and private `avatars` storage bucket.
--
-- Privacy & Architecture:
-- Activity data (daily step counts, screen-time summaries, and per-app usage) is
-- strictly stored locally on the user's device (AsyncStorage + native Android modules)
-- for maximum privacy, zero remote database bloat, and offline availability.
-- No activity data is ever uploaded, synced, or stored in Supabase.
--
-- Identity: each device signs in as an anonymous Supabase Auth user (Auth → Sign In /
-- Providers → "Allow anonymous sign-ins" must be ON). Every profile row is owned by auth.uid()
-- (keyed 1:1) and Row Level Security limits public.profiles and the avatars bucket to the owner.
-- Safe to re-run: objects are created only if missing and policies are replaced.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Drop retired activity tables (activity data is strictly kept on-device)
-- ---------------------------------------------------------------------------

drop table if exists public.app_usage cascade;
drop table if exists public.daily_steps cascade;
drop table if exists public.screen_time_summaries cascade;

-- ---------------------------------------------------------------------------
-- profiles: one row per user (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text not null check (char_length(btrim(full_name)) between 2 and 60),
  email            text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  mobile           text not null check (mobile ~ '^\+?[0-9]{7,15}$'),
  age              smallint not null check (age between 13 and 120),
  -- Only the city/region label is stored. Detected locations are reverse-geocoded on the
  -- device and the GPS coordinates are discarded (data minimisation).
  location_label   text not null check (char_length(btrim(location_label)) between 2 and 120),
  location_source  text not null check (location_source in ('gps', 'manual')),
  avatar_path      text check (avatar_path is null or avatar_path like id::text || '/%'),
  step_goal        integer not null default 8000 check (step_goal between 500 and 100000),
  -- When the profile was first created on the device. Never changes after insert.
  registered_at    timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Databases created by earlier versions stored GPS coordinates: remove them for good.
alter table public.profiles drop constraint if exists profiles_gps_has_coordinates;
alter table public.profiles drop column if exists latitude;
alter table public.profiles drop column if exists longitude;

comment on table public.profiles is 'DayFlow mandatory user profile (one per auth user, strictly validated).';
comment on column public.profiles.avatar_path is 'Object path in the private avatars bucket: <user id>/<file>.';

-- ---------------------------------------------------------------------------
-- Emails are unique across profiles (case-insensitive). Names are NOT unique: many people
-- share a name. Older duplicate emails are removed first, keeping the most recent row.
-- ---------------------------------------------------------------------------

delete from public.profiles
where id in (
  select id from (
    select id,
           row_number() over (
             partition by lower(email)
             order by updated_at desc, created_at desc
           ) as rn
    from public.profiles
  ) t
  where t.rn > 1
);

create unique index if not exists profiles_email_unique on public.profiles (lower(email));
drop index if exists public.profiles_full_name_unique;

-- registered_at comes from the device (the profile may be created offline) but can't be in
-- the future; registered_at and created_at are write-once after insert.
create or replace function public.profiles_check_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.registered_at is null or new.registered_at > now() then
    new.registered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_registration on public.profiles;
create trigger profiles_check_registration
  before insert on public.profiles
  for each row execute function public.profiles_check_registration();

create or replace function public.profiles_keep_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.registered_at := old.registered_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists profiles_keep_registration on public.profiles;
create trigger profiles_keep_registration
  before update on public.profiles
  for each row execute function public.profiles_keep_registration();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owners only. No policies for the `anon` role at all.
-- (select auth.uid()) is evaluated once per statement instead of once per row.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- profiles
drop policy if exists "profiles: owner can read" on public.profiles;
create policy "profiles: owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles: owner can insert" on public.profiles;
create policy "profiles: owner can insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "profiles: owner can delete" on public.profiles;
create policy "profiles: owner can delete" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- Table privileges: signed-in users only (RLS still applies); nothing for `anon`.
revoke all on public.profiles from anon;
grant select, insert, update, delete
  on public.profiles
  to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion: lets a user delete their own auth user (cascades to all rows).
-- SECURITY DEFINER is required to touch auth.users; it only ever deletes auth.uid().
-- The app removes the user's avatar files through the Storage API before calling this.
-- ---------------------------------------------------------------------------

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;

-- ---------------------------------------------------------------------------
-- check_profile_conflicts: is this email already used by another profile?
-- Returns json { name_taken: false, email_taken } (name_taken is kept for older app
-- versions and is always false: names are not unique). Signed-in users only.
-- ---------------------------------------------------------------------------

create or replace function public.check_profile_conflicts(
  check_name text,
  check_email text,
  exclude_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(coalesce(check_email, '')));
  has_email boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if clean_email <> '' then
    select exists (
      select 1 from public.profiles
      where lower(email) = clean_email
        and (exclude_user_id is null or id <> exclude_user_id)
    ) into has_email;
  end if;
  return jsonb_build_object('name_taken', false, 'email_taken', has_email);
end;
$$;

revoke all on function public.check_profile_conflicts(text, text, uuid) from public, anon;
grant execute on function public.check_profile_conflicts(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private `avatars` bucket. Objects live under "<user id>/...".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: owner can read" on storage.objects;
create policy "avatars: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: owner can upload" on storage.objects;
create policy "avatars: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: owner can update" on storage.objects;
create policy "avatars: owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: owner can delete" on storage.objects;
create policy "avatars: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
