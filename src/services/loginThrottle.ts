/**
 * Brute-force protection for log-in: a few free attempts, then an exponentially
 * growing lock-out per email. Pure functions so the policy is unit-tested; the
 * state is persisted by services/auth.ts so restarting the app does not reset it.
 */
export type AttemptState = { failures: number; lockedUntil: number };

export const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

export const NO_ATTEMPTS: AttemptState = { failures: 0, lockedUntil: 0 };

/** Milliseconds left before another attempt is allowed (0 = allowed now). */
export const lockRemaining = (state: AttemptState, now: number) => Math.max(0, state.lockedUntil - now);

export function recordFailure(state: AttemptState, now: number): AttemptState {
  const failures = state.failures + 1;
  if (failures < FREE_ATTEMPTS) return { failures, lockedUntil: 0 };
  const lock = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** (failures - FREE_ATTEMPTS));
  return { failures, lockedUntil: now + lock };
}

export function describeWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
