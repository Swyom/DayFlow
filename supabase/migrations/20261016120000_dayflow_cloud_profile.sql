-- DayFlow cloud backup: profiles, daily steps, screen-time summaries, per-app usage,
-- and the private `avatars` storage bucket.
--
-- Identity: each device signs in as an anonymous Supabase Auth user (Auth → Sign In /
-- Providers → "Allow anonymous sign-ins" must be ON). Every row is owned by auth.uid()
-- and Row Level Security limits every table and the bucket to the owner's own rows.
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
-- profiles: one row per user (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text not null check (char_length(btrim(full_name)) between 2 and 60),
  email            text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  mobile           text not null check (mobile ~ '^\+?[0-9]{7,15}$'),
  age              smallint not null check (age between 13 and 120),
  location_label   text not null check (char_length(btrim(location_label)) between 2 and 120),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  location_source  text not null check (location_source in ('gps', 'manual')),
  avatar_path      text check (avatar_path is null or avatar_path like id::text || '/%'),
  step_goal        integer not null default 8000 check (step_goal between 500 and 100000),
  -- When the profile was first created on the device. Never changes after insert.
  registered_at    timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint profiles_gps_has_coordinates check (
    location_source = 'manual' or (latitude is not null and longitude is not null)
  )
);

comment on table public.profiles is 'DayFlow user profile (one per anonymous auth user).';
comment on column public.profiles.avatar_path is 'Object path in the private avatars bucket: <user id>/<file>.';

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
-- daily_steps: one row per user per local calendar day
-- ---------------------------------------------------------------------------

create table if not exists public.daily_steps (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  steps       integer not null default 0 check (steps between 0 and 200000),
  -- Step goal in effect for that day, so history keeps its original target.
  goal        integer not null check (goal between 500 and 100000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

comment on table public.daily_steps is 'Steps counted on the device per local calendar day.';

-- The primary key (user_id, day) also serves "latest days for a user" queries.
drop trigger if exists daily_steps_set_updated_at on public.daily_steps;
create trigger daily_steps_set_updated_at
  before update on public.daily_steps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- screen_time_summaries: one row per user per day
-- app_usage: one row per user per day per app
-- ---------------------------------------------------------------------------

create table if not exists public.screen_time_summaries (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  day          date not null,
  total_ms     bigint not null check (total_ms between 0 and 86400000),
  app_count    integer not null check (app_count >= 0),
  platform     text not null check (platform in ('android', 'ios')),
  captured_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, day)
);

comment on table public.screen_time_summaries is 'Total foreground app time per day, read from Android usage stats.';

drop trigger if exists screen_time_summaries_set_updated_at on public.screen_time_summaries;
create trigger screen_time_summaries_set_updated_at
  before update on public.screen_time_summaries
  for each row execute function public.set_updated_at();

-- app_usage table is retired and kept local on device for maximum privacy.
drop table if exists public.app_usage cascade;

-- ---------------------------------------------------------------------------
-- Row Level Security: owners only. No policies for the `anon` role at all.
-- (select auth.uid()) is evaluated once per statement instead of once per row.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.daily_steps enable row level security;
alter table public.screen_time_summaries enable row level security;

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

-- daily_steps
drop policy if exists "daily_steps: owner can read" on public.daily_steps;
create policy "daily_steps: owner can read" on public.daily_steps
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "daily_steps: owner can insert" on public.daily_steps;
create policy "daily_steps: owner can insert" on public.daily_steps
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "daily_steps: owner can update" on public.daily_steps;
create policy "daily_steps: owner can update" on public.daily_steps
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "daily_steps: owner can delete" on public.daily_steps;
create policy "daily_steps: owner can delete" on public.daily_steps
  for delete to authenticated using ((select auth.uid()) = user_id);

-- screen_time_summaries
drop policy if exists "screen_time_summaries: owner can read" on public.screen_time_summaries;
create policy "screen_time_summaries: owner can read" on public.screen_time_summaries
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "screen_time_summaries: owner can insert" on public.screen_time_summaries;
create policy "screen_time_summaries: owner can insert" on public.screen_time_summaries
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "screen_time_summaries: owner can update" on public.screen_time_summaries;
create policy "screen_time_summaries: owner can update" on public.screen_time_summaries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "screen_time_summaries: owner can delete" on public.screen_time_summaries;
create policy "screen_time_summaries: owner can delete" on public.screen_time_summaries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Table privileges: signed-in users only (RLS still applies); nothing for `anon`.
revoke all on public.profiles, public.daily_steps, public.screen_time_summaries from anon;
grant select, insert, update, delete
  on public.profiles, public.daily_steps, public.screen_time_summaries
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
