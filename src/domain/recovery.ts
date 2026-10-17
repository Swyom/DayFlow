import type { RecoveryArchive } from '../types/models';
import { normalizeMobile, validateMobile } from './profile';
import { normalizeEmail, validateEmail } from '../utils/validation';

/**
 * Account recovery rules shared by the app and its tests. The real checks (matching the
 * deleted profile, the 7-day window and the attempt limits) happen on the server in
 * recover_deleted_profile(); these only keep obviously bad input from being sent.
 */

/** Deleted profiles can be restored for this long (must match the database migration). */
export const RECOVERY_DAYS = 7;
export const RECOVERY_WINDOW_MS = RECOVERY_DAYS * 24 * 60 * 60 * 1000;

export const RECOVERY_MESSAGES = {
  notFound: 'Account not found. Please check your details or create a new account.',
  rateLimited: 'You have reached the maximum number of recovery attempts. Please try again tomorrow.',
  offline: 'You’re offline. Connect to the internet to restore your account.',
  failed: 'Couldn’t reach DayFlow’s servers. Nothing was changed. Please try again.',
  unavailable: 'Restoring deleted profiles isn’t available right now. Please try again later or create a new profile.',
} as const;

export type RecoveryErrors = { email?: string; mobile?: string };

export function validateRecoveryInput(email: string, mobile: string): RecoveryErrors {
  const errors: RecoveryErrors = {};
  const e = validateEmail(email);
  const m = validateMobile(mobile);
  if (e) errors.email = e;
  if (m) errors.mobile = m;
  return errors;
}

export const cleanRecoveryInput = (email: string, mobile: string) => ({
  email: normalizeEmail(email),
  mobile: normalizeMobile(mobile),
});

/** Server answer from recover_deleted_profile(). Anything unexpected counts as "not found". */
export type RecoveryResult =
  | { status: 'restored'; deletionId: string }
  | { status: 'not_found' }
  | { status: 'rate_limited'; retryAfter: string | null }
  | { status: 'has_profile' };

export function parseRecoveryResult(raw: unknown): RecoveryResult {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  switch (r.status) {
    case 'restored':
      return typeof r.deletion_id === 'string' ? { status: 'restored', deletionId: r.deletion_id } : { status: 'not_found' };
    case 'rate_limited':
      return { status: 'rate_limited', retryAfter: typeof r.retry_after === 'string' ? r.retry_after : null };
    case 'has_profile':
      return { status: 'has_profile' };
    default:
      return { status: 'not_found' };
  }
}

export const isArchiveExpired = (archive: RecoveryArchive, now = Date.now()) => Date.parse(archive.expiresAt) <= now;

/**
 * Local habits, tasks, steps and screen time kept on this phone are only reattached when
 * the server restored the very deletion they belong to, and only before they expire.
 */
export const archiveMatches = (archive: RecoveryArchive | null, deletionId: string, now = Date.now()): archive is RecoveryArchive =>
  !!archive && archive.deletionId === deletionId && !isArchiveExpired(archive, now);
