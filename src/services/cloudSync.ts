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

export const isCloudConfigured = () => !!supabase;

export { ensureUserId };

export async function upsertProfile(userId: string, p: Profile) {
  check(
    await client()
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: p.fullName,
          email: p.email,
          mobile: p.mobile,
          age: p.age,
          location_label: p.location.label,
          latitude: p.location.latitude,
          longitude: p.location.longitude,
          location_source: p.location.source,
          avatar_path: p.avatarPath,
          step_goal: p.stepGoal,
          // Only used on the first insert; the database keeps the original value afterwards.
          registered_at: p.registeredAt,
        },
        { onConflict: 'id' },
      ),
  );
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
      latitude: data.latitude,
      longitude: data.longitude,
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
