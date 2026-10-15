import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { countOn } from '../domain/habits';
import { useDataActions } from '../state/DataProvider';
import type { DateKey, Habit } from '../types/models';

/**
 * Stable check-in handler for habit rows. Completing a habit gives a light haptic tick.
 * Save failures are surfaced app-wide by the save-error watcher (with Retry).
 */
export function useHabitLogger() {
  const { adjustHabit } = useDataActions();
  return useCallback(
    (habit: Habit, day: DateKey, delta: number) => {
      const completes = delta > 0 && countOn(habit, day) + delta >= habit.target;
      if (completes && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      adjustHabit(habit.id, day, delta);
    },
    [adjustHabit],
  );
}
