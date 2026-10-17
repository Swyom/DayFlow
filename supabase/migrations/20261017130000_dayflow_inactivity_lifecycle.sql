-- DayFlow Account Lifecycle, Inactivity Handling, and Schema Cleanup
--
-- 1. Completely removes the Restore Profile feature:
--    - Drops public.recovery_limits and public.deleted_profiles tables.
--    - Drops recover_deleted_profile, soft_delete_current_user, and related recovery helper functions.
-- 2. Implements automatic 7-day inactivity policy:
--    - Adds `last_active_at` timestamp to public.profiles.
--    - Adds `touch_profile_activity()` RPC to refresh last active timestamp.
--    - Adds `purge_inactive_profiles()` for atomic server-side cleanup of profiles inactive for >= 7 days.
-- 3. Enforces profile uniqueness and server-side rate limiting:
--    - Adds `created_ip` to public.profiles for tamper-proof server-side rate limiting.
--    - Rate limit trigger enforces a maximum of 5 account creations per 24 hours per IP.
--    - Ensures unique constraints on email and normalized mobile.
--    - Updates check_profile_conflicts to verify against active profiles without referencing deleted tables.
-- 4. Atomic user data deletion:
--    - `delete_current_user()` atomically deletes user avatar objects in storage.objects and
--      deletes the auth.users record (which cascades to public.profiles).

-- ---------------------------------------------------------------------------
-- 1. Remove obsolete recovery objects
-- ---------------------------------------------------------------------------

drop function if exists public.recover_deleted_profile(text, text);
drop function if exists public.soft_delete_current_user();
drop function if exists public.recovery_status();
drop function if exists public.recovery_note_failure(text, integer);
drop function if exists public.recovery_is_locked(text);
drop function if exists public.recovery_key(text, text);
drop function if exists public.recovery_client_ip();

drop table if exists public.recovery_limits cascade;
drop table if exists public.deleted_profiles cascade;

-- Unschedule obsolete recovery cron job if pg_cron is installed
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'dayflow-purge-deleted-profiles';
  end if;
exception when others then
  null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Update public.profiles schema for inactivity and rate limiting
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists last_active_at timestamptz not null default now();
alter table public.profiles add column if not exists created_ip text;

create index if not exists profiles_last_active_at_idx on public.profiles (last_active_at);
create index if not exists profiles_created_ip_idx on public.profiles (created_ip);

-- Ensure unique indexes on email and normalized mobile
create unique index if not exists profiles_email_unique on public.profiles (lower(email));

create unique index if not exists profiles_mobile_unique
on public.profiles using btree (
  (case
    when length(regexp_replace(mobile, '[^0-9]', '', 'g')) >= 10
      then right(regexp_replace(mobile, '[^0-9]', '', 'g'), 10)
    else regexp_replace(mobile, '[^0-9]', '', 'g')
  end)
);

-- ---------------------------------------------------------------------------
-- 3. Client IP extraction & Account Creation Rate Limiting (Server-side)
-- ---------------------------------------------------------------------------

create or replace function public.dayflow_client_ip()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  headers json;
begin
  headers := nullif(current_setting('request.headers', true), '')::json;
  return nullif(btrim(headers ->> 'cf-connecting-ip'), '');
exception when others then
  return null;
end;
$$;

revoke all on function public.dayflow_client_ip() from public, anon, authenticated;

create or replace function public.profiles_enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text := public.dayflow_client_ip();
  v_count integer;
  v_earliest timestamptz;
  v_wait_until timestamptz;
begin
  new.created_ip := v_ip;
  new.last_active_at := coalesce(new.last_active_at, now());

  if v_ip is not null and v_ip <> '' then
    -- Count account creations from this IP in the past 24 hours
    select count(*), min(created_at)
    into v_count, v_earliest
    from public.profiles
    where created_ip = v_ip
      and created_at > now() - interval '24 hours';

    if v_count >= 5 then
      v_wait_until := v_earliest + interval '24 hours';
      raise exception 'Rate limit reached: Maximum 5 account creation attempts permitted per 24 hours. Please try again after %.',
        to_char(v_wait_until, 'YYYY-MM-DD HH24:MI:SS UTC')
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_rate_limit_trigger on public.profiles;
create trigger profiles_rate_limit_trigger
  before insert on public.profiles
  for each row execute function public.profiles_enforce_rate_limit();

create or replace function public.profiles_keep_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.registered_at := old.registered_at;
  new.created_at := old.created_at;
  new.created_ip := old.created_ip;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Active Profile Conflict Checks (Pre-flight validation)
-- ---------------------------------------------------------------------------

create or replace function public.check_profile_conflicts(
  check_name text,
  check_email text,
  exclude_user_id uuid default null,
  check_mobile text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_name text := lower(regexp_replace(btrim(coalesce(check_name, '')), '\s+', ' ', 'g'));
  clean_email text := lower(btrim(coalesce(check_email, '')));
  raw_mobile text := regexp_replace(btrim(coalesce(check_mobile, '')), '[^0-9]', '', 'g');
  clean_mobile_10 text := case when length(raw_mobile) >= 10 then right(raw_mobile, 10) else raw_mobile end;
  has_name boolean := false;
  has_email boolean := false;
  has_mobile boolean := false;
begin
  if auth.uid() is null and current_user not in ('postgres', 'service_role') then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if clean_name != '' then
    select exists (
      select 1 from public.profiles
      where lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g')) = clean_name
        and (exclude_user_id is null or id != exclude_user_id)
    ) into has_name;
  end if;

  if clean_email != '' then
    select exists (
      select 1 from public.profiles
      where lower(email) = clean_email
        and (exclude_user_id is null or id != exclude_user_id)
    ) into has_email;
  end if;

  if clean_mobile_10 != '' then
    select exists (
      select 1 from public.profiles
      where (
        (length(regexp_replace(mobile, '[^0-9]', '', 'g')) >= 10 and right(regexp_replace(mobile, '[^0-9]', '', 'g'), 10) = clean_mobile_10)
        or regexp_replace(mobile, '[^0-9]', '', 'g') = raw_mobile
      )
      and (exclude_user_id is null or id != exclude_user_id)
    ) into has_mobile;
  end if;

  return jsonb_build_object(
    'name_taken', has_name,
    'email_taken', has_email,
    'mobile_taken', has_mobile,
    'conflict', (has_email or has_mobile)
  );
end;
$$;

revoke all on function public.check_profile_conflicts(text, text, uuid, text) from public, anon;
grant execute on function public.check_profile_conflicts(text, text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Activity Heartbeat: updates last_active_at and returns server timestamp
-- ---------------------------------------------------------------------------

create or replace function public.touch_profile_activity()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  now_ts timestamptz := now();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.profiles
  set last_active_at = now_ts
  where id = uid;
  return now_ts;
end;
$$;

revoke all on function public.touch_profile_activity() from public, anon;
grant execute on function public.touch_profile_activity() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Atomic User Account & Storage Deletion
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
  -- Atomic cleanup of user's uploaded avatar files in storage
  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = uid::text;
  -- Atomic deletion of auth user (cascades to public.profiles)
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Inactivity Purge (Server-side 7-day retention policy)
-- ---------------------------------------------------------------------------

create or replace function public.purge_inactive_profiles()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged_count integer := 0;
  r record;
begin
  for r in
    select id from public.profiles
    where last_active_at < now() - interval '7 days'
  loop
    -- Delete avatar storage objects
    delete from storage.objects
    where bucket_id = 'avatars'
      and (storage.foldername(name))[1] = r.id::text;
    -- Delete auth user (cascades to public.profiles)
    delete from auth.users where id = r.id;
    purged_count := purged_count + 1;
  end loop;

  return jsonb_build_object('purged', purged_count, 'executed_at', now());
end;
$$;

revoke all on function public.purge_inactive_profiles() from public, anon, authenticated;

-- If pg_cron is enabled in the database, schedule daily purge at 03:00 UTC
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'dayflow-purge-inactive-profiles';
    perform cron.schedule(
      'dayflow-purge-inactive-profiles',
      '0 3 * * *',
      'select public.purge_inactive_profiles();'
    );
  end if;
exception when others then
  null;
end;
$$;
