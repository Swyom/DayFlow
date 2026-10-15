import { useMemo } from 'react';
import { completionOn, currentStreak, habitsDueOn, isDoneOn } from '../domain/habits';
import { isOpen, isOverdue, todaysTasks, compareOpen } from '../domain/tasks';
import { useData } from '../state/DataProvider';
import type { DateKey } from '../types/models';

/** Everything the Today dashboard needs, derived from stored data. */
export function useDailySummary(today: DateKey) {
  const { habits, tasks } = useData();
  return useMemo(() => {
    const habitDay = completionOn(habits, today);
    const taskDay = todaysTasks(tasks, today);
    const total = habitDay.due + taskDay.total;
    const done = habitDay.done + taskDay.done;

    const dueHabits = habitsDueOn(habits, today).sort(
      (a, b) => Number(isDoneOn(a, today)) - Number(isDoneOn(b, today)),
    );
    const openToday = tasks
      .filter((t) => isOpen(t) && (t.due === today || isOverdue(t, today)))
      .sort(compareOpen);

    return {
      habitDay,
      taskDay,
      progress: total ? done / total : 0,
      hasPlan: total > 0,
      bestStreak: habits.reduce((m, h) => Math.max(m, currentStreak(h, today)), 0),
      dueHabits,
      openToday,
      overdueCount: openToday.filter((t) => isOverdue(t, today)).length,
    };
  }, [habits, tasks, today]);
}
