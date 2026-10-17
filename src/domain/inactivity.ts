/**
 * DayFlow 7-Day Inactivity Policy Domain Logic
 *
 * Rules:
 * 1. If a user has not used the app for 7 consecutive days (604,800,000 ms), their account
 *    profile and associated data in Supabase and AsyncStorage are permanently deleted.
 * 2. Activity is tracked whenever the user actively uses the app (foreground, navigation,
 *    completing tasks, updating habits, step counting, etc.).
 * 3. Calculation uses timestamps rather than app launches alone.
 * 4. Robust against device clock changes:
 *    - If device clock jumps backward (now < lastActiveAt), inactivity is never triggered.
 *    - Server-provided timestamps reconcile clock skew whenever connectivity is available.
 * 5. Short app closures and active user sessions never trigger deletion.
 */

export const INACTIVITY_DAYS = 7;
export const INACTIVITY_WINDOW_MS = INACTIVITY_DAYS * 24 * 60 * 60 * 1000; // 604,800,000 ms

/** Heartbeat throttle: sync last_active_at with Supabase at most once every 15 minutes */
export const HEARTBEAT_THROTTLE_MS = 15 * 60 * 1000; // 900,000 ms

/**
 * Parses a timestamp (ISO string, epoch ms, or Date) into valid epoch milliseconds.
 * Returns null if the value is missing, NaN, or non-finite.
 */
export function parseTimestamp(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (val instanceof Date) {
    const time = val.getTime();
    return Number.isFinite(time) && time > 0 ? time : null;
  }
  return null;
}

/**
 * Checks whether an account is inactive for >= 7 consecutive days.
 *
 * @param lastActiveAt The timestamp of the user's last recorded active interaction.
 * @param referenceTime The current authoritative time (server time or trusted client now).
 */
export function isInactive(
  lastActiveAt: unknown,
  referenceTime = Date.now(),
): boolean {
  const lastActive = parseTimestamp(lastActiveAt);
  if (!lastActive) return false;

  // Clock anomaly protection: device clock set behind last active timestamp
  if (referenceTime < lastActive) {
    return false;
  }

  const elapsed = referenceTime - lastActive;
  return elapsed >= INACTIVITY_WINDOW_MS;
}

/**
 * Calculates the exact duration (in milliseconds) the account has been inactive.
 * Returns 0 if clock skew is detected or timestamp is invalid.
 */
export function getInactivityElapsedMs(
  lastActiveAt: unknown,
  referenceTime = Date.now(),
): number {
  const lastActive = parseTimestamp(lastActiveAt);
  if (!lastActive || referenceTime < lastActive) return 0;
  return referenceTime - lastActive;
}

/**
 * Calculates remaining milliseconds before the 7-day inactivity threshold is reached.
 * Returns 0 if already inactive.
 */
export function getRemainingActiveMs(
  lastActiveAt: unknown,
  referenceTime = Date.now(),
): number {
  const elapsed = getInactivityElapsedMs(lastActiveAt, referenceTime);
  return Math.max(0, INACTIVITY_WINDOW_MS - elapsed);
}

/**
 * Determines if a new heartbeat should be sent to Supabase to update `last_active_at`.
 */
export function shouldSendHeartbeat(
  lastHeartbeatSentAt: unknown,
  now = Date.now(),
): boolean {
  const last = parseTimestamp(lastHeartbeatSentAt);
  if (!last) return true;
  if (now < last) return true; // Clock jumped or reset
  return now - last >= HEARTBEAT_THROTTLE_MS;
}
