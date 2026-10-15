import type { DateKey, Priority, Task } from '../types/models';
import { addDays, relativeDayLabel, toDateKey } from '../utils/date';

export const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const isOpen = (t: Task) => t.completedAt === null;
export const isOverdue = (t: Task, today: DateKey) => isOpen(t) && t.due !== null && t.due < today;

export const completedOn = (t: Task): DateKey | null =>
  t.completedAt ? toDateKey(new Date(t.completedAt)) : null;

/** Open tasks: priority first, then earliest due date, then oldest. */
export function compareOpen(a: Task, b: Task): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

export type TaskSection = { key: string; title: string; tone?: 'danger'; data: Task[] };

export type TaskFilter = 'today' | 'upcoming' | 'done';

/** Groups tasks for the To-do list tabs. Empty sections are dropped. */
export function sectionTasks(tasks: Task[], filter: TaskFilter, today: DateKey): TaskSection[] {
  if (filter === 'done') {
    const done = tasks
      .filter((t) => !isOpen(t))
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return done.length ? [{ key: 'done', title: 'Completed', data: done }] : [];
  }

  const open = tasks.filter(isOpen).sort(compareOpen);

  if (filter === 'today') {
    return [
      { key: 'overdue', title: 'Overdue', tone: 'danger' as const, data: open.filter((t) => isOverdue(t, today)) },
      { key: 'today', title: 'Today', data: open.filter((t) => t.due === today) },
    ].filter((s) => s.data.length);
  }

  const tomorrow = addDays(today, 1);
  const future = open.filter((t) => t.due !== null && t.due > today);
  const byDay = new Map<DateKey, Task[]>();
  for (const t of future) byDay.set(t.due!, [...(byDay.get(t.due!) ?? []), t]);

  const sections: TaskSection[] = [...byDay.keys()].sort().map((day) => ({
    key: day,
    title: day === tomorrow ? 'Tomorrow' : relativeDayLabel(day, today),
    data: byDay.get(day)!,
  }));
  const someday = open.filter((t) => t.due === null);
  if (someday.length) sections.push({ key: 'someday', title: 'No date', data: someday });
  return sections;
}

export function countForFilter(tasks: Task[], filter: TaskFilter, today: DateKey): number {
  return sectionTasks(tasks, filter, today).reduce((n, s) => n + s.data.length, 0);
}

/** Tasks that belong to "today" for daily progress: due today (open or done) plus anything finished today. */
export function todaysTasks(tasks: Task[], today: DateKey) {
  const relevant = tasks.filter((t) => t.due === today || completedOn(t) === today);
  return { total: relevant.length, done: relevant.filter((t) => !isOpen(t)).length };
}

/** Which To-do tab a task appears under. */
export function filterForTask(task: Pick<Task, 'due' | 'completedAt'>, today: DateKey): TaskFilter {
  if (task.completedAt) return 'done';
  return task.due !== null && task.due <= today ? 'today' : 'upcoming';
}

/** Confirmation that says where a new task went, e.g. "Task added for tomorrow". */
export function describeAdded(due: DateKey | null, today: DateKey): string {
  if (due === null) return 'Task added to Upcoming (no date)';
  if (due < today) return 'Task added as overdue';
  if (due === today) return 'Task added for today';
  const label = relativeDayLabel(due, today);
  return `Task added for ${label === 'Tomorrow' ? 'tomorrow' : label}`;
}
