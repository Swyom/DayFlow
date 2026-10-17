/**
 * Live check of account recovery against your Supabase project, using only the public anon
 * key (exactly what the app can do):
 *
 *   node --env-file=.env scripts/supabase/verify-recovery.mjs
 *
 * Covers: successful restore, wrong email, wrong mobile, unknown account, malformed input,
 * an active profile can't be overwritten, a restored record can't be restored twice,
 * signed-out / unauthorised calls, no client access to retained data or limits, the
 * 5-attempt lock, the lock surviving an "app restart" (new anonymous user), the lock
 * blocking even correct details, the 24-hour cooldown value, and a parallel burst.
 *
 * Side effects: creates temporary anonymous users and deletes them at the end. One test
 * deletion stays in deleted_profiles (unreadable by clients) until it is purged after 7
 * days, because its email is deliberately locked for 24 hours. Each run counts about 15
 * failed attempts against your IP address (limit 20 per 24 h), so run it at most once a day
 * from the same network.
 */
import { createClient } from '@supabase/supabase-js';

// Realtime isn't used here, but supabase-js needs a WebSocket class to exist (Node < 22 has none).
globalThis.WebSocket ??= class {
  constructor() {
    throw new Error('Realtime is not used by this script.');
  }
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (run with --env-file=.env).');
  process.exit(2);
}

const tag = Math.random().toString(36).slice(2, 8);
const randomMobile = () => `+91${Math.floor(6_000_000_000 + Math.random() * 3_999_999_999)}`;
let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
};

const users = [];
async function anonUser() {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`Anonymous sign-in failed (is it enabled?): ${error.message}`);
  users.push(c);
  return { c, id: data.user.id };
}
const signedOut = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const profileRow = (id, email, mobile) => ({
  id,
  full_name: `Recovery Test ${tag} ${Math.random().toString(36).slice(2, 6)}`,
  email,
  mobile,
  age: 30,
  location_label: 'Bhubaneswar, Odisha, India',
  location_source: 'manual',
  avatar_path: null,
  step_goal: 9000,
  registered_at: '2026-01-02T03:04:05Z',
});

async function createAndSoftDelete(email, mobile) {
  const { c, id } = await anonUser();
  const row = profileRow(id, email, mobile);
  const ins = await c.from('profiles').insert(row);
  if (ins.error) throw new Error(`Couldn't create test profile: ${ins.error.message}`);
  const del = await c.rpc('soft_delete_current_user');
  if (del.error) throw new Error(`soft_delete_current_user failed (is the recovery migration applied?): ${del.error.message}`);
  return { row, result: del.data };
}

const recover = (c, email, mobile) => c.rpc('recover_deleted_profile', { p_email: email, p_mobile: mobile });

try {
  // ---- 1. Recoverable deletion ---------------------------------------------------------
  const aEmail = `recovery-a-${tag}@example.com`;
  const aMobile = randomMobile();
  const { row: aRow, result: aDel } = await createAndSoftDelete(aEmail, aMobile);
  check(typeof aDel?.deletion_id === 'string', 'soft delete returns a deletion id', aDel);
  const days = (Date.parse(aDel?.purge_after) - Date.now()) / 86_400_000;
  check(days > 6.99 && days <= 7.001, 'retained for 7 days', aDel?.purge_after);

  // ---- 2. Unauthorised access -----------------------------------------------------------
  const out = signedOut();
  check(!!(await recover(out, aEmail, aMobile)).error, 'signed-out client cannot call recovery');
  check(!!(await out.rpc('soft_delete_current_user')).error, 'signed-out client cannot call soft delete');
  check(!!(await out.rpc('check_profile_conflicts', { check_name: 'x', check_email: aEmail })).error, 'signed-out client cannot probe emails');
  const { c: b, id: bId } = await anonUser();
  for (const table of ['deleted_profiles', 'recovery_limits']) {
    const r = await b.from(table).select('*');
    check(!!r.error || (r.data ?? []).length === 0, `signed-in user cannot read ${table}`, r.error?.message ?? r.data);
    const o = await out.from(table).select('*');
    check(!!o.error || (o.data ?? []).length === 0, `signed-out client cannot read ${table}`);
  }
  for (const fn of ['recovery_note_failure', 'recovery_is_locked']) {
    const r = await b.rpc(fn, { k: 'email:x', max_failures: 1 });
    check(!!r.error, `internal helper ${fn} is not callable`);
  }

  // ---- 3. Wrong details, then the right ones ----------------------------------------------
  const notFound = (r) => !r.error && r.data?.status === 'not_found';
  let r = await recover(b, `wrong-${tag}@example.com`, aMobile);
  check(notFound(r), 'wrong email -> not found', r.data ?? r.error);
  r = await recover(b, aEmail, randomMobile());
  check(notFound(r), 'wrong mobile -> not found', r.data ?? r.error);
  r = await recover(b, `nobody-${tag}@example.com`, randomMobile());
  check(notFound(r), 'nonexistent account -> not found', r.data ?? r.error);
  r = await recover(b, 'not an email', '12ab');
  check(notFound(r), 'malformed input -> not found (no detail leaked)', r.data ?? r.error);
  const notFoundBody = JSON.stringify(r.data);
  check(notFoundBody === '{"status":"not_found"}', 'failure answer carries no account information', notFoundBody);

  r = await recover(b, `  ${aEmail.toUpperCase()} `, aMobile.replace('+91', '+91 '));
  check(!r.error && r.data?.status === 'restored' && r.data?.deletion_id === aDel?.deletion_id, 'correct email + mobile -> restored', r.data ?? r.error);
  const { data: restored } = await b.from('profiles').select('*').eq('id', bId).maybeSingle();
  check(restored?.full_name === aRow.full_name && restored?.email === aEmail && restored?.step_goal === 9000, 'restored profile has the original details', restored);
  check(restored && new Date(restored.registered_at).toISOString() === '2026-01-02T03:04:05.000Z', 'original registration date is kept', restored?.registered_at);
  check(restored?.avatar_path === null, 'no photo restored (photos are deleted immediately)');

  r = await recover(b, aEmail, aMobile);
  check(r.data?.status === 'has_profile', 'an active profile is never overwritten', r.data ?? r.error);
  const { c: c2, id: c2Id } = await anonUser();
  r = await recover(c2, aEmail, aMobile);
  check(r.data?.status === 'restored', 'active profile can be claimed by owner on new install', r.data ?? r.error);
  const { data: c2Profile } = await c2.from('profiles').select('*').eq('id', c2Id).maybeSingle();
  check(c2Profile?.email === aEmail, 'claimed profile is transferred to new anonymous user', c2Profile);

  // ---- 4. Five failures lock the account's email, even across "app restarts" ----------------
  const vEmail = `recovery-v-${tag}@example.com`;
  const vMobile = randomMobile();
  await createAndSoftDelete(vEmail, vMobile);
  const { c: d1 } = await anonUser();
  const answers = [];
  for (let i = 0; i < 5; i++) answers.push((await recover(d1, vEmail, randomMobile())).data);
  check(answers.slice(0, 4).every((a) => a?.status === 'not_found'), 'attempts 1-4 -> not found', answers);
  check(answers[4]?.status === 'rate_limited', '5th failed attempt -> blocked', answers[4]);
  const hours = (Date.parse(answers[4]?.retry_after) - Date.now()) / 3_600_000;
  check(hours > 23.9 && hours <= 24.01, 'cooldown is 24 hours', answers[4]?.retry_after);
  r = await recover(d1, vEmail, randomMobile());
  check(r.data?.status === 'rate_limited', '6th attempt stays blocked', r.data);

  const { c: d2 } = await anonUser(); // a fresh anonymous user = reinstall / cleared app data
  r = await recover(d2, vEmail, vMobile);
  check(r.data?.status === 'rate_limited', 'restart + CORRECT details are still blocked', r.data);
  const { data: stillMine } = await d2.from('profiles').select('id');
  check((stillMine ?? []).length === 0, 'nothing was restored while blocked');

  // ---- 5. Parallel burst can't exceed the limit ----------------------------------------------
  const { c: g } = await anonUser();
  const burst = await Promise.all(Array.from({ length: 6 }, () => recover(g, `burst-${tag}@example.com`, randomMobile())));
  const statuses = burst.map((x) => x.data?.status ?? `error:${x.error?.message}`);
  const nf = statuses.filter((s) => s === 'not_found').length;
  check(nf <= 4 && statuses.filter((s) => s === 'rate_limited').length >= 2, 'parallel requests get at most 4 tries before the block', statuses);
} catch (e) {
  console.error('ERROR', e.message ?? e);
  failures++;
} finally {
  // Remove every temporary user (cascades to any restored profile).
  let removed = 0;
  for (const c of users) {
    const { error } = await c.rpc('delete_current_user');
    if (!error) removed++;
  }
  console.log(`\ncleanup: ${removed} temporary users deleted (users already deleted by soft delete are skipped)`);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll recovery checks passed.');
process.exit(failures ? 1 : 0);
