-- DayFlow account recovery: 7-day soft delete + verified, rate-limited restore.
--
-- Deleting a profile in the app now has two modes:
--   * soft_delete_current_user(): the profile row is moved to public.deleted_profiles for
--     7 days, then the anonymous auth user is deleted. Nothing in deleted_profiles is
--     readable by any client (RLS on, no policies, no grants).
--   * delete_current_user() (unchanged): permanent, immediate deletion.
-- Profile photos are deleted immediately in both modes (the app removes the files through
-- the Storage API first) and are never restorable. Activity data never reaches the cloud.
--
-- recover_deleted_profile(email, mobile) restores a soft-deleted profile onto the caller's
-- new anonymous user, but only when the email AND mobile match exactly, the 7 days have
-- not passed, and no rate limit is hit. Limits are enforced here, server-side, per:
--   * the email being recovered   (5 failures / 24 h)  -> stops guessing one person's details
--   * the calling anonymous user  (5 failures / 24 h)  -> "five attempts per user"
--   * the caller's IP address     (20 failures / 24 h) -> stops spraying many emails from fresh
--                                                         installs (looser: mobile networks
--                                                         share IPs between many people)
-- Reaching a limit locks that key for 24 hours; the counter only resets after the lock
-- (or a quiet 24-hour window) expires. Clearing app data creates a new anonymous user but
-- leaves the email and IP locks in place. Every failure returns the same generic answer.
--
-- Run after 20261016120000_dayflow_cloud_profile.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Retained (soft-deleted) profiles
-- ---------------------------------------------------------------------------

create table if not exists public.deleted_profiles (
  id                uuid primary key default gen_random_uuid(),
  original_user_id  uuid not null,
  email_norm        text not null,
  full_name         text not null,
  email             text not null,
  mobile            text not null,
  age               smallint not null,
  location_label    text not null,
  location_source   text not null,
  step_goal         integer not null,
  registered_at     timestamptz not null,
  deleted_at        timestamptz not null default now(),
  purge_after       timestamptz not null
);

comment on table public.deleted_profiles is
  'Profiles deleted in the app, kept 7 days for verified recovery, then purged. No client access.';

-- Earlier drafts kept GPS coordinates here too; only the city label is kept now.
alter table public.deleted_profiles drop column if exists latitude;
alter table public.deleted_profiles drop column if exists longitude;

create index if not exists deleted_profiles_lookup_idx on public.deleted_profiles (email_norm, mobile);
create index if not exists deleted_profiles_purge_idx on public.deleted_profiles (purge_after);

alter table public.deleted_profiles enable row level security;
revoke all on public.deleted_profiles from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recovery rate limits (keys are hashed: no emails or IPs stored in clear text)
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_limits (
  key           text primary key,
  failures      integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);

comment on table public.recovery_limits is 'Failed recovery attempts per hashed key (email, user, IP). No client access.';

alter table public.recovery_limits enable row level security;
revoke all on public.recovery_limits from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (internal: not callable by clients)
-- ---------------------------------------------------------------------------

create or replace function public.recovery_key(kind text, value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select kind || ':' || encode(pg_catalog.sha256(convert_to(value, 'UTF8')), 'hex');
$$;

-- Caller IP as seen by Supabase's edge (Cloudflare sets cf-connecting-ip; clients can't forge it).
create or replace function public.recovery_client_ip()
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

-- Lock end when the key is locked right now, else null.
create or replace function public.recovery_is_locked(k text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select locked_until from public.recovery_limits where key = k and locked_until > now();
$$;

-- Counts one failure for a key; locks it for 24 h when it reaches max_failures. Returns the lock end or null.
create or replace function public.recovery_note_failure(k text, max_failures integer)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_failures integer;
  v_lock timestamptz;
begin
  insert into public.recovery_limits as r (key, failures, window_start)
  values (k, 1, now())
  on conflict (key) do update
    set failures = case
          when r.window_start < now() - interval '24 hours' and (r.locked_until is null or r.locked_until <= now())
            then 1
          else r.failures + 1
        end,
        window_start = case
          when r.window_start < now() - interval '24 hours' and (r.locked_until is null or r.locked_until <= now())
            then now()
          else r.window_start
        end,
        locked_until = case when r.locked_until <= now() then null else r.locked_until end
  returning failures into v_failures;

  if v_failures >= max_failures then
    v_lock := now() + interval '24 hours';
    update public.recovery_limits set locked_until = v_lock where key = k;
    return v_lock;
  end if;
  return null;
end;
$$;

revoke all on function public.recovery_key(text, text) from public, anon, authenticated;
revoke all on function public.recovery_client_ip() from public, anon, authenticated;
revoke all on function public.recovery_is_locked(text) from public, anon, authenticated;
revoke all on function public.recovery_note_failure(text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Soft delete: keep the profile 7 days, delete the auth user now
-- ---------------------------------------------------------------------------

create or replace function public.soft_delete_current_user()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  retained public.deleted_profiles;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Expired records are purged on every call too, in case the daily job isn't running.
  delete from public.deleted_profiles where purge_after <= now();

  select * into p from public.profiles where id = uid;
  if found then
    -- Only the latest deletion for an email is kept.
    delete from public.deleted_profiles where email_norm = lower(btrim(p.email));
    insert into public.deleted_profiles (
      original_user_id, email_norm, full_name, email, mobile, age, location_label,
      location_source, step_goal, registered_at, purge_after
    ) values (
      uid, lower(btrim(p.email)), p.full_name, p.email, p.mobile, p.age, p.location_label,
      p.location_source, p.step_goal, p.registered_at, now() + interval '7 days'
    )
    returning * into retained;
  end if;

  delete from auth.users where id = uid; -- cascades to public.profiles

  if retained.id is null then
    return jsonb_build_object('deletion_id', null, 'purge_after', null);
  end if;
  return jsonb_build_object('deletion_id', retained.id, 'purge_after', retained.purge_after);
end;
$$;

revoke all on function public.soft_delete_current_user() from public, anon;
grant execute on function public.soft_delete_current_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Recovery
-- ---------------------------------------------------------------------------

create or replace function public.recover_deleted_profile(p_email text, p_mobile text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_mobile text := regexp_replace(btrim(coalesce(p_mobile, '')), '[[:space:]().-]', '', 'g');
  ip text := public.recovery_client_ip();
  k_email text;
  k_user text;
  k_ip text;
  lock_end timestamptz;
  l timestamptz;
  d public.deleted_profiles;
  valid boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Only a device without a profile can recover one (never overwrite an active profile).
  if exists (select 1 from public.profiles where id = uid) then
    return jsonb_build_object('status', 'has_profile');
  end if;

  valid := char_length(v_email) between 3 and 254
           and v_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
           and v_mobile ~ '^\+?[0-9]{7,15}$';

  k_email := public.recovery_key('email', v_email);
  k_user := public.recovery_key('user', uid::text);
  k_ip := case when ip is null then null else public.recovery_key('ip', ip) end;

  -- Serialise attempts on the same email / user / IP so parallel requests can't slip
  -- past the limit (fixed order avoids deadlocks).
  perform pg_advisory_xact_lock(hashtextextended(k_email, 0));
  if k_ip is not null then perform pg_advisory_xact_lock(hashtextextended(k_ip, 0)); end if;
  perform pg_advisory_xact_lock(hashtextextended(k_user, 0));

  lock_end := greatest(public.recovery_is_locked(k_email), public.recovery_is_locked(k_user),
                       case when k_ip is null then null else public.recovery_is_locked(k_ip) end);
  if lock_end is not null then
    return jsonb_build_object('status', 'rate_limited', 'retry_after', lock_end);
  end if;

  delete from public.deleted_profiles where purge_after <= now();

  if valid then
    select * into d from public.deleted_profiles
    where email_norm = v_email
      and mobile = v_mobile
      and purge_after > now()
    order by deleted_at desc
    limit 1
    for update;
  end if;

  if valid and d.id is not null then
    begin
      insert into public.profiles (
        id, full_name, email, mobile, age, location_label,
        location_source, avatar_path, step_goal, registered_at
      ) values (
        uid, d.full_name, d.email, d.mobile, d.age, d.location_label,
        d.location_source, null, d.step_goal, d.registered_at
      );
      delete from public.deleted_profiles where id = d.id;
      return jsonb_build_object('status', 'restored', 'deletion_id', d.id);
    exception when unique_violation then
      -- Someone created a new profile with this email meanwhile: treat as not found.
      null;
    end;
  end if;

  -- Failure: count it everywhere, answer generically.
  lock_end := null;
  l := public.recovery_note_failure(k_email, 5);
  lock_end := greatest(lock_end, l);
  l := public.recovery_note_failure(k_user, 5);
  lock_end := greatest(lock_end, l);
  if k_ip is not null then
    l := public.recovery_note_failure(k_ip, 20);
    lock_end := greatest(lock_end, l);
  end if;

  if lock_end is not null then
    return jsonb_build_object('status', 'rate_limited', 'retry_after', lock_end);
  end if;
  return jsonb_build_object('status', 'not_found');
end;
$$;

revoke all on function public.recover_deleted_profile(text, text) from public, anon;
grant execute on function public.recover_deleted_profile(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Lets the app check that recoverable deletion is installed before deleting anything.
-- ---------------------------------------------------------------------------

create or replace function public.recovery_status()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('available', true, 'retention_days', 7);
$$;

revoke all on function public.recovery_status() from public, anon;
grant execute on function public.recovery_status() to authenticated;

-- Close an enumeration leak: signed-out clients could ask whether an email exists.
revoke execute on function public.check_profile_conflicts(text, text, uuid) from anon;

-- ---------------------------------------------------------------------------
-- Daily purge of expired records (pg_cron). If pg_cron isn't enabled, the functions
-- above still purge expired rows on every call and never restore an expired record.
-- ---------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'dayflow-purge-deleted-profiles';
  perform cron.schedule(
    'dayflow-purge-deleted-profiles',
    '17 3 * * *',
    $job$
      delete from public.deleted_profiles where purge_after <= now();
      delete from public.recovery_limits
        where window_start < now() - interval '2 days' and (locked_until is null or locked_until < now());
    $job$
  );
exception when others then
  raise notice 'pg_cron not available (%): expired records are still purged on each delete/recovery call.', sqlerrm;
end;
$$;
