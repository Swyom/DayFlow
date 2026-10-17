/**
 * Input limits shared by form validation, the data reducer and storage parsing,
 * so oversized values are rejected in the UI and clamped again before saving or
 * after loading (stored data is never trusted blindly).
 */
export const LIMITS = {
  name: 40,
  fullNameMin: 2,
  fullName: 60,
  email: 254,
  mobileInput: 20,
  ageMin: 13,
  ageMax: 120,
  location: 120,
  stepGoalMin: 500,
  stepGoalMax: 100_000,
  stepGoalDefault: 8000,
  /** Plausibility cap for one day's steps (matches the database constraint). */
  maxDailySteps: 200_000,
  habitUnit: 16,
  habitNotes: 280,
  habitTarget: 99,
  taskTitle: 120,
  taskNotes: 500,
  /** Sanity caps for stored collections and counters. */
  maxHabits: 500,
  maxTasks: 5000,
  maxCounter: 1_000_000,
} as const;
