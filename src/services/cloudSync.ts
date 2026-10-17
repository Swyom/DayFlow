import { parseRecoveryResult, RecoveryResult } from '../domain/recovery';
import type { Profile } from '../types/models';
import { AVATAR_BUCKET, ensureUserId, supabase } from './supabase';

/**
 * Reads and writes DayFlow's Supabase profiles and avatar bucket.
 * Every profile write is an upsert keyed 1:1 by auth.users id, so retries and repeated
 * syncs update rows in place and never create duplicate records. RLS on the server ensures
 * the authenticated user can only access their own profile and avatar files.
 */

function client() {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  return supabase;
}

const check = <T extends { error: unknown }>(res: T): T => {
  if (res.error) throw res.error;
  return res;
};

/** The email is already used by another profile (emails are unique; names are not). */
export class DuplicateProfileError extends Error {
  constructor(message = 'This email address is already in use by another profile.') {
    super(message);
    this.name = 'DuplicateProfileError';
  }
}

export function parseCloudError(err: unknown): Error {
  if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
    return new DuplicateProfileError();
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}

export const isCloudConfigured = () => !!supabase;

export { ensureUserId };

/**
 * Whether another profile already uses this email. Only signed-in (anonymous) users may ask,
 * and the answer is only "taken or not". If the check can't run, the unique index on the
 * server still rejects a duplicate when the profile is saved.
 */
export async function isEmailTaken(email: string, excludeUserId?: string | null): Promise<boolean> {
  if (!supabase) return false;
  try {
    await ensureUserId();
    const res = await client().rpc('check_profile_conflicts', {
      check_name: '',
      check_email: email.trim().toLowerCase(),
      exclude_user_id: excludeUserId || null,
    });
    if (res.error) return false;
    return !!(res.data as { email_taken?: boolean } | null)?.email_taken;
  } catch {
    return false;
  }
}

export async function upsertProfile(userId: string, p: Profile) {
  const res = await client()
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: p.fullName,
        email: p.email,
        mobile: p.mobile,
        age: p.age,
        location_label: p.location.label,
        location_source: p.location.source,
        avatar_path: p.avatarPath,
        step_goal: p.stepGoal,
        // Only used on the first insert; the database keeps the original value afterwards.
        registered_at: p.registeredAt,
      },
      { onConflict: 'id' },
    );
  if (res.error) throw parseCloudError(res.error);
}

/** Fetches the remote profile for the signed-in user if it exists in Supabase. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const db = client();
  const res = check(await db.from('profiles').select('*').eq('id', userId).maybeSingle());
  const data = res.data;
  if (!data) return null;
  return {
    localId: userId,
    fullName: data.full_name,
    email: data.email,
    mobile: data.mobile,
    age: data.age,
    location: {
      label: data.location_label,
      source: data.location_source,
    },
    registeredAt: data.registered_at,
    avatarPath: data.avatar_path,
    stepGoal: data.step_goal,
    updatedAt: data.updated_at,
  };
}

// ---- Profile picture (private bucket) ---------------------------------------------

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Uploads a JPEG to "<user id>/avatar-<time>.jpg" and returns its path. */
export async function uploadAvatar(userId: string, jpegBase64: string): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  check(
    await client()
      .storage.from(AVATAR_BUCKET)
      .upload(path, base64ToBytes(jpegBase64), { contentType: 'image/jpeg', upsert: false }),
  );
  return path;
}

export async function removeAvatarFiles(paths: string[]) {
  if (!paths.length) return;
  check(await client().storage.from(AVATAR_BUCKET).remove(paths));
}

/** Short-lived URL for showing the private image. */
export async function signedAvatarUrl(path: string): Promise<string> {
  const res = check(await client().storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60));
  if (!res.data?.signedUrl) throw new Error('No signed URL returned.');
  return res.data.signedUrl;
}

/**
 * Deletes everything this device stored in Supabase: avatar files, then the anonymous
 * auth user (the database cascades to the profile row).
 */
export async function deleteCloudAccount() {
  const db = client();
  const { data } = await db.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return; // never synced: nothing in the cloud
  const listed = check(await db.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 }));
  await removeAvatarFiles((listed.data ?? []).map((f) => `${userId}/${f.name}`));
  check(await db.rpc('delete_current_user'));
  await db.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

/**
 * Recoverable deletion: the server keeps the profile (not the photo) for 7 days in a table
 * no client can read, then deletes the anonymous auth user. Returns the retained record's
 * id and expiry, or nulls when there was no cloud profile to keep.
 */
export async function softDeleteCloudAccount(): Promise<{ deletionId: string | null; purgeAfter: string | null }> {
  const db = client();
  const { data } = await db.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return { deletionId: null, purgeAfter: null };
  // Check before touching anything: if the recovery migration isn't installed, nothing is
  // deleted and the person is offered permanent deletion instead.
  await assertRecoveryAvailable();
  const listed = check(await db.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 }));
  await removeAvatarFiles((listed.data ?? []).map((f) => `${userId}/${f.name}`));
  const res = check(await db.rpc('soft_delete_current_user'));
  await db.auth.signOut({ scope: 'local' }).catch(() => undefined);
  const out = (res.data ?? {}) as { deletion_id?: unknown; purge_after?: unknown };
  return {
    deletionId: typeof out.deletion_id === 'string' ? out.deletion_id : null,
    purgeAfter: typeof out.purge_after === 'string' ? out.purge_after : null,
  };
}

/** Thrown when recovery can't reach the server (offline, DNS, timeouts). */
export class CloudUnavailableError extends Error {}

/** Thrown when the server doesn't have recoverable deletion installed (migration not run). */
export class RecoveryUnavailableError extends Error {}

/** PostgREST: function not found (PGRST202) / Postgres: undefined function (42883). */
const isMissingFunction = (e: { code?: string } | null | undefined) => e?.code === 'PGRST202' || e?.code === '42883';

async function assertRecoveryAvailable() {
  const res = await client().rpc('recovery_status');
  if (!res.error) return;
  if (isMissingFunction(res.error)) throw new RecoveryUnavailableError('Recoverable deletion is not set up on the server.');
  if (!res.error.code) throw new CloudUnavailableError(res.error.message);
  throw res.error;
}

/**
 * Asks the server to restore a deleted profile onto this device's (new) anonymous user.
 * Matching, the 7-day window and the attempt limits are all decided server-side.
 */
export async function recoverDeletedProfile(email: string, mobile: string): Promise<RecoveryResult> {
  let res;
  try {
    await ensureUserId();
    res = await client().rpc('recover_deleted_profile', { p_email: email, p_mobile: mobile });
  } catch (e) {
    throw new CloudUnavailableError(e instanceof Error ? e.message : String(e));
  }
  if (res.error) {
    if (isMissingFunction(res.error)) throw new RecoveryUnavailableError('Profile recovery is not set up on the server.');
    // PostgREST/network failures carry no status code; database errors do.
    if (!res.error.code) throw new CloudUnavailableError(res.error.message);
    throw res.error;
  }
  return parseRecoveryResult(res.data);
}
