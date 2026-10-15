import type { DateKey, UserData } from '../types/models';
import { completionOn, completionRate, currentStreak, habitRate, bestStreak } from './habits';
import { completedOn } from './tasks';

export type DayStat = { day: DateKey; habitRate: number; habitsDue: number; tasksDone: number };

/** Aggregates for the Progress screen over an inclusive list of days. */
export function rangeStats({ habits, tasks }: UserData, days: DateKey[], today: DateKey) {
  const inRange = new Set(days);
  const tasksPerDay = new Map<DateKey, number>();
  for (const t of tasks) {
    const d = completedOn(t);
    if (d && inRange.has(d)) tasksPerDay.set(d, (tasksPerDay.get(d) ?? 0) + 1);
  }

  let checkIns = 0;
  for (const h of habits) for (const d of days) checkIns += h.log[d] ?? 0;

  const perDay: DayStat[] = days.map((day) => {
    const c = completionOn(habits, day);
    return { day, habitRate: c.rate, habitsDue: c.due, tasksDone: tasksPerDay.get(day) ?? 0 };
  });

  const perHabit = habits
    .map((h) => ({ habit: h, rate: habitRate(h, days), streak: currentStreak(h, today), best: bestStreak(h, today) }))
    .sort((a, b) => b.rate - a.rate);

  return {
    perDay,
    perHabit,
    habitRate: completionRate(habits, days),
    checkIns,
    tasksDone: [...tasksPerDay.values()].reduce((a, b) => a + b, 0),
    topStreak: perHabit.reduce((m, h) => Math.max(m, h.streak), 0),
  };
}
