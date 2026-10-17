import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getInactivityElapsedMs,
  getRemainingActiveMs,
  INACTIVITY_DAYS,
  INACTIVITY_WINDOW_MS,
  isInactive,
  parseTimestamp,
  shouldSendHeartbeat,
} from '../src/domain/inactivity';
import { DuplicateProfileError, parseCloudError, RateLimitError } from '../src/domain/cloudErrors';

describe('7-day inactivity policy logic', () => {
  const BASE_TIME = Date.parse('2026-10-17T12:00:00.000Z');
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  const SEVEN_DAYS = 7 * ONE_DAY;

  it('correctly parses timestamps from number, string, Date, and rejects invalid inputs', () => {
    assert.equal(parseTimestamp(BASE_TIME), BASE_TIME);
    assert.equal(parseTimestamp('2026-10-17T12:00:00.000Z'), BASE_TIME);
    assert.equal(parseTimestamp(new Date(BASE_TIME)), BASE_TIME);
    assert.equal(parseTimestamp(null), null);
    assert.equal(parseTimestamp(undefined), null);
    assert.equal(parseTimestamp(''), null);
    assert.equal(parseTimestamp('invalid-date'), null);
    assert.equal(parseTimestamp(-1), null);
    assert.equal(parseTimestamp(NaN), null);
  });

  it('marks users active when last used within 7 days', () => {
    // 5 minutes ago
    assert.equal(isInactive(BASE_TIME - 5 * 60 * 1000, BASE_TIME), false);
    // 1 day ago
    assert.equal(isInactive(BASE_TIME - ONE_DAY, BASE_TIME), false);
    // 6 days ago
    assert.equal(isInactive(BASE_TIME - 6 * ONE_DAY, BASE_TIME), false);
    // 6 days, 23 hours, 59 minutes ago (1 minute before 7 days)
    assert.equal(isInactive(BASE_TIME - (SEVEN_DAYS - 60 * 1000), BASE_TIME), false);
  });

  it('marks users inactive when 7 consecutive days have elapsed', () => {
    // Exactly 7 days
    assert.equal(isInactive(BASE_TIME - SEVEN_DAYS, BASE_TIME), true);
    // 7 days and 1 second
    assert.equal(isInactive(BASE_TIME - (SEVEN_DAYS + 1000), BASE_TIME), true);
    // 10 days ago
    assert.equal(isInactive(BASE_TIME - 10 * ONE_DAY, BASE_TIME), true);
    // 30 days ago
    assert.equal(isInactive(BASE_TIME - 30 * ONE_DAY, BASE_TIME), true);
  });

  it('protects against device clock jumping backward (clock skew)', () => {
    // Current device time is BEFORE lastActiveAt (device clock was manually set backward)
    const futureActiveTime = BASE_TIME + 2 * ONE_DAY;
    assert.equal(isInactive(futureActiveTime, BASE_TIME), false);
    assert.equal(getInactivityElapsedMs(futureActiveTime, BASE_TIME), 0);
  });

  it('safely handles missing or invalid lastActiveAt without triggering deletion', () => {
    assert.equal(isInactive(null, BASE_TIME), false);
    assert.equal(isInactive(undefined, BASE_TIME), false);
    assert.equal(isInactive('', BASE_TIME), false);
    assert.equal(isInactive('not-a-date', BASE_TIME), false);
  });

  it('computes remaining active time correctly', () => {
    // 3 days elapsed -> 4 days remaining
    const remaining = getRemainingActiveMs(BASE_TIME - 3 * ONE_DAY, BASE_TIME);
    assert.equal(remaining, 4 * ONE_DAY);

    // 7 days elapsed -> 0 remaining
    assert.equal(getRemainingActiveMs(BASE_TIME - SEVEN_DAYS, BASE_TIME), 0);

    // 8 days elapsed -> 0 remaining
    assert.equal(getRemainingActiveMs(BASE_TIME - 8 * ONE_DAY, BASE_TIME), 0);
  });

  it('throttles heartbeat updates to at most once per 15 minutes', () => {
    // Never sent -> should send
    assert.equal(shouldSendHeartbeat(null, BASE_TIME), true);
    assert.equal(shouldSendHeartbeat(0, BASE_TIME), true);

    // Sent 5 minutes ago -> do not send
    assert.equal(shouldSendHeartbeat(BASE_TIME - 5 * 60 * 1000, BASE_TIME), false);

    // Sent 14 minutes ago -> do not send
    assert.equal(shouldSendHeartbeat(BASE_TIME - 14 * 60 * 1000, BASE_TIME), false);

    // Sent 15 minutes ago -> should send
    assert.equal(shouldSendHeartbeat(BASE_TIME - 15 * 60 * 1000, BASE_TIME), true);

    // Sent 2 hours ago -> should send
    assert.equal(shouldSendHeartbeat(BASE_TIME - 2 * ONE_HOUR, BASE_TIME), true);

    // Clock anomaly (last heartbeat timestamp is in the future) -> should send
    assert.equal(shouldSendHeartbeat(BASE_TIME + ONE_HOUR, BASE_TIME), true);
  });
});

describe('Cloud error parsing: uniqueness and rate limiting', () => {
  it('parses unique constraint violations into DuplicateProfileError with conflict fields', () => {
    const emailErr = { code: '23505', detail: 'Key (lower(email))=(test@example.com) already exists.' };
    const parsedEmail = parseCloudError(emailErr);
    assert.ok(parsedEmail instanceof DuplicateProfileError);
    assert.equal(parsedEmail.conflicts?.emailTaken, true);

    const mobileErr = { code: '23505', detail: 'Key (profiles_mobile_unique)=(9876543210) already exists.' };
    const parsedMobile = parseCloudError(mobileErr);
    assert.ok(parsedMobile instanceof DuplicateProfileError);
    assert.equal(parsedMobile.conflicts?.mobileTaken, true);

    const nameErr = { code: '23505', message: 'profiles_full_name_unique violation' };
    const parsedName = parseCloudError(nameErr);
    assert.ok(parsedName instanceof DuplicateProfileError);
    assert.equal(parsedName.conflicts?.nameTaken, true);
  });

  it('parses server-side rate limits (code P0001) into RateLimitError', () => {
    const rateLimitErr = {
      code: 'P0001',
      message: 'Rate limit reached: Maximum 5 account creation attempts permitted per 24 hours. Please try again after 2026-10-18 12:00:00 UTC.',
    };
    const parsed = parseCloudError(rateLimitErr);
    assert.ok(parsed instanceof RateLimitError);
    assert.match(parsed.message, /Rate limit reached/);
  });

  it('falls back to generic Error for standard exceptions', () => {
    const genericErr = new Error('Network request failed');
    const parsed = parseCloudError(genericErr);
    assert.equal(parsed, genericErr);
  });
});
