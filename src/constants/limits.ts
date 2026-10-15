/**
 * Input limits shared by form validation, the data reducer and storage parsing,
 * so oversized values are rejected in the UI and clamped again before saving or
 * after loading (stored data is never trusted blindly).
 */
export const LIMITS = {
  name: 40,
  email: 254,
  passwordMin: 8,
  /** Upper bound keeps password hashing time predictable. */
  passwordMax: 128,
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
