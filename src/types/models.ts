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
 * Local account written by v2.2 and earlier (email/password log-in). Read once to carry
 * that user's habits and tasks over to the profile; never written any more.
 */
export type LegacyAccount = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type LocationSource = 'gps' | 'manual';

export type ProfileLocation = {
  /** Human-readable place, e.g. "Bhubaneswar, Odisha, India". The only location data kept. */
  label: string;
  /** How the label was obtained. GPS coordinates are used once on the device and never stored. */
  source: LocationSource;
};

/** The device owner's profile. Cached in AsyncStorage and backed up to Supabase. */
export type Profile = {
  /** Keys this device's habits, tasks and steps in local storage. */
  localId: string;
  fullName: string;
  email: string;
  /** Digits with an optional leading "+", no spaces. */
  mobile: string;
  age: number;
  location: ProfileLocation;
  /** ISO time the profile was first created. Never changes. */
  registeredAt: string;
  /** Object path in the Supabase `avatars` bucket, or null. */
  avatarPath: string | null;
  stepGoal: number;
  /** ISO time of the last local change (sync compares it with `cloud.syncedAt`). */
  updatedAt: string;
  /** ISO time of the last active interaction, synced with Supabase. */
  lastActiveAt?: string;
};

/** Cloud sync bookkeeping kept next to the profile. */
export type CloudState = {
  /** Anonymous Supabase user the data was last written for. */
  userId: string | null;
  /** `Profile.updatedAt` of the last successful profile upload. */
  syncedAt: string | null;
};

export type StepDay = { steps: number; goal: number };

/** One reading of Android's cumulative step counter (resets to 0 on reboot). */
export type StepSample = { t: number; counter: number; boot: number };

export type StepsState = {
  /** Steps per local calendar day. History is kept; a new day simply starts a new key. */
  days: Record<DateKey, StepDay>;
  /** Last Android counter reading already accounted for (null on iOS / before the first reading). */
  lastSample: StepSample | null;
  /** Days changed since the last successful upload. */
  unsynced: DateKey[];
  /** Cloud user the days were uploaded for; a different user means everything is re-uploaded. */
  cloudUserId: string | null;
};

/** Foreground time of one app over a period. */
export type AppUsage = { packageName: string; appName: string; usageMs: number };

export type SnakeSpeed = 'relaxed' | 'normal' | 'fast';

export type NotificationPreferences = {
  enabled: boolean;
  /** Format "HH:mm" in 24-hour time, e.g. "20:00" for 8:00 PM */
  dailyReminderTime: string;
  /** Alerts on Day 5 to prevent 7-day automatic account deletion */
  inactivityAlert: boolean;
};

export type Preferences = {
  appearance: 'system' | 'light' | 'dark';
  weekStartsOn: 0 | 1;
  snakeSpeed: SnakeSpeed;
  onboardingComplete: boolean;
  notifications: NotificationPreferences;
};
