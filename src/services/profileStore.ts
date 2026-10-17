import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_SECURE_KEYS, STORAGE_KEYS } from '../constants/app';
import { parseCloudState, parseLegacyAccounts, parseProfile } from '../state/schema';
import type { CloudState, LegacyAccount, Profile } from '../types/models';
import { readSecureJSON, removeSecure } from './secureStorage';
import { readJSON, removeKey, writeJSON } from './storage';

/** Device-local copy of the profile. The app reads this first, so it opens offline. */
export const loadProfile = async (): Promise<Profile | null> => parseProfile(await readJSON<unknown>(STORAGE_KEYS.profile));
export const saveProfile = (profile: Profile) => writeJSON(STORAGE_KEYS.profile, profile);

export const loadCloudState = async (): Promise<CloudState> => parseCloudState(await readJSON<unknown>(STORAGE_KEYS.cloud));
export const saveCloudState = (cloud: CloudState) => writeJSON(STORAGE_KEYS.cloud, cloud);

/** User's last active timestamp (epoch ms) stored locally. */
export const loadLastActiveAt = async (): Promise<number | null> => {
  const raw = await readJSON<number>(STORAGE_KEYS.lastActiveAt);
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
};
export const saveLastActiveAt = (timestamp: number) => writeJSON(STORAGE_KEYS.lastActiveAt, timestamp);
export const clearLastActiveAt = () => removeKey(STORAGE_KEYS.lastActiveAt);

/** Persistent flag for pending inactivity deletion if network was unavailable. */
export const loadPendingInactivityPurge = async (): Promise<boolean> => {
  const flag = await readJSON<boolean>(STORAGE_KEYS.pendingInactivityPurge);
  return !!flag;
};
export const setPendingInactivityPurge = (pending: boolean) =>
  pending ? writeJSON(STORAGE_KEYS.pendingInactivityPurge, true) : removeKey(STORAGE_KEYS.pendingInactivityPurge);

/** Habits, tasks, steps and screen time stored for a profile on this device. */
export async function removeLocalActivity(localId: string) {
  await removeKey(STORAGE_KEYS.userData(localId));
  await removeKey(STORAGE_KEYS.steps(localId));
  await removeKey(STORAGE_KEYS.screenTime(localId));
}

/** Signs this device out of the profile (the activity data is handled separately). */
export async function removeProfileRecord() {
  await removeKey(STORAGE_KEYS.cloud);
  await removeKey(STORAGE_KEYS.profile);
  await clearLastActiveAt();
  await setPendingInactivityPurge(false);
}

/** Deletes the profile and everything stored for it on this device. */
export async function removeLocalProfile(localId: string) {
  await removeLocalActivity(localId);
  await removeProfileRecord();
}

/**
 * Complete, atomic local user data cleanup for the 7-day inactivity policy or permanent deletion.
 * Clears profile, cloud sync state, activity, habits, tasks, steps, screen time, and any cached keys.
 * Preserves general device settings (e.g. appearance theme).
 */
export async function clearAllUserData(localId?: string) {
  if (localId) {
    await removeLocalActivity(localId).catch(() => undefined);
  }
  await removeProfileRecord().catch(() => undefined);

  // Deep sweep of AsyncStorage: removes any remaining user-specific entries
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter(
      (k) =>
        k.startsWith('dayflow:data:') ||
        k.startsWith('dayflow:steps:') ||
        k.startsWith('dayflow:screentime:') ||
        k === 'dayflow:recovery-archive:v1' ||
        k === STORAGE_KEYS.profile ||
        k === STORAGE_KEYS.cloud ||
        k === STORAGE_KEYS.lastActiveAt ||
        k === STORAGE_KEYS.pendingInactivityPurge,
    );
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch {
    // Fallback: primary keys already removed
  }
}

// ---- Upgrade from the removed email/password log-in (≤ v2.1) ----------------------

/**
 * The account that was signed in (or the only account on the device) before log-in was
 * removed. Its id becomes the profile's `localId`, so its habits, tasks and scores stay.
 */
export async function findLegacyAccount(): Promise<LegacyAccount | null> {
  const accounts = parseLegacyAccounts(await readJSON<unknown>(STORAGE_KEYS.legacyAccounts));
  if (!accounts.length) return null;
  const secure = await readSecureJSON<{ userId?: unknown }>(LEGACY_SECURE_KEYS.session).catch(() => null);
  const plain = await readJSON<{ userId?: unknown }>(STORAGE_KEYS.legacySession).catch(() => null);
  const sessionId = secure?.userId ?? plain?.userId;
  return accounts.find((a) => a.id === sessionId) ?? (accounts.length === 1 ? accounts[0] : null);
}

/** Removes the old accounts list, sessions and password hashes (no longer used). */
export async function clearLegacyAuth() {
  const accounts = parseLegacyAccounts(await readJSON<unknown>(STORAGE_KEYS.legacyAccounts).catch(() => null));
  await Promise.all([
    ...accounts.map((a) => removeSecure(LEGACY_SECURE_KEYS.credential(a.id)).catch(() => undefined)),
    removeSecure(LEGACY_SECURE_KEYS.session).catch(() => undefined),
    removeKey(STORAGE_KEYS.legacySession),
    removeKey(STORAGE_KEYS.legacyLoginAttempts),
    removeKey(STORAGE_KEYS.legacyAccounts),
  ]);
}
