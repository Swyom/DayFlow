/**
 * Tests for the security-sensitive pure logic: input limits and validation of data
 * read back from storage (including the profile and the old log-in accounts).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../src/constants/limits';
import { dataReducer, EMPTY_DATA } from '../src/state/dataReducer';
import { parseLegacyAccounts, parsePreferences, parseProfile, parseScreenTimeState, parseStepsState, parseUserData } from '../src/state/schema';
import { validateEmail } from '../src/utils/validation';

describe('input validation', () => {
  it('rejects oversized and malformed emails', () => {
    assert.ok(validateEmail(`${'a'.repeat(LIMITS.email)}@example.com`));
    assert.ok(validateEmail('not-an-email'));
    assert.equal(validateEmail('asha@example.com'), null);
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

  it('reads old log-in accounts without keeping any password data', () => {
    const [a] = parseLegacyAccounts([{ id: 'u_1', name: 'Sam', email: ' Sam@Example.com ', passwordHash: 'abc', createdAt: '2026-01-01T00:00:00Z' }]);
    assert.equal(a.email, 'sam@example.com');
    assert.equal('passwordHash' in a, false);
    assert.equal('legacyPasswordHash' in a, false);
  });

  it('accepts a valid stored profile and rejects incomplete ones', () => {
    const good = {
      localId: 'u_1',
      fullName: 'Asha Patnaik',
      email: 'ASHA@example.com',
      mobile: '+919876543210',
      age: 29,
      location: { label: 'Bhubaneswar, Odisha, India', latitude: 20.29, longitude: 85.82, source: 'gps' },
      registeredAt: '2026-10-16T10:00:00.000Z',
      avatarPath: '0b5c1a7e-1111-2222-3333-444455556666/avatar-1.jpg',
      stepGoal: 9000,
      updatedAt: '2026-10-16T10:00:00.000Z',
    };
    const p = parseProfile(good);
    assert.ok(p);
    assert.equal(p.email, 'asha@example.com');
    assert.equal(p.location.source, 'gps');
    for (const key of ['fullName', 'email', 'mobile', 'age', 'location', 'registeredAt'] as const) {
      assert.equal(parseProfile({ ...good, [key]: undefined }), null, `missing ${key}`);
    }
    assert.equal(parseProfile({ ...good, age: 5 }), null, 'too young');
    assert.equal(parseProfile({ ...good, avatarPath: '../../etc/passwd' })?.avatarPath, null);
    assert.equal(parseProfile({ ...good, location: { ...good.location, latitude: 999 } })?.location.source, 'manual');
    assert.equal(parseProfile({ ...good, stepGoal: 10 })?.stepGoal, LIMITS.stepGoalMin);
  });

  it('cleans stored step history', () => {
    const s = parseStepsState({
      days: { '2026-10-15': { steps: 5000, goal: 8000 }, bogus: { steps: 1 }, '2026-10-16': { steps: -4, goal: 1 } },
      unsynced: ['2026-10-15', '2026-10-15', 'nope', '2026-01-01'],
      lastSample: { t: 1, counter: 10, boot: 2 },
      cloudUserId: 'not-a-uuid',
    });
    assert.deepEqual(Object.keys(s.days).sort(), ['2026-10-15', '2026-10-16']);
    assert.equal(s.days['2026-10-16'].steps, 0);
    assert.equal(s.days['2026-10-16'].goal, LIMITS.stepGoalMin);
    assert.deepEqual(s.unsynced, ['2026-10-15']);
    assert.equal(s.cloudUserId, null);
  });

  it('cleans stored local screen time history', () => {
    const raw = {
      '2026-10-16': [
        { packageName: 'com.whatsapp', appName: 'WhatsApp', usageMs: 3_600_000 },
        { packageName: 'com.android.settings', appName: '', usageMs: 120_000 },
        { packageName: 'bad', appName: 'Bad', usageMs: -50 },
        { packageName: '', appName: 'No pkg', usageMs: 5000 },
        null,
      ],
      'invalid-date': [{ packageName: 'com.test', usageMs: 1000 }],
      '2026-10-15': 'not an array',
    };
    const s = parseScreenTimeState(raw);
    assert.deepEqual(Object.keys(s), ['2026-10-16']);
    assert.equal(s['2026-10-16'].length, 2);
    assert.equal(s['2026-10-16'][0].packageName, 'com.whatsapp');
    assert.equal(s['2026-10-16'][0].usageMs, 3_600_000);
    assert.equal(s['2026-10-16'][1].appName, 'com.android.settings');
  });
});
