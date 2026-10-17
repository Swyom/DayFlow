import { LIMITS } from '../constants/limits';
import type { DateKey, StepDay, StepSample, StepsState } from '../types/models';
import { toDateKey } from '../utils/date';

/**
 * Step bookkeeping. Pure functions so the accounting can be unit-tested.
 *
 * Android exposes only a cumulative counter that starts at 0 on every reboot. Each new
 * reading is compared with the previous one and the difference is credited to the local
 * calendar day of the new reading. Readings come from the live sensor while the app is
 * open and from a background job about every 15 minutes, so steps land on the right day
 * (at worst, steps from the last few minutes before midnight count for the next day).
 *
 * iOS (CoreMotion) reports per-day totals directly, which are stored as-is.
 */

export const EMPTY_STEPS: StepsState = { days: {}, lastSample: null, unsynced: [], cloudUserId: null };

export const clampGoal = (goal: number) =>
  Math.min(LIMITS.stepGoalMax, Math.max(LIMITS.stepGoalMin, Math.round(Number.isFinite(goal) ? goal : LIMITS.stepGoalDefault)));

const clampSteps = (steps: number) => Math.min(LIMITS.maxDailySteps, Math.max(0, Math.round(steps)));

const markUnsynced = (unsynced: DateKey[], day: DateKey) => (unsynced.includes(day) ? unsynced : [...unsynced, day]);

/** Steps between two counter readings; a reboot (new boot id or a lower counter) restarts from 0. */
export function stepsBetween(prev: StepSample, next: StepSample): number {
  const rebooted = next.boot !== prev.boot || next.counter < prev.counter;
  return Math.max(0, rebooted ? next.counter : next.counter - prev.counter);
}

/**
 * Applies Android counter readings (any order; old or repeated ones are ignored).
 * The very first reading only sets the baseline: steps from before DayFlow could read
 * the sensor are unknown, so they are not invented.
 */
export function applySamples(state: StepsState, samples: StepSample[], goal: number): StepsState {
  const fresh = samples.filter((s) => !state.lastSample || s.t > state.lastSample.t).sort((a, b) => a.t - b.t);
  if (!fresh.length) return state;

  let { days, unsynced, lastSample } = state;
  for (const sample of fresh) {
    if (lastSample) {
      const delta = stepsBetween(lastSample, sample);
      if (delta > 0) {
        const day = toDateKey(new Date(sample.t));
        const current = days[day]?.steps ?? 0;
        days = { ...days, [day]: { steps: clampSteps(current + delta), goal: clampGoal(goal) } };
        unsynced = markUnsynced(unsynced, day);
      }
    }
    lastSample = sample;
  }
  return { ...state, days, unsynced, lastSample };
}

/** Sets a day's total (iOS, where CoreMotion is the source of truth). No-op if unchanged. */
export function setDaySteps(state: StepsState, day: DateKey, steps: number, goal: number): StepsState {
  const next: StepDay = { steps: clampSteps(steps), goal: clampGoal(goal) };
  const prev = state.days[day];
  if (prev && prev.steps === next.steps && prev.goal === next.goal) return state;
  return { ...state, days: { ...state.days, [day]: next }, unsynced: markUnsynced(state.unsynced, day) };
}

/** Records a new goal on today's entry, so the day keeps the goal that applied to it. */
export function setTodayGoal(state: StepsState, today: DateKey, goal: number): StepsState {
  return setDaySteps(state, today, state.days[today]?.steps ?? 0, goal);
}

/**
 * Merges days restored from the cloud. Local counts never go down (the higher count of
 * a day wins), so a restore can only fill gaps.
 */
export function mergeRemoteDays(state: StepsState, remote: { day: DateKey; steps: number; goal: number }[]): StepsState {
  let days = state.days;
  let unsynced = state.unsynced;
  for (const r of remote) {
    const local = days[r.day];
    if (!local) {
      days = { ...days, [r.day]: { steps: clampSteps(r.steps), goal: clampGoal(r.goal) } };
    } else if (r.steps > local.steps) {
      days = { ...days, [r.day]: { steps: clampSteps(r.steps), goal: local.goal } };
    } else if (local.steps > r.steps) {
      unsynced = markUnsynced(unsynced, r.day);
    }
  }
  return days === state.days && unsynced === state.unsynced ? state : { ...state, days, unsynced };
}

export const markSynced = (state: StepsState, days: DateKey[]): StepsState =>
  days.length ? { ...state, unsynced: state.unsynced.filter((d) => !days.includes(d)) } : state;

export const stepsOn = (state: StepsState, day: DateKey): number => state.days[day]?.steps ?? 0;

/** Rough distance and energy for the summary tiles (average stride 0.75 m, 0.04 kcal/step). */
export const estimateKm = (steps: number) => (steps * 0.75) / 1000;
export const estimateKcal = (steps: number) => Math.round(steps * 0.04);

export const formatSteps = (n: number) => Math.round(n).toLocaleString('en-US');
