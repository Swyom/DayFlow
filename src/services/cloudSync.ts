import {
  DuplicateProfileError,
  parseCloudError,
  ProfileConflicts,
  RateLimitError,
} from '../domain/cloudErrors';
import type { Profile } from '../types/models';
import { AVATAR_BUCKET, ensureUserId, supabase } from './supabase';

export {
  DuplicateProfileError,
  parseCloudError,
  ProfileConflicts,
  RateLimitError,
};

function client() {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  return supabase;
}

const check = <T extends { error: unknown }>(res: T): T => {
  if (res.error) throw res.error;
  return res;
};

export const isCloudConfigured = () => !!supabase;

export { ensureUserId };

/**
 * Checks if the full name, email address, or mobile number is already in use by an existing account.
 * Signed-in (anonymous) users only.
 */
export async function checkProfileConflicts(
  name: string,
  email: string,
  mobile: string,
  excludeUserId?: string | null,
): Promise<ProfileConflicts> {
  if (!supabase) return { nameTaken: false, emailTaken: false, mobileTaken: false, conflict: false };
  try {
    await ensureUserId();
    const res = await client().rpc('check_profile_conflicts', {
      check_name: name.trim(),
      check_email: email.trim().toLowerCase(),
      check_mobile: mobile.trim(),
      exclude_user_id: excludeUserId || null,
    });
    if (res.error) return { nameTaken: false, emailTaken: false, mobileTaken: false, conflict: false };
    const data = res.data as { name_taken?: boolean; email_taken?: boolean; mobile_taken?: boolean; conflict?: boolean } | null;
    return {
      nameTaken: !!data?.name_taken,
      emailTaken: !!data?.email_taken,
      mobileTaken: !!data?.mobile_taken,
      conflict: !!(data?.conflict ?? (data?.name_taken || data?.email_taken || data?.mobile_taken)),
    };
  } catch {
    return { nameTaken: false, emailTaken: false, mobileTaken: false, conflict: false };
  }
}

/** Whether another profile already uses this email. */
export async function isEmailTaken(email: string, excludeUserId?: string | null): Promise<boolean> {
  const conflicts = await checkProfileConflicts('', email, '', excludeUserId);
  return conflicts.emailTaken;
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
        registered_at: p.registeredAt,
        last_active_at: p.lastActiveAt ?? new Date().toISOString(),
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
    lastActiveAt: data.last_active_at ?? undefined,
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
 * Activity heartbeat: updates last_active_at in Supabase and returns server timestamp.
 */
export async function touchProfileActivity(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const res = await client().rpc('touch_profile_activity');
    if (res.error) return null;
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * Deletes everything this user stored in Supabase: avatar files in storage,
 * then the auth user (the database cascades to the profile row).
 */
export async function deleteCloudAccount() {
  const db = client();
  const { data } = await db.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return; // never synced: nothing in the cloud
  try {
    const listed = await db.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
    if (listed.data && listed.data.length > 0) {
      await removeAvatarFiles(listed.data.map((f: { name: string }) => `${userId}/${f.name}`)).catch(() => undefined);
    }
  } catch {
    // Storage cleanup error shouldn't block user deletion
  }
  check(await db.rpc('delete_current_user'));
  await db.auth.signOut({ scope: 'local' }).catch(() => undefined);
}
