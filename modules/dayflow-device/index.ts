import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NativeStepSample = { t: number; counter: number; boot: number };
export type NativeAppUsage = { packageName: string; appName: string; usageMs: number };

type Events = { onStepCounter: (sample: NativeStepSample) => void };

declare class DayflowDeviceModule extends NativeModule<Events> {
  isStepCounterAvailable(): boolean;
  readStepCounter(timeoutMs: number): Promise<NativeStepSample | null>;
  getStoredSamples(): Promise<NativeStepSample[]>;
  clearStoredSamples(upTo: number): Promise<void>;
  startBackgroundSampling(): void;
  stopBackgroundSampling(): void;
  startLiveUpdates(): boolean;
  stopLiveUpdates(): void;
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): boolean;
  getAppUsage(startMs: number, endMs: number): Promise<NativeAppUsage[]>;
}

/**
 * Android-only native module (modules/dayflow-device/android). Null on iOS, on web and
 * in Expo Go, so callers must handle it being unavailable.
 */
export const DayflowDevice = requireOptionalNativeModule<DayflowDeviceModule>('DayflowDevice');
