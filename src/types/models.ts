import type { AccentHue } from '../theme/palette';
import type { HabitIconName } from '../constants/habits';

/** Local calendar date in `YYYY-MM-DD` form. */
export type DateKey = string;

/** 0 = Sunday … 6 = Saturday (matches `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Habit = {
  id: string;
  name: string;
  icon: HabitIconName;
  hue: AccentHue;
  /** Check-ins needed per scheduled day (1 for simple yes/no habits). */
  target: number;
  /** Label for the target, e.g. "glasses" or "min". Empty for yes/no habits. */
  unit: string;
  days: Weekday[];
  notes: string;
  createdAt: DateKey;
  /** Check-in count per day. Days without check-ins are absent. */
  log: Record<DateKey, number>;
};

export type Priority = 'low' | 'medium' | 'high';

export type Task = {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  due: DateKey | null;
  /** ISO timestamp, null while open. */
  completedAt: string | null;
  createdAt: string;
};

export type SnakeStats = {
  bestScore: number;
  gamesPlayed: number;
  foodEaten: number;
};

export type UserData = {
  habits: Habit[];
  tasks: Task[];
  snake: SnakeStats;
};

/**
 * Profile record kept in AsyncStorage. The password credential (salted PBKDF2) is
 * stored separately in the OS keystore via expo-secure-store, never here.
 */
export type Account = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  /** Unsalted hash written by v2.1 and earlier; removed on the next successful log-in. */
  legacyPasswordHash?: string;
};

export type SnakeSpeed = 'relaxed' | 'normal' | 'fast';

export type Preferences = {
  appearance: 'system' | 'light' | 'dark';
  weekStartsOn: 0 | 1;
  snakeSpeed: SnakeSpeed;
  onboardingComplete: boolean;
};
