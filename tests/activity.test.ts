/**
 * Tests for the profile form rules, step accounting (day rollover, reboots, cloud merge)
 * and the screen-time summary behind the doughnut chart.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../src/constants/limits';
import { cleanProfileInput, formatPlace, invalidFields, normalizeMobile, validateAge, validateMobile, validateProfile } from '../src/domain/profile';
import {
  donutSegmentPath,
  formatDuration,
  formatPercent,
  MIN_USAGE_MS,
  OTHER_KEY,
  spokenDuration,
  summarizeUsage,
} from '../src/domain/screenTime';
import { applySamples, clampGoal, EMPTY_STEPS, markSynced, mergeRemoteDays, setDaySteps, setTodayGoal, stepsBetween, stepsOn } from '../src/domain/steps';
import type { ProfileLocation, StepSample } from '../src/types/models';
import { toDateKey } from '../src/utils/date';

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime(); // October 2026, local time
const sample = (t: number, counter: number, boot = 7): StepSample => ({ t, counter, boot });
const GOAL = 8000;

describe('profile form', () => {
  const place: ProfileLocation = { label: 'Bhubaneswar', latitude: null, longitude: null, source: 'manual' };
  const complete = { fullName: '  Asha   Patnaik ', email: ' Asha@Example.com', mobile: '+91 98765-43210', age: '29', location: place };

  it('accepts a complete form and cleans the values', () => {
    assert.deepEqual(validateProfile(complete), {});
    const clean = cleanProfileInput(complete);
    assert.equal(clean.fullName, 'Asha Patnaik');
    assert.equal(clean.email, 'asha@example.com');
    assert.equal(clean.mobile, '+919876543210');
    assert.equal(clean.age, 29);
  });

  it('reports every missing field, in form order', () => {
    const errors = validateProfile({ fullName: '', email: '', mobile: '', age: '', location: null });
    assert.deepEqual(invalidFields(errors), ['fullName', 'email', 'mobile', 'age', 'location']);
  });

  it('validates mobile numbers and ages', () => {
    assert.equal(normalizeMobile(' (0674) 123-4567 '), '06741234567');
    assert.equal(validateMobile('+91 98765 43210'), null);
    assert.ok(validateMobile('12345'));
    assert.ok(validateMobile('+91 98765 abc'));
    assert.equal(validateAge('13'), null);
    assert.ok(validateAge('12'));
    assert.ok(validateAge('121'));
    assert.ok(validateAge('2.5'));
  });

  it('builds a readable place name from geocoder parts', () => {
    assert.equal(formatPlace(['Bhubaneswar', 'Odisha', 'India']), 'Bhubaneswar, Odisha, India');
    assert.equal(formatPlace([null, 'Delhi', 'delhi', ' ', 'India']), 'Delhi, India');
  });
});

describe('step accounting', () => {
  it('uses the first reading only as a baseline', () => {
    const s = applySamples(EMPTY_STEPS, [sample(at(16, 9), 12_000)], GOAL);
    assert.deepEqual(s.days, {});
    assert.equal(s.lastSample?.counter, 12_000);
  });

  it('adds the difference between readings to the day of the newer reading', () => {
    let s = applySamples(EMPTY_STEPS, [sample(at(16, 9), 100)], GOAL);
    s = applySamples(s, [sample(at(16, 10), 600), sample(at(16, 11), 1600)], GOAL);
    assert.equal(stepsOn(s, '2026-10-16'), 1500);
    assert.deepEqual(s.unsynced, ['2026-10-16']);
  });

  it('starts a new day at zero and keeps the previous day', () => {
    let s = applySamples(EMPTY_STEPS, [sample(at(16, 22), 0), sample(at(16, 23, 45), 4000)], GOAL);
    s = applySamples(s, [sample(at(17, 0, 15), 4300), sample(at(17, 8), 5300)], GOAL);
    assert.equal(stepsOn(s, '2026-10-16'), 4000);
    assert.equal(stepsOn(s, '2026-10-17'), 1300);
    assert.equal(stepsOn(s, '2026-10-18'), 0, 'a day with no readings yet shows 0');
  });

  it('handles reboots, duplicates and out-of-order readings', () => {
    assert.equal(stepsBetween(sample(1, 5000, 7), sample(2, 300, 8)), 300, 'new boot id');
    assert.equal(stepsBetween(sample(1, 5000, -1), sample(2, 300, -1)), 300, 'counter went down');
    let s = applySamples(EMPTY_STEPS, [sample(at(16, 9), 1000)], GOAL);
    s = applySamples(s, [sample(at(16, 11), 1500), sample(at(16, 10), 1200)], GOAL);
    assert.equal(stepsOn(s, '2026-10-16'), 500);
    const again = applySamples(s, [sample(at(16, 10), 1200), sample(at(16, 11), 1500)], GOAL);
    assert.equal(again, s, 'already-seen readings change nothing');
  });

  it('caps implausible jumps', () => {
    let s = applySamples(EMPTY_STEPS, [sample(at(16, 9), 0)], GOAL);
    s = applySamples(s, [sample(at(16, 10), 10_000_000)], GOAL);
    assert.equal(stepsOn(s, '2026-10-16'), LIMITS.maxDailySteps);
  });

  it('keeps each day’s goal and records goal changes on today', () => {
    let s = setDaySteps(EMPTY_STEPS, '2026-10-15', 7000, 6000);
    s = setTodayGoal(s, '2026-10-16', 10_000);
    assert.equal(s.days['2026-10-15'].goal, 6000);
    assert.deepEqual(s.days['2026-10-16'], { steps: 0, goal: 10_000 });
    assert.equal(setDaySteps(s, '2026-10-15', 7000, 6000), s, 'unchanged totals are a no-op');
    assert.equal(clampGoal(50), LIMITS.stepGoalMin);
    assert.equal(clampGoal(Number.NaN), LIMITS.stepGoalDefault);
  });

  it('merges cloud history without lowering local counts', () => {
    let s = setDaySteps(EMPTY_STEPS, '2026-10-16', 5000, GOAL);
    s = markSynced(s, ['2026-10-16']);
    s = mergeRemoteDays(s, [
      { day: '2026-10-14', steps: 3000, goal: 6000 },
      { day: '2026-10-16', steps: 4000, goal: GOAL },
    ]);
    assert.equal(stepsOn(s, '2026-10-14'), 3000);
    assert.equal(stepsOn(s, '2026-10-16'), 5000);
    assert.deepEqual(s.unsynced, ['2026-10-16'], 'the cloud is behind, so re-upload');
  });

  it('dates readings by local calendar day', () => {
    assert.equal(toDateKey(new Date(at(16, 23, 59))), '2026-10-16');
    assert.equal(toDateKey(new Date(at(17, 0, 0))), '2026-10-17');
  });
});

describe('screen time summary', () => {
  const app = (packageName: string, minutes: number) => ({ packageName, appName: packageName.toUpperCase(), usageMs: minutes * 60_000 });

  it('computes shares that add up to 100% and groups small apps as Other', () => {
    const apps = [app('a', 120), app('b', 60), app('c', 30), app('d', 20), app('e', 10), app('f', 5), app('g', 3), app('h', 2)];
    const s = summarizeUsage(apps, 6);
    assert.equal(s.totalMs, 250 * 60_000);
    assert.equal(s.slices.length, 6);
    assert.equal(s.slices[5].key, OTHER_KEY);
    assert.equal(s.slices[5].appCount, 3);
    assert.equal(s.slices[5].usageMs, 10 * 60_000);
    const sum = s.slices.reduce((n, x) => n + x.fraction, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.equal(s.apps.length, 8);
  });

  it('merges duplicate packages and drops sub-minute use', () => {
    const s = summarizeUsage([app('a', 10), app('a', 5), { packageName: 'z', appName: 'Z', usageMs: MIN_USAGE_MS - 1 }]);
    assert.equal(s.apps.length, 1);
    assert.equal(s.apps[0].usageMs, 15 * 60_000);
    assert.equal(s.slices[0].fraction, 1);
  });

  it('returns an empty summary instead of inventing data', () => {
    assert.deepEqual(summarizeUsage([]), { totalMs: 0, slices: [], apps: [] });
  });

  it('formats durations and percentages', () => {
    assert.equal(formatDuration(0), '<1m');
    assert.equal(formatDuration(45 * 60_000), '45m');
    assert.equal(formatDuration(125 * 60_000), '2h 05m');
    assert.equal(spokenDuration(61 * 60_000), '1 hour 1 minute');
    assert.equal(formatPercent(0.004), '0.4%');
    assert.equal(formatPercent(0.336), '34%');
  });

  it('draws doughnut segments as closed paths, including a full circle', () => {
    const quarter = donutSegmentPath(100, 100, 90, 50, 0, Math.PI / 2);
    assert.match(quarter, /^M 100\.000 10\.000 A 90 90 0 0 1 190\.000 100\.000 L 150\.000 100\.000 A 50 50 0 0 0 100\.000 50\.000 Z$/);
    const full = donutSegmentPath(100, 100, 90, 50, 0, Math.PI * 2);
    assert.ok(full.includes('A 90 90 0 1 1'), 'large arc for a single 100% slice');
  });
});
