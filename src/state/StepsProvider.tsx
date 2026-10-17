import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { DayflowDevice, NativeStepSample } from '../../modules/dayflow-device';
import { STORAGE_KEYS } from '../constants/app';
import {
  applySamples,
  EMPTY_STEPS,
  markSynced,
  mergeRemoteDays,
  setDaySteps,
  setTodayGoal,
  stepsOn,
} from '../domain/steps';
import { usePersistentStore } from '../hooks/usePersistentStore';
import { useToday } from '../hooks/useToday';
import * as cloud from '../services/cloudSync';
import type { DateKey, StepDay, StepSample, StepsState } from '../types/models';
import { addDays, fromDateKey, todayKey } from '../utils/date';
import { useProfile, useProfileContext } from './ProfileProvider';
import { parseStepsState } from './schema';

/**
 * - `unsupported`: no step sensor (or running somewhere without native code, e.g. Expo Go).
 * - `needsPermission`: not asked yet. `denied`: the user said no (can be changed in Settings).
 * - `active`: counting.
 */
export type StepsStatus = 'loading' | 'unsupported' | 'needsPermission' | 'denied' | 'active';

type Action =
  | { type: 'samples'; samples: StepSample[]; goal: number }
  | { type: 'day'; day: DateKey; steps: number; goal: number }
  | { type: 'goal'; day: DateKey; goal: number }
  | { type: 'merge'; remote: cloud.RemoteStepDay[] }
  | { type: 'synced'; days: DateKey[]; userId: string };

function reducer(state: StepsState, action: Action): StepsState {
  switch (action.type) {
    case 'samples':
      return applySamples(state, action.samples, action.goal);
    case 'day':
      return setDaySteps(state, action.day, action.steps, action.goal);
    case 'goal':
      return setTodayGoal(state, action.day, action.goal);
    case 'merge':
      return mergeRemoteDays(state, action.remote);
    case 'synced': {
      const next = markSynced(state, action.days);
      return next.cloudUserId === action.userId ? next : { ...next, cloudUserId: action.userId };
    }
  }
}

type StepsContextValue = {
  status: StepsStatus;
  today: DateKey;
  todaySteps: number;
  goal: number;
  days: Record<DateKey, StepDay>;
  /** Asks for motion / physical-activity permission and starts counting. */
  enable: () => Promise<void>;
  setGoal: (goal: number) => Promise<void>;
};

const StepsContext = createContext<StepsContextValue | null>(null);

const isAndroid = Platform.OS === 'android';
const SYNC_DELAY_MS = 60_000; // Batch steps uploads to 1/min to minimize Supabase load
const LIVE_FLUSH_MS = 3_000;
/** How far back a restore from the cloud reaches. */
const RESTORE_DAYS = 90;

const toSample = (s: NativeStepSample): StepSample => ({ t: s.t, counter: s.counter, boot: s.boot });

async function sensorAvailable(): Promise<boolean> {
  if (isAndroid) return !!DayflowDevice?.isStepCounterAvailable();
  if (Platform.OS !== 'ios') return false;
  return Pedometer.isAvailableAsync().catch(() => false);
}

/** Steps for each local day in [from, today], from CoreMotion (iOS keeps 7 days). */
async function iosDayTotals(days: DateKey[]): Promise<{ day: DateKey; steps: number }[]> {
  const now = new Date();
  const out: { day: DateKey; steps: number }[] = [];
  for (const day of days) {
    const start = fromDateKey(day);
    const end = new Date(Math.min(fromDateKey(addDays(day, 1)).getTime(), now.getTime()));
    const res = await Pedometer.getStepCountAsync(start, end).catch(() => null);
    if (res) out.push({ day, steps: res.steps });
  }
  return out;
}

/** Today's steps, goal and history for the device owner. Counts in the background on Android. */
export function StepsProvider({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const { setStepGoal, ensureCloudReady } = useProfileContext();
  const today = useToday();
  const goal = profile.stepGoal;
  const goalRef = useRef(goal);
  goalRef.current = goal;

  const store = usePersistentStore(STORAGE_KEYS.steps(profile.localId), reducer, EMPTY_STEPS, parseStepsState, 'useDefaults');
  const { state, dispatch, getState } = store;
  const ready = store.status === 'ready';
  const [status, setStatus] = useState<StepsStatus>('loading');

  const run = useCallback((action: Action) => dispatch(action).catch(() => undefined), [dispatch]);

  // ---- Permission & availability ------------------------------------------------------

  const checkPermission = useCallback(async () => {
    if (!(await sensorAvailable())) return setStatus('unsupported');
    const perm = await Pedometer.getPermissionsAsync().catch(() => null);
    if (perm?.granted) setStatus('active');
    else setStatus(perm && !perm.canAskAgain ? 'denied' : 'needsPermission');
  }, []);

  useEffect(() => {
    void checkPermission();
  }, [checkPermission]);

  const enable = useCallback(async () => {
    if (!(await sensorAvailable())) return setStatus('unsupported');
    const perm = await Pedometer.requestPermissionsAsync().catch(() => null);
    setStatus(perm?.granted ? 'active' : 'denied');
  }, []);

  // ---- Reading the sensor ----------------------------------------------------------------

  /** Pulls everything recorded since the last look (background readings + a fresh one). */
  const refresh = useCallback(async () => {
    if (isAndroid) {
      const device = DayflowDevice;
      if (!device) return;
      const stored = (await device.getStoredSamples().catch(() => [])).map(toSample);
      const now = await device.readStepCounter(3000).catch(() => null);
      const samples = now ? [...stored, toSample(now)] : stored;
      if (samples.length) await run({ type: 'samples', samples, goal: goalRef.current });
      if (stored.length) await device.clearStoredSamples(Math.max(...stored.map((s) => s.t))).catch(() => undefined);
    } else {
      const day = todayKey();
      const days = Array.from({ length: 7 }, (_, i) => addDays(day, -i));
      for (const { day: d, steps } of await iosDayTotals(days)) {
        const existing = getState().days[d];
        // Past days keep the goal they had; today uses the current goal.
        await run({ type: 'day', day: d, steps, goal: d === day ? goalRef.current : (existing?.goal ?? goalRef.current) });
      }
    }
  }, [getState, run]);

  useEffect(() => {
    if (!ready || status !== 'active') return;
    let liveSub: { remove: () => void } | null = null;
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const startLive = () => {
      if (liveSub) return;
      if (isAndroid && DayflowDevice) {
        const buffer: StepSample[] = [];
        liveSub = DayflowDevice.addListener('onStepCounter', (s) => buffer.push(toSample(s)));
        DayflowDevice.startLiveUpdates();
        flushTimer = setInterval(() => {
          if (buffer.length) void run({ type: 'samples', samples: buffer.splice(0), goal: goalRef.current });
        }, LIVE_FLUSH_MS);
      } else if (Platform.OS === 'ios') {
        // watchStepCount reports steps since it started; add them to today's CoreMotion total.
        const day = todayKey();
        const base = stepsOn(getState(), day);
        let latest = 0;
        const sub = Pedometer.watchStepCount((r) => (latest = r.steps));
        flushTimer = setInterval(() => {
          if (latest) void run({ type: 'day', day, steps: base + latest, goal: goalRef.current });
        }, LIVE_FLUSH_MS);
        liveSub = sub;
      }
    };

    const stopLive = () => {
      liveSub?.remove();
      liveSub = null;
      if (flushTimer) clearInterval(flushTimer);
      flushTimer = null;
      if (isAndroid) DayflowDevice?.stopLiveUpdates();
    };

    if (isAndroid) DayflowDevice?.startBackgroundSampling();
    void refresh().then(startLive);

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh().then(startLive);
      else stopLive();
    });
    return () => {
      sub.remove();
      stopLive();
    };
  }, [ready, status, refresh, run, getState, today]);

  // ---- Goal ------------------------------------------------------------------------------

  const setGoal = useCallback(
    async (next: number) => {
      await setStepGoal(next);
      await run({ type: 'goal', day: todayKey(), goal: next });
    },
    [setStepGoal, run],
  );

  // ---- Cloud sync -------------------------------------------------------------------------

  const restored = useRef(false);
  const sync = useCallback(async () => {
    if (!cloud.isCloudConfigured()) return;
    const userId = await ensureCloudReady();
    if (!restored.current) {
      restored.current = true;
      const remote = await cloud.fetchStepDays(userId, addDays(todayKey(), -RESTORE_DAYS)).catch(() => null);
      if (remote?.length) await run({ type: 'merge', remote });
    }
    const s = getState();
    // A new cloud identity (e.g. after reinstalling the cloud side) gets the full history.
    const days = s.cloudUserId === userId ? s.unsynced : Object.keys(s.days);
    await cloud.upsertStepDays(
      userId,
      days.filter((d) => s.days[d]).map((d) => ({ day: d, steps: s.days[d].steps, goal: s.days[d].goal })),
    );
    await run({ type: 'synced', days, userId });
  }, [ensureCloudReady, getState, run]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsSync = ready && (state.unsynced.length > 0 || !restored.current);
  useEffect(() => {
    if (!needsSync) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      sync().catch((e) => __DEV__ && console.warn('[sync] steps upload failed', e));
    }, restored.current ? SYNC_DELAY_MS : 1500);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [needsSync, state.unsynced, sync]);

  // Retry a failed upload (e.g. made offline) when the app comes back to the foreground.
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && getState().unsynced.length) sync().catch(() => undefined);
    });
    return () => sub.remove();
  }, [ready, getState, sync]);

  const value = useMemo<StepsContextValue>(
    () => ({ status, today, todaySteps: stepsOn(state, today), goal, days: state.days, enable, setGoal }),
    [status, today, state, goal, enable, setGoal],
  );
  return <StepsContext.Provider value={value}>{children}</StepsContext.Provider>;
}

export function useSteps() {
  const ctx = useContext(StepsContext);
  if (!ctx) throw new Error('useSteps must be used inside StepsProvider');
  return ctx;
}
