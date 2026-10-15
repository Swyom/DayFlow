export const APP_NAME = 'DayFlow';
export const APP_VERSION = '2.1.0';

/** AsyncStorage keys. Bump the suffix when a stored shape changes incompatibly. */
export const STORAGE_KEYS = {
  preferences: 'dayflow:prefs:v1',
  accounts: 'dayflow:accounts:v1',
  /** Plain-text session used up to v2.1; migrated to SECURE_KEYS.session on launch. */
  legacySession: 'dayflow:session:v1',
  userData: (userId: string) => `dayflow:data:v1:${userId}`,
  /** Failed log-in counters (brute-force lock-out). */
  loginAttempts: 'dayflow:auth:attempts:v1',
} as const;

/**
 * expo-secure-store keys (Keychain / Keystore). Only [A-Za-z0-9._-] is allowed.
 * `session` replaces the plain AsyncStorage session used up to v2.1.
 */
export const SECURE_KEYS = {
  session: 'dayflow.session',
  credential: (userId: string) => `dayflow.credential.${userId}`,
} as const;

