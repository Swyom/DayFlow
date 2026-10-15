import type { DateKey, Weekday } from '../types/models';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a key as local midnight (never UTC, so the weekday is stable). */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toDateKey(new Date());

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole days from `a` to `b` (positive when `b` is later). DST-safe via rounding. */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

export const weekdayOf = (key: DateKey) => fromDateKey(key).getDay() as Weekday;

/** Inclusive list of keys from `from` to `to`. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** The last `count` days ending with `end` (oldest first). */
export const lastNDays = (end: DateKey, count: number) => dateRange(addDays(end, -(count - 1)), end);

export function startOfWeek(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  const offset = (weekdayOf(key) - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

/** Weekday indexes ordered from the user's first day of week. */
export const orderedWeekdays = (weekStartsOn: 0 | 1): Weekday[] =>
  Array.from({ length: 7 }, (_, i) => ((i + weekStartsOn) % 7) as Weekday);

export const weekdayShort = (d: Weekday) => DAY_SHORT[d];
export const weekdayInitial = (d: Weekday) => DAY_SHORT[d][0];

/** "Monday, 12 October" */
export function formatLongDate(key: DateKey): string {
  const d = fromDateKey(key);
  return `${DAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
}

/** "Mon, 12 Oct" (adds the year when it differs from `today`). */
export function formatShortDate(key: DateKey, today: DateKey = todayKey()): string {
  const d = fromDateKey(key);
  const base = `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return key.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${d.getFullYear()}`;
}

export const formatMonthYear = (year: number, month: number) => `${MONTH_LONG[month]} ${year}`;

/** Human label for a due date relative to today. */
export function relativeDayLabel(key: DateKey, today: DateKey = todayKey()): string {
  const diff = diffDays(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatShortDate(key, today);
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Milliseconds until the next local midnight. */
export function msUntilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
