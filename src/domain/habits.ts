import type { DateKey, Habit, Weekday } from '../types/models';
import { addDays, orderedWeekdays, weekdayOf, weekdayShort } from '../utils/date';

export const isScheduledOn = (habit: Habit, day: DateKey) => habit.days.includes(weekdayOf(day));

export const countOn = (habit: Habit, day: DateKey) => habit.log[day] ?? 0;

export const isDoneOn = (habit: Habit, day: DateKey) => countOn(habit, day) >= habit.target;

/** First day that counts towards history: creation or the earliest back-filled check-in. */
export function historyStart(habit: Habit): DateKey {
  let start = habit.createdAt;
  for (const key of Object.keys(habit.log)) if (key < start) start = key;
  return start;
}

/**
 * Consecutive completed scheduled days ending today. Unscheduled days are skipped
 * (they never break a streak) and today only counts once it is done, so an
 * unfinished today doesn't reset the streak before the day is over.
 */
export function currentStreak(habit: Habit, today: DateKey): number {
  const start = historyStart(habit);
  let streak = 0;
  for (let day = today; day >= start; day = addDays(day, -1)) {
    if (!isScheduledOn(habit, day)) continue;
    if (isDoneOn(habit, day)) streak++;
    else if (day !== today) break;
  }
  return streak;
}

export function bestStreak(habit: Habit, today: DateKey): number {
  let best = 0;
  let run = 0;
  for (let day = historyStart(habit); day <= today; day = addDays(day, 1)) {
    if (!isScheduledOn(habit, day)) continue;
    if (isDoneOn(habit, day)) {
      run++;
      if (run > best) best = run;
    } else if (day !== today) {
      run = 0;
    }
  }
  return best;
}

/** Habits that exist and are scheduled on `day`. */
export const habitsDueOn = (habits: Habit[], day: DateKey) =>
  habits.filter((h) => historyStart(h) <= day && isScheduledOn(h, day));

export type DayCompletion = { due: number; done: number; rate: number };

export function completionOn(habits: Habit[], day: DateKey): DayCompletion {
  const due = habitsDueOn(habits, day);
  const done = due.filter((h) => isDoneOn(h, day)).length;
  return { due: due.length, done, rate: due.length ? done / due.length : 0 };
}

/** Share of scheduled habit-days completed across `days` (0 when nothing was due). */
export function completionRate(habits: Habit[], days: DateKey[]): number {
  let due = 0;
  let done = 0;
  for (const day of days) {
    const c = completionOn(habits, day);
    due += c.due;
    done += c.done;
  }
  return due ? done / due : 0;
}

/** Single-habit rate across the given days. */
export function habitRate(habit: Habit, days: DateKey[]): number {
  const start = historyStart(habit);
  const due = days.filter((d) => d >= start && isScheduledOn(habit, d));
  if (!due.length) return 0;
  return due.filter((d) => isDoneOn(habit, d)).length / due.length;
}

export function totalCheckIns(habits: Habit[]): number {
  let total = 0;
  for (const h of habits) for (const v of Object.values(h.log)) total += v;
  return total;
}

/** Number of days on which every habit due that day was completed. */
export function perfectDays(habits: Habit[], today: DateKey): number {
  if (!habits.length) return 0;
  const start = habits.map(historyStart).sort()[0];
  let count = 0;
  for (let day = start; day <= today; day = addDays(day, 1)) {
    const c = completionOn(habits, day);
    if (c.due > 0 && c.done === c.due) count++;
  }
  return count;
}

/** Applies a check-in delta, clamped to [0, target]. Returns a new log. */
export function adjustLog(habit: Habit, day: DateKey, delta: number): Habit['log'] {
  const next = Math.max(0, Math.min(habit.target, countOn(habit, day) + delta));
  const log = { ...habit.log };
  if (next === 0) delete log[day];
  else log[day] = next;
  return log;
}

export function describeSchedule(days: Weekday[], weekStartsOn: 0 | 1 = 1): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d as Weekday))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return orderedWeekdays(weekStartsOn)
    .filter((d) => set.has(d))
    .map(weekdayShort)
    .join(', ');
}

export function describeTarget(habit: Pick<Habit, 'target' | 'unit'>): string {
  if (habit.target <= 1 && !habit.unit) return 'Once a day';
  return `${habit.target} ${habit.unit || (habit.target === 1 ? 'time' : 'times')} a day`;
}
