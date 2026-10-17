import type { AppUsage, DateKey, Profile } from '../types/models';
import { AVATAR_BUCKET, ensureUserId, supabase } from './supabase';

/**
 * Reads and writes DayFlow's Supabase tables. Every write is an upsert keyed by the
 * table's primary key (profile id, user+day, user+day+app), so retries and repeated
 * syncs update rows in place and never create duplicates. RLS on the server makes sure
 * the signed-in anonymous user can only touch their own rows.
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

export type RemoteStepDay = { day: DateKey; steps: number; goal: number };

export async function upsertStepDays(userId: string, days: RemoteStepDay[]) {
  if (!days.length) return;
  check(
    await client()
      .from('daily_steps')
      .upsert(
        days.map((d) => ({ user_id: userId, day: d.day, steps: d.steps, goal: d.goal })),
        { onConflict: 'user_id,day' },
      ),
  );
}

export async function fetchStepDays(userId: string, fromDay: DateKey): Promise<RemoteStepDay[]> {
  const res = check(
    await client().from('daily_steps').select('day, steps, goal').eq('user_id', userId).gte('day', fromDay).order('day'),
  );
  return (res.data ?? []) as RemoteStepDay[];
}

/** Replaces one day's screen-time summary. */
export async function upsertScreenTime(userId: string, day: DateKey, apps: AppUsage[], platform: 'android' | 'ios') {
  const db = client();
  const totalMs = apps.reduce((sum, a) => sum + a.usageMs, 0);
  check(
    await db.from('screen_time_summaries').upsert(
      {
        user_id: userId,
        day,
        total_ms: Math.min(totalMs, 86_400_000),
        app_count: apps.length,
        platform,
        captured_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' },
    ),
  );
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
 * auth user (the database cascades to the profile, steps and screen-time rows).
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
