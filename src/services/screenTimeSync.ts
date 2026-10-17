import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/app';
import type { AppUsage, DateKey } from '../types/models';
import { upsertScreenTime } from './cloudSync';
import { readJSON, writeJSON } from './storage';

/** Uploads a day's screen time unless the same totals were already uploaded recently. */

type SyncLog = Record<DateKey, { totalMs: number; at: number }>;

/** Today keeps changing, so it is re-uploaded at most this often. */
const TODAY_INTERVAL_MS = 10 * 60_000;
const KEEP_DAYS = 60;

export async function uploadScreenTimeDays(
  localId: string,
  userId: string,
  days: { day: DateKey; apps: AppUsage[] }[],
  today: DateKey,
) {
  const key = STORAGE_KEYS.screenTimeSync(localId);
  const raw = await readJSON<SyncLog>(key).catch(() => null);
  const log: SyncLog = raw && typeof raw === 'object' ? raw : {};
  const now = Date.now();
  let changed = false;

  for (const { day, apps } of days) {
    const totalMs = apps.reduce((sum, a) => sum + a.usageMs, 0);
    const prev = log[day];
    const fresh = prev && (day === today ? now - prev.at < TODAY_INTERVAL_MS : prev.totalMs === totalMs);
    if (fresh) continue;
    await upsertScreenTime(userId, day, apps, Platform.OS === 'ios' ? 'ios' : 'android');
    log[day] = { totalMs, at: now };
    changed = true;
  }

  if (changed) {
    const kept = Object.keys(log).sort().slice(-KEEP_DAYS);
    await writeJSON(key, Object.fromEntries(kept.map((d) => [d, log[d]])));
  }
}
