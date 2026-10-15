import { toHabitIcon } from '../constants/habits';
import { LIMITS } from '../constants/limits';
import { adjustLog } from '../domain/habits';
import { toAccentHue } from '../theme/palette';
import type { DateKey, Habit, Task, UserData } from '../types/models';
import { createId } from '../utils/id';
import { todayKey } from '../utils/date';
import { parseUserData } from './schema';

export type HabitInput = Pick<Habit, 'name' | 'icon' | 'hue' | 'target' | 'unit' | 'days' | 'notes'>;
export type TaskInput = Pick<Task, 'title' | 'notes' | 'priority' | 'due'>;

export type DataAction =
  | { type: 'habit/add'; input: HabitInput; id?: string }
  | { type: 'habit/update'; id: string; input: HabitInput }
  | { type: 'habit/delete'; id: string }
  | { type: 'habit/restore'; habit: Habit; index: number }
  | { type: 'habit/adjust'; id: string; day: DateKey; delta: number }
  | { type: 'task/add'; input: TaskInput; id?: string }
  | { type: 'task/update'; id: string; input: TaskInput }
  | { type: 'task/delete'; id: string }
  | { type: 'task/restore'; task: Task; index: number }
  | { type: 'task/toggle'; id: string; now: string }
  | { type: 'task/clearCompleted' }
  | { type: 'snake/record'; score: number }
  | { type: 'snake/reset' }
  | { type: 'data/reset' };

export const EMPTY_DATA: UserData = {
  habits: [],
  tasks: [],
  snake: { bestScore: 0, gamesPlayed: 0, foodEaten: 0 },
};

/**
 * Validates and normalises stored data: drops malformed entries, clamps values to
 * the editor limits, and migrates v2.0 values (Ionicons names, retired purple hues)
 * so older saves keep loading. See state/schema.ts.
 */
export function hydrateData(stored: unknown): UserData {
  return parseUserData(stored);
}

// Defence in depth: forms already validate, but the reducer clamps again so no
// caller can persist oversized or out-of-range values.
const sanitizeHabit = (input: HabitInput): HabitInput => ({
  ...input,
  icon: toHabitIcon(input.icon),
  hue: toAccentHue(input.hue),
  name: input.name.trim().slice(0, LIMITS.name),
  unit: input.unit.trim().slice(0, LIMITS.habitUnit),
  notes: input.notes.trim().slice(0, LIMITS.habitNotes),
  target: Math.min(LIMITS.habitTarget, Math.max(1, Math.round(input.target) || 1)),
  days: [...new Set(input.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b),
});

const sanitizeTask = (input: TaskInput): TaskInput => ({
  ...input,
  title: input.title.trim().slice(0, LIMITS.taskTitle),
  notes: input.notes.trim().slice(0, LIMITS.taskNotes),
});

const insertAt = <T,>(list: T[], index: number, item: T): T[] => {
  const i = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, i), item, ...list.slice(i)];
};

const mapHabit = (s: UserData, id: string, fn: (h: Habit) => Habit): UserData => ({
  ...s,
  habits: s.habits.map((h) => (h.id === id ? fn(h) : h)),
});

const mapTask = (s: UserData, id: string, fn: (t: Task) => Task): UserData => ({
  ...s,
  tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)),
});

export function dataReducer(state: UserData, action: DataAction): UserData {
  switch (action.type) {
    case 'habit/add':
      return {
        ...state,
        habits: [
          ...state.habits,
          { ...sanitizeHabit(action.input), id: action.id ?? createId('h_'), createdAt: todayKey(), log: {} },
        ],
      };
    case 'habit/update':
      return mapHabit(state, action.id, (h) => {
        const next = { ...h, ...sanitizeHabit(action.input) };
        // Lowering the target clamps existing check-ins so history stays consistent.
        const log: Habit['log'] = {};
        for (const [day, n] of Object.entries(h.log)) log[day] = Math.min(n, next.target);
        return { ...next, log };
      });
    case 'habit/delete':
      return { ...state, habits: state.habits.filter((h) => h.id !== action.id) };
    case 'habit/restore':
      if (state.habits.some((h) => h.id === action.habit.id)) return state;
      return { ...state, habits: insertAt(state.habits, action.index, action.habit) };
    case 'habit/adjust':
      return mapHabit(state, action.id, (h) => ({ ...h, log: adjustLog(h, action.day, action.delta) }));

    case 'task/add':
      return {
        ...state,
        tasks: [
          { ...sanitizeTask(action.input), id: action.id ?? createId('t_'), completedAt: null, createdAt: new Date().toISOString() },
          ...state.tasks,
        ],
      };
    case 'task/update':
      return mapTask(state, action.id, (t) => ({ ...t, ...sanitizeTask(action.input) }));
    case 'task/delete':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'task/restore':
      if (state.tasks.some((t) => t.id === action.task.id)) return state;
      return { ...state, tasks: insertAt(state.tasks, action.index, action.task) };
    case 'task/toggle':
      return mapTask(state, action.id, (t) => ({ ...t, completedAt: t.completedAt ? null : action.now }));
    case 'task/clearCompleted':
      return { ...state, tasks: state.tasks.filter((t) => t.completedAt === null) };

    case 'snake/record':
      return {
        ...state,
        snake: {
          bestScore: Math.max(state.snake.bestScore, action.score),
          gamesPlayed: state.snake.gamesPlayed + 1,
          foodEaten: state.snake.foodEaten + action.score,
        },
      };
    case 'snake/reset':
      return { ...state, snake: EMPTY_DATA.snake };
    case 'data/reset':
      return EMPTY_DATA;
    default:
      return state;
  }
}
