export const APP_NAME = 'DayFlow';
export const APP_VERSION = '2.2.0';

/** AsyncStorage keys. Bump the suffix when a stored shape changes incompatibly. */
export const STORAGE_KEYS = {
  preferences: 'dayflow:prefs:v1',
  /** The device owner's profile (see services/profileStore.ts). */
  profile: 'dayflow:profile:v1',
  /** Cloud sync bookkeeping for the profile. */
  cloud: 'dayflow:cloud:v1',
  /** Timestamp of the user's last active app interaction (see domain/inactivity.ts). */
  lastActiveAt: 'dayflow:last-active:v1',
  /** Flag indicating that 7-day inactivity was triggered and cloud account deletion is pending. */
  pendingInactivityPurge: 'dayflow:pending-purge:v1',
  userData: (localId: string) => `dayflow:data:v1:${localId}`,
  steps: (localId: string) => `dayflow:steps:v1:${localId}`,
  /** Persistent local screen-time history (keeps daily summaries on device across restarts). */
  screenTime: (localId: string) => `dayflow:screentime:v1:${localId}`,

  // Removed email/password log-in (≤ v2.1). Read once to carry data over, then deleted.
  legacyAccounts: 'dayflow:accounts:v1',
  legacySession: 'dayflow:session:v1',
  legacyLoginAttempts: 'dayflow:auth:attempts:v1',
} as const;

/** expo-secure-store keys used by the removed log-in (≤ v2.1). Only cleaned up now. */
export const LEGACY_SECURE_KEYS = {
  session: 'dayflow.session',
  credential: (userId: string) => `dayflow.credential.${userId}`,
} as const;

