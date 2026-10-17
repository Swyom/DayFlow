/**
 * Tests for the app side of account recovery: input checks, how server answers are read,
 * and when local data kept on the phone may be reattached. (Matching, the 7-day window and
 * the attempt limits are enforced by the database; see scripts/supabase/verify-recovery.mjs.)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  archiveMatches,
  cleanRecoveryInput,
  isArchiveExpired,
  parseRecoveryResult,
  RECOVERY_DAYS,
  RECOVERY_MESSAGES,
  RECOVERY_WINDOW_MS,
  validateRecoveryInput,
} from '../src/domain/recovery';
import { parseRecoveryArchive } from '../src/state/schema';
import type { RecoveryArchive } from '../src/types/models';

const DELETION = '3f2b8c1e-5d4a-4b6f-9c2e-1a7d8e9f0b12';
const now = Date.parse('2026-10-17T12:00:00Z');
const archive: RecoveryArchive = {
  localId: 'u_abc123',
  deletionId: DELETION,
  deletedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + RECOVERY_WINDOW_MS).toISOString(),
};

describe('recovery input', () => {
  it('requires a valid email and mobile number before anything is sent', () => {
    assert.deepEqual(validateRecoveryInput('asha@example.com', '+91 98765 43210'), {});
    const both = validateRecoveryInput('', '');
    assert.ok(both.email && both.mobile);
    assert.ok(validateRecoveryInput('not-an-email', '+919876543210').email);
    assert.ok(validateRecoveryInput('asha@example.com', '12ab').mobile);
  });

  it('normalises input the same way the profile was saved', () => {
    assert.deepEqual(cleanRecoveryInput('  Asha@Example.COM ', '+91 (98765) 43-210'), {
      email: 'asha@example.com',
      mobile: '+919876543210',
    });
  });

  it('uses the exact messages from the specification', () => {
    assert.equal(RECOVERY_MESSAGES.notFound, 'Account not found. Please check your details or create a new account.');
    assert.equal(RECOVERY_MESSAGES.rateLimited, 'You have reached the maximum number of recovery attempts. Please try again tomorrow.');
    assert.equal(RECOVERY_DAYS, 7);
  });
});

describe('server answers', () => {
  it('reads each status and treats anything unexpected as not found', () => {
    assert.deepEqual(parseRecoveryResult({ status: 'restored', deletion_id: DELETION }), { status: 'restored', deletionId: DELETION });
    assert.deepEqual(parseRecoveryResult({ status: 'rate_limited', retry_after: '2026-10-18T12:00:00Z' }), {
      status: 'rate_limited',
      retryAfter: '2026-10-18T12:00:00Z',
    });
    assert.deepEqual(parseRecoveryResult({ status: 'has_profile' }), { status: 'has_profile' });
    for (const raw of [null, 'restored', {}, { status: 'restored' }, { status: 'admin' }]) {
      assert.deepEqual(parseRecoveryResult(raw), { status: 'not_found' }, JSON.stringify(raw));
    }
  });
});

describe('local data kept on the phone', () => {
  it('is reattached only for the same deletion and before it expires', () => {
    assert.equal(archiveMatches(archive, DELETION, now + 1000), true);
    assert.equal(archiveMatches(archive, 'a-different-deletion', now + 1000), false, 'another account’s restore');
    assert.equal(archiveMatches(null, DELETION, now), false, 'nothing kept (different phone or erased)');
    assert.equal(archiveMatches(archive, DELETION, now + RECOVERY_WINDOW_MS), false, 'window over');
  });

  it('expires exactly at the end of the window', () => {
    assert.equal(isArchiveExpired(archive, now + RECOVERY_WINDOW_MS - 1), false);
    assert.equal(isArchiveExpired(archive, now + RECOVERY_WINDOW_MS), true);
  });

  it('drops a damaged stored archive instead of trusting it', () => {
    assert.deepEqual(parseRecoveryArchive(archive), archive);
    assert.equal(parseRecoveryArchive({ ...archive, deletionId: 'x' }), null);
    assert.equal(parseRecoveryArchive({ ...archive, expiresAt: 'tomorrow' }), null);
    assert.equal(parseRecoveryArchive({ ...archive, localId: '../../etc' + ' '.repeat(3) }), null);
    assert.equal(parseRecoveryArchive('junk'), null);
  });
});
