/**
 * End-to-end check of DayFlow's Supabase setup: persistence, no-duplicate upserts and
 * Row Level Security. Uses only the public anon key from .env, exactly like the app.
 *
 *   node --env-file=.env scripts/supabase/verify-cloud.mjs
 *
 * It creates two temporary anonymous users, writes data as user A, checks that user B and
 * a signed-out client can't read or change it, then deletes both users (and their rows and
 * files) with delete_current_user(). Requires the migration to be applied and anonymous
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

  // ---- Persistence and upserts ------------------------------------------------------
  const profile = {
    id: idA,
    full_name: 'RLS Check',
    email: 'rls-check@example.com',
    mobile: '+919876543210',
    age: 30,
    location_label: 'Bhubaneswar, Odisha, India',
    latitude: 20.29,
    longitude: 85.82,
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

  const day = { user_id: idA, day: '2026-10-16', steps: 1000, goal: 8000 };
  await a.from('daily_steps').upsert(day, { onConflict: 'user_id,day' });
  await a.from('daily_steps').upsert({ ...day, steps: 2500 }, { onConflict: 'user_id,day' });
  const { data: steps } = await a.from('daily_steps').select('steps');
  check(steps?.length === 1 && steps[0].steps === 2500, 'daily_steps upsert keeps one row per day');

  const summary = { user_id: idA, day: '2026-10-16', total_ms: 3_600_000, app_count: 1, platform: 'android', captured_at: new Date().toISOString() };
  check(!(await a.from('screen_time_summaries').upsert(summary, { onConflict: 'user_id,day' })).error, 'A can save a screen-time summary');

  const png = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  check(!(await a.storage.from('avatars').upload(`${idA}/avatar-test.jpg`, png, { contentType: 'image/jpeg' })).error, 'A can upload to its avatar folder');
  check(!!(await a.storage.from('avatars').upload(`${idB}/avatar-evil.jpg`, png, { contentType: 'image/jpeg' })).error, "A can't upload into B's folder");

  // ---- Isolation ------------------------------------------------------------------------
  for (const table of ['profiles', 'daily_steps', 'screen_time_summaries']) {
    const { data } = await b.from(table).select('*');
    check((data ?? []).length === 0, `B can't read A's ${table}`);
    const { data: anonData } = await anon.from(table).select('*');
    check((anonData ?? []).length === 0, `signed-out client can't read ${table}`);
  }
  const { data: hijack } = await b.from('profiles').update({ full_name: 'Hacked' }).eq('id', idA).select();
  check((hijack ?? []).length === 0, "B can't update A's profile");
  const { data: wiped } = await b.from('daily_steps').delete().eq('user_id', idA).select();
  check((wiped ?? []).length === 0, "B can't delete A's steps");
  check(!!(await b.from('daily_steps').insert({ user_id: idA, day: '2026-10-17', steps: 1, goal: 8000 })).error, "B can't insert rows for A");
  check(!!(await b.from('profiles').insert({ ...profile, id: idA })).error, "B can't create a profile with A's id");
  const { data: files } = await b.storage.from('avatars').list(idA);
  check((files ?? []).length === 0, "B can't list A's avatar files");
  check(!!(await b.storage.from('avatars').download(`${idA}/avatar-test.jpg`)).error, "B can't download A's avatar");

  // ---- Constraints --------------------------------------------------------------------
  check(!!(await a.from('daily_steps').upsert({ ...day, steps: -5 }, { onConflict: 'user_id,day' })).error, 'negative steps are rejected');
  check(!!(await a.from('profiles').upsert({ ...profile, age: 7 }, { onConflict: 'id' })).error, 'under-13 age is rejected');
  check(!!(await a.from('profiles').upsert({ ...profile, mobile: 'call me' }, { onConflict: 'id' })).error, 'malformed mobile is rejected');
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
