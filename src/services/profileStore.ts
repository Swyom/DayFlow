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

/** Deletes the profile and everything stored for it on this device. */
export async function removeLocalProfile(localId: string) {
  await removeKey(STORAGE_KEYS.userData(localId));
  await removeKey(STORAGE_KEYS.steps(localId));
  await removeKey(STORAGE_KEYS.screenTimeSync(localId));
  await removeKey(STORAGE_KEYS.cloud);
  await removeKey(STORAGE_KEYS.profile);
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
