import { toHabitIcon } from '../constants/habits';
import { LIMITS } from '../constants/limits';
import { toAccentHue } from '../theme/palette';
import { clampGoal } from '../domain/steps';
import type {
  AppUsage,
  CloudState,
  DateKey,
  Habit,
  LegacyAccount,
  LocationSource,
  Preferences,
  Priority,
  Profile,
  SnakeStats,
  StepDay,
  StepSample,
  StepsState,
  Task,
  UserData,
  Weekday,
} from '../types/models';

/**
 * Parsers for everything read back from device storage. Storage can be damaged or
 * edited outside the app (rooted device, restored backup), so values are type-checked,
 * clamped to the same limits the UI enforces, and malformed entries are dropped
 * instead of reaching the UI, where they could crash a screen.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[^\s]{1,100}$/;

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback);
const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
const dateKey = (v: unknown): DateKey | null => (typeof v === 'string' && DATE_KEY.test(v) ? v : null);
const isoTime = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
const id = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

function parseHabit(raw: unknown): Habit | null {
  if (!isObj(raw)) return null;
  const habitId = id(raw.id);
  const name = str(raw.name, LIMITS.name).trim();
  if (!habitId || !name) return null;
  const target = int(raw.target, 1, LIMITS.habitTarget, 1);
  const days = [...new Set(list(raw.days, 7).filter((d): d is Weekday => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort();
  const log: Habit['log'] = {};
  if (isObj(raw.log)) {
    for (const [day, n] of Object.entries(raw.log)) {
      const count = int(n, 0, target, 0);
      if (dateKey(day) && count > 0) log[day] = count;
    }
  }
  return {
    id: habitId,
    name,
    icon: toHabitIcon(str(raw.icon, 64)),
    hue: toAccentHue(str(raw.hue, 32)),
    target,
    unit: str(raw.unit, LIMITS.habitUnit),
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    notes: str(raw.notes, LIMITS.habitNotes),
    createdAt: dateKey(raw.createdAt) ?? '1970-01-01',
    log,
  };
}

const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high'];

function parseTask(raw: unknown): Task | null {
  if (!isObj(raw)) return null;
  const taskId = id(raw.id);
  const title = str(raw.title, LIMITS.taskTitle).trim();
  if (!taskId || !title) return null;
  return {
    id: taskId,
    title,
    notes: str(raw.notes, LIMITS.taskNotes),
    priority: PRIORITIES.includes(raw.priority as Priority) ? (raw.priority as Priority) : 'medium',
    due: dateKey(raw.due),
    completedAt: isoTime(raw.completedAt),
    createdAt: isoTime(raw.createdAt) ?? new Date(0).toISOString(),
  };
}

function parseSnake(raw: unknown): SnakeStats {
  const s = isObj(raw) ? raw : {};
  return {
    bestScore: int(s.bestScore, 0, LIMITS.maxCounter, 0),
    gamesPlayed: int(s.gamesPlayed, 0, LIMITS.maxCounter, 0),
    foodEaten: int(s.foodEaten, 0, LIMITS.maxCounter, 0),
  };
}

/** Drops entries whose id repeats an earlier one (a duplicated id would break list keys and edits). */
function uniqueById<T extends { id: string }>(items: (T | null)[]): T[] {
  const seen = new Set<string>();
  return items.filter((item): item is T => !!item && !seen.has(item.id) && !!seen.add(item.id));
}

export function parseUserData(raw: unknown): UserData {
  const data = isObj(raw) ? raw : {};
  return {
    habits: uniqueById(list(data.habits, LIMITS.maxHabits).map(parseHabit)),
    tasks: uniqueById(list(data.tasks, LIMITS.maxTasks).map(parseTask)),
    snake: parseSnake(data.snake),
  };
}

export function parsePreferences(raw: unknown, defaults: Preferences): Preferences {
  const p = isObj(raw) ? raw : {};
  return {
    appearance: p.appearance === 'light' || p.appearance === 'dark' || p.appearance === 'system' ? p.appearance : defaults.appearance,
    weekStartsOn: p.weekStartsOn === 0 || p.weekStartsOn === 1 ? p.weekStartsOn : defaults.weekStartsOn,
    snakeSpeed: p.snakeSpeed === 'relaxed' || p.snakeSpeed === 'normal' || p.snakeSpeed === 'fast' ? p.snakeSpeed : defaults.snakeSpeed,
    onboardingComplete: typeof p.onboardingComplete === 'boolean' ? p.onboardingComplete : defaults.onboardingComplete,
  };
}

/** Accounts from the old email/password log-in (only id, name and email are still used). */
export function parseLegacyAccounts(raw: unknown): LegacyAccount[] {
  return uniqueById(
    list(raw, 100).map((a): LegacyAccount | null => {
      if (!isObj(a)) return null;
      const accountId = id(a.id);
      const email = str(a.email, LIMITS.email).trim().toLowerCase();
      if (!accountId || !email) return null;
      return {
        id: accountId,
        name: str(a.name, LIMITS.name).trim(),
        email,
        createdAt: isoTime(a.createdAt) ?? new Date(0).toISOString(),
      };
    }),
  );
}

const finite = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

/** The stored profile, or null if it is missing or unusable (the user is asked to set it up again). */
export function parseProfile(raw: unknown): Profile | null {
  if (!isObj(raw)) return null;
  const localId = id(raw.localId);
  const fullName = str(raw.fullName, LIMITS.fullName).trim();
  const email = str(raw.email, LIMITS.email).trim().toLowerCase();
  const mobile = str(raw.mobile, LIMITS.mobileInput).trim();
  const age = finite(raw.age, LIMITS.ageMin, LIMITS.ageMax);
  const registeredAt = isoTime(raw.registeredAt);
  const loc = isObj(raw.location) ? raw.location : null;
  const label = loc ? str(loc.label, LIMITS.location).trim() : '';
  if (!localId || !fullName || !email || !/^\+?\d{7,15}$/.test(mobile) || age === null || !registeredAt || !loc || !label) {
    return null;
  }
  // Older versions also stored GPS coordinates; they are dropped here and never written again.
  const source: LocationSource = loc.source === 'gps' ? 'gps' : 'manual';
  const avatarPath = typeof raw.avatarPath === 'string' && /^[\w-]+\/[\w.-]{1,200}$/.test(raw.avatarPath) ? raw.avatarPath : null;
  return {
    localId,
    fullName,
    email,
    mobile,
    age: Math.round(age),
    location: { label, source },
    registeredAt,
    avatarPath,
    stepGoal: clampGoal(typeof raw.stepGoal === 'number' ? raw.stepGoal : LIMITS.stepGoalDefault),
    updatedAt: isoTime(raw.updatedAt) ?? registeredAt,
    lastActiveAt: isoTime(raw.lastActiveAt) ?? undefined,
  };
}

export function parseCloudState(raw: unknown): CloudState {
  const c = isObj(raw) ? raw : {};
  return {
    userId: typeof c.userId === 'string' && /^[0-9a-f-]{36}$/i.test(c.userId) ? c.userId : null,
    syncedAt: isoTime(c.syncedAt),
  };
}

function parseSample(raw: unknown): StepSample | null {
  if (!isObj(raw)) return null;
  const t = finite(raw.t, 0, Number.MAX_SAFE_INTEGER);
  const counter = finite(raw.counter, 0, Number.MAX_SAFE_INTEGER);
  const boot = finite(raw.boot, -1, Number.MAX_SAFE_INTEGER);
  return t !== null && counter !== null && boot !== null ? { t, counter, boot } : null;
}

export function parseStepsState(raw: unknown): StepsState {
  const s = isObj(raw) ? raw : {};
  const days: Record<DateKey, StepDay> = {};
  if (isObj(s.days)) {
    for (const [day, v] of Object.entries(s.days)) {
      if (!dateKey(day) || !isObj(v)) continue;
      days[day] = { steps: int(v.steps, 0, LIMITS.maxDailySteps, 0), goal: clampGoal(typeof v.goal === 'number' ? v.goal : LIMITS.stepGoalDefault) };
    }
  }
  const unsynced = [...new Set(list(s.unsynced, 3660).filter((d): d is DateKey => typeof d === 'string' && !!dateKey(d) && d in days))];
  const cloudUserId = typeof s.cloudUserId === 'string' && /^[0-9a-f-]{36}$/i.test(s.cloudUserId) ? s.cloudUserId : null;
  return { days, lastSample: parseSample(s.lastSample), unsynced, cloudUserId };
}

/** Parses persistent local screen-time history read from device storage. */
export function parseScreenTimeState(raw: unknown): Record<DateKey, AppUsage[]> {
  if (!isObj(raw)) return {};
  const out: Record<DateKey, AppUsage[]> = {};
  for (const [day, listRaw] of Object.entries(raw)) {
    if (!dateKey(day) || !Array.isArray(listRaw)) continue;
    const apps: AppUsage[] = [];
    for (const a of listRaw) {
      if (!isObj(a)) continue;
      const packageName = str(a.packageName, 255).trim();
      const usageMs = int(a.usageMs, 0, 86_400_000, 0);
      if (!packageName || usageMs <= 0) continue;
      apps.push({
        packageName,
        appName: str(a.appName, 255).trim() || packageName,
        usageMs,
      });
    }
    if (apps.length > 0) out[day] = apps;
  }
  return out;
}
