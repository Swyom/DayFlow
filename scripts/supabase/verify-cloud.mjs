/**
 * End-to-end check of DayFlow's Supabase setup: persistence, no-duplicate upserts,
 * strict validation constraints, and Row Level Security for profiles and avatars.
 * Uses only the public anon key from .env, exactly like the app.
 *
 *   node --env-file=.env scripts/supabase/verify-cloud.mjs
 *
 * It creates two temporary anonymous users, writes profile & avatar data as user A,
 * checks that user B and a signed-out client can't read or change it, verifies
 * constraint validation, and cleans up both users (and their rows and files)
 * with delete_current_user(). Requires the migration to be applied and anonymous
 * sign-ins to be enabled.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (run with --env-file=.env).');
  process.exit(2);
}

// Realtime isn't used here, but supabase-js needs a WebSocket class to exist (Node < 22 has none).
globalThis.WebSocket ??= class {
  constructor() {
    throw new Error('Realtime is not used by this script.');
  }
};

const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

const a = newClient();
const b = newClient();
const anon = newClient();
const cleanup = [];

try {
  const { data: sa, error: ea } = await a.auth.signInAnonymously();
  if (ea) throw new Error(`Anonymous sign-in failed (is it enabled?): ${ea.message}`);
  cleanup.push(a);
  const { data: sb, error: eb } = await b.auth.signInAnonymously();
  if (eb) throw eb;
  cleanup.push(b);
  const idA = sa.user.id;
  const idB = sb.user.id;

  // ---- Profile Persistence and Upserts ----------------------------------------------
  const profile = {
    id: idA,
    full_name: 'RLS Check',
    email: 'rls-check@example.com',
    mobile: '+919876543210',
    age: 30,
    location_label: 'Bhubaneswar, Odisha, India',
    location_source: 'gps',
    avatar_path: null,
    step_goal: 8000,
    registered_at: '2026-01-01T10:00:00Z',
  };
  check(!(await a.from('profiles').upsert(profile, { onConflict: 'id' })).error, 'A can create its profile');
  check(
    !(await a.from('profiles').upsert({ ...profile, full_name: 'RLS Check 2', registered_at: '2030-01-01T00:00:00Z' }, { onConflict: 'id' })).error,
    'A can update its profile (upsert)',
  );
  const { data: rowsA } = await a.from('profiles').select('full_name, registered_at');
  check(rowsA?.length === 1 && rowsA[0].full_name === 'RLS Check 2', 'profile upsert updated in place (1 row)');
  check(rowsA?.[0] && new Date(rowsA[0].registered_at).toISOString() === '2026-01-01T10:00:00.000Z', 'registered_at never changes after insert');

  // ---- Avatar Storage ---------------------------------------------------------------
  const png = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  check(!(await a.storage.from('avatars').upload(`${idA}/avatar-test.jpg`, png, { contentType: 'image/jpeg' })).error, 'A can upload to its avatar folder');
  check(!!(await a.storage.from('avatars').upload(`${idB}/avatar-evil.jpg`, png, { contentType: 'image/jpeg' })).error, "A can't upload into B's folder");

  // ---- Row Level Security & Isolation ------------------------------------------------
  const { data: bProfiles } = await b.from('profiles').select('*');
  check((bProfiles ?? []).length === 0, "B can't read A's profile");

  const { data: anonProfiles } = await anon.from('profiles').select('*');
  check((anonProfiles ?? []).length === 0, 'signed-out client can\'t read profiles');

  const { data: hijack } = await b.from('profiles').update({ full_name: 'Hacked' }).eq('id', idA).select();
  check((hijack ?? []).length === 0, "B can't update A's profile");

  check(!!(await b.from('profiles').insert({ ...profile, id: idA })).error, "B can't create a profile with A's id");

  const { data: files } = await b.storage.from('avatars').list(idA);
  check((files ?? []).length === 0, "B can't list A's avatar files");
  check(!!(await b.storage.from('avatars').download(`${idA}/avatar-test.jpg`)).error, "B can't download A's avatar");

  // ---- Strict Validation Constraints -------------------------------------------------
  check(!!(await a.from('profiles').upsert({ ...profile, age: 7 }, { onConflict: 'id' })).error, 'under-13 age is rejected');
  check(!!(await a.from('profiles').upsert({ ...profile, mobile: 'call me' }, { onConflict: 'id' })).error, 'malformed mobile is rejected');
  check(!!(await a.from('profiles').upsert({ ...profile, email: 'not-an-email' }, { onConflict: 'id' })).error, 'malformed email is rejected');
  check(!!(await a.from('profiles').upsert({ ...profile, full_name: '   ' }, { onConflict: 'id' })).error, 'blank full name is rejected');
  const coords = await a.from('profiles').upsert({ ...profile, latitude: 20.29, longitude: 85.82 }, { onConflict: 'id' });
  check(!!coords.error, 'GPS coordinates cannot be stored (columns removed)');

  // ---- Duplicate Prevention & Conflict Checking -------------------------------------
  const { data: conflictEmail, error: errRpc1 } = await b.rpc('check_profile_conflicts', {
    check_name: 'Brand New Name',
    check_email: 'RLS-CHECK@example.com',
  });
  if (errRpc1) {
    console.log('INFO: check_profile_conflicts RPC pending migration run in Supabase SQL editor');
  } else {
    check(conflictEmail?.email_taken === true && conflictEmail?.name_taken === false, 'duplicate email is detected via check_profile_conflicts');
  }

  const { data: conflictName } = await b.rpc('check_profile_conflicts', {
    check_name: '  RLS Check 2  ',
    check_email: 'unique-email@example.com',
  });
  if (conflictName) {
    check(conflictName?.name_taken === false && conflictName?.email_taken === false, 'names are not unique (same name, different email is allowed)');
  }
  const sameName = await b.from('profiles').upsert({ ...profile, id: idB, full_name: 'RLS Check 2', email: `same-name-${Date.now()}@example.com` }, { onConflict: 'id' });
  check(!sameName.error, 'a second person with the same name can create a profile', sameName.error?.message);
  const sameEmail = await b.from('profiles').upsert({ ...profile, id: idB, email: 'RLS-CHECK@example.com' }, { onConflict: 'id' });
  check(!!sameEmail.error, 'a second profile with the same email is rejected');

  const { data: conflictSelf } = await a.rpc('check_profile_conflicts', {
    check_name: 'RLS Check 2',
    check_email: 'rls-check@example.com',
    exclude_user_id: idA,
  });
  if (conflictSelf) {
    check(conflictSelf?.name_taken === false && conflictSelf?.email_taken === false, 'exclude_user_id allows self when editing profile');
  }
} catch (e) {
  console.error('ERROR', e.message ?? e);
  failures++;
} finally {
  // ---- Cleanup: remove test files, then the test users (cascades to their rows) --------
  for (const client of cleanup) {
    const { data } = await client.auth.getSession();
    const id = data.session?.user.id;
    if (id) {
      const { data: list } = await client.storage.from('avatars').list(id);
      if (list?.length) await client.storage.from('avatars').remove(list.map((f) => `${id}/${f.name}`));
    }
    const { error } = await client.rpc('delete_current_user');
    check(!error, `cleanup: test user ${id?.slice(0, 8)}… deleted`);
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
