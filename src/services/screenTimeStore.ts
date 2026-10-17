import { STORAGE_KEYS } from '../constants/app';
import { parseScreenTimeState } from '../state/schema';
import type { AppUsage, DateKey } from '../types/models';
import { readJSON, removeKey, writeJSON } from './storage';

/**
 * Persistent local storage for screen time and app usage.
 *
 * All screen time data is stored strictly on the user's device and is NEVER
 * uploaded, synced, or stored in Supabase or any remote database.
 * This guarantees privacy and keeps historical data available across app closes
 * and device restarts.
 */

export type StoredScreenTime = Record<DateKey, AppUsage[]>;

const MAX_SAVED_DAYS = 90;

/** Reads cached daily screen time from local AsyncStorage. */
export async function loadLocalScreenTime(localId: string): Promise<StoredScreenTime> {
  const raw = await readJSON<unknown>(STORAGE_KEYS.screenTime(localId)).catch(() => null);
  return parseScreenTimeState(raw);
}

/**
 * Saves and merges daily screen time entries into local AsyncStorage.
 * Prunes entries older than 90 days to avoid consuming unnecessary device storage.
 */
export async function saveLocalScreenTime(
  localId: string,
  days: { day: DateKey; apps: AppUsage[] }[],
): Promise<void> {
  if (!days.length) return;
  const existing = await loadLocalScreenTime(localId);
  for (const { day, apps } of days) {
    if (apps.length > 0 || !existing[day]) {
      existing[day] = apps;
    }
  }

  // Keep only the most recent 90 days.
  const sortedDays = Object.keys(existing).sort().slice(-MAX_SAVED_DAYS);
  const trimmed: StoredScreenTime = {};
  for (const day of sortedDays) {
    trimmed[day] = existing[day];
  }

  await writeJSON(STORAGE_KEYS.screenTime(localId), trimmed).catch((e) => {
    if (__DEV__) console.warn('[screenTimeStore] local save failed', e);
  });
}

/** Clears all screen time data stored locally for this user profile. */
export async function removeLocalScreenTime(localId: string): Promise<void> {
  await removeKey(STORAGE_KEYS.screenTime(localId));
}
