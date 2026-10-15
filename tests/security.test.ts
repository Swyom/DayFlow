/**
 * Tests for the security-sensitive pure logic: password hashing, log-in lock-out,
 * input limits and validation of data read back from storage.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../src/constants/limits';
import { FREE_ATTEMPTS, lockRemaining, NO_ATTEMPTS, recordFailure } from '../src/services/loginThrottle';
import { constantTimeEqual, createCredential, isPasswordCredential, needsRehash, verifyCredential } from '../src/services/passwordHash';
import { dataReducer, EMPTY_DATA } from '../src/state/dataReducer';
import { parseAccounts, parsePreferences, parseUserData } from '../src/state/schema';
import { validateEmail, validatePassword } from '../src/utils/validation';

const salt = (n: number) => Uint8Array.from({ length: 16 }, (_, i) => (i * 7 + n) & 0xff);

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const cred = await createCredential('correct horse battery', salt(1), 2000);
    assert.ok(isPasswordCredential(cred));
    assert.equal(await verifyCredential('correct horse battery', cred), true);
    assert.equal(await verifyCredential('correct horse batterY', cred), false);
    assert.equal(await verifyCredential('', cred), false);
  });

  it('salts every credential, so equal passwords hash differently', async () => {
    const a = await createCredential('same password', salt(1), 2000);
    const b = await createCredential('same password', salt(2), 2000);
    assert.notEqual(a.hash, b.hash);
  });

  it('flags credentials below the current work factor for re-hashing', async () => {
    assert.equal(needsRehash(await createCredential('pw-pw-pw-pw', salt(3), 2000)), true);
  });

  it('rejects malformed stored credentials', () => {
    assert.equal(isPasswordCredential(null), false);
    assert.equal(isPasswordCredential({ v: 2, algo: 'pbkdf2-sha256', iterations: 1, salt: 'aa', hash: 'bb' }), false);
  });

  it('compares strings without depending on where they differ', () => {
    assert.equal(constantTimeEqual('abc', 'abc'), true);
    assert.equal(constantTimeEqual('abc', 'abd'), false);
    assert.equal(constantTimeEqual('abc', 'abcd'), false);
  });
});

describe('log-in lock-out', () => {
  it('allows a few attempts, then locks with growing delays', () => {
    let s = NO_ATTEMPTS;
    for (let i = 1; i < FREE_ATTEMPTS; i++) {
      s = recordFailure(s, 0);
      assert.equal(lockRemaining(s, 0), 0, `attempt ${i} is free`);
    }
    s = recordFailure(s, 0);
    const first = lockRemaining(s, 0);
    assert.ok(first > 0);
    s = recordFailure(s, 0);
    assert.ok(lockRemaining(s, 0) > first, 'each further failure locks longer');
    assert.equal(lockRemaining(s, 60 * 60_000), 0, 'locks expire');
  });
});

describe('input validation', () => {
  it('rejects oversized emails and passwords', () => {
    assert.ok(validateEmail(`${'a'.repeat(LIMITS.email)}@example.com`));
    assert.ok(validatePassword('x'.repeat(LIMITS.passwordMax + 1)));
    assert.equal(validatePassword('x'.repeat(LIMITS.passwordMin)), null);
  });

  it('clamps values in the reducer even if a form is bypassed', () => {
    const s = dataReducer(EMPTY_DATA, {
      type: 'habit/add',
      id: 'h1',
      input: { name: 'n'.repeat(500), icon: 'plant', hue: 'teal', target: 10_000, unit: 'u'.repeat(99), days: [1, 1, 9 as never], notes: '' },
    });
    const h = s.habits[0];
    assert.equal(h.name.length, LIMITS.name);
    assert.equal(h.target, LIMITS.habitTarget);
    assert.equal(h.unit.length, LIMITS.habitUnit);
    assert.deepEqual(h.days, [1]);
  });
});

describe('stored data parsing', () => {
  it('survives garbage instead of crashing', () => {
    for (const raw of [null, 42, 'x', [], { habits: 'nope', tasks: {}, snake: 'bad' }]) {
      assert.deepEqual(parseUserData(raw), EMPTY_DATA);
    }
  });

  it('drops malformed and duplicate entries and clamps the rest', () => {
    const data = parseUserData({
      habits: [
        { id: 'a', name: 'Read', target: 3, days: [1, 'x', 8], log: { '2026-10-01': 99, bogus: 1 } },
        { id: 'a', name: 'Duplicate' },
        { name: 'No id' },
      ],
      tasks: [{ id: 't', title: 'Ok', priority: 'urgent', due: 'tomorrow', completedAt: 'never' }, 'junk'],
      snake: { bestScore: -5, gamesPlayed: 2.6 },
    });
    assert.equal(data.habits.length, 1);
    assert.deepEqual(data.habits[0].days, [1]);
    assert.deepEqual(data.habits[0].log, { '2026-10-01': 3 });
    assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].priority, 'medium');
    assert.equal(data.tasks[0].due, null);
    assert.equal(data.tasks[0].completedAt, null);
    assert.deepEqual(data.snake, { bestScore: 0, gamesPlayed: 3, foodEaten: 0 });
  });

  it('falls back to defaults for invalid preferences', () => {
    const defaults = { appearance: 'system', weekStartsOn: 1, snakeSpeed: 'normal', onboardingComplete: false } as const;
    assert.deepEqual(parsePreferences({ appearance: 'neon', weekStartsOn: 3, onboardingComplete: 'yes' }, defaults), defaults);
  });

  it('keeps a legacy password hash only for migration and never exposes it as passwordHash', () => {
    const [a] = parseAccounts([{ id: 'u_1', name: 'Sam', email: ' Sam@Example.com ', passwordHash: 'abc', createdAt: '2026-01-01T00:00:00Z' }]);
    assert.equal(a.email, 'sam@example.com');
    assert.equal(a.legacyPasswordHash, 'abc');
    assert.equal('passwordHash' in a, false);
  });
});
