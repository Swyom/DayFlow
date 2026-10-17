import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useData } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { useProfileContext } from '../../state/ProfileProvider';
import { todayKey } from '../../utils/date';
import {
  scheduleDailyHabitReminder,
  scheduleInactivitySafetyAlert,
  setupNotificationChannels,
  subscribeToNotificationResponses,
  syncNotifications,
} from '../../services/notificationService';

/**
 * Top-level background coordinator for notifications:
 * 1. Sets up Android channels and routes notification clicks.
 * 2. Applies Smart Suppression: cancels reminders whenever all habits are finished.
 * 3. Keeps the 5-day inactivity safety alert armed whenever the app is backgrounded.
 * 4. Refreshes reminders and touches activity whenever the app returns to foreground.
 */
export function NotificationWatcher() {
  const { habits } = useData();
  const { preferences } = usePreferences();
  const { recordActivity } = useProfileContext();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    setupNotificationChannels().catch(() => undefined);
    const sub = subscribeToNotificationResponses();
    return () => {
      sub.remove();
    };
  }, []);

  // Sync notifications whenever habits change (habit checked off, created, or deleted)
  // or user preferences change (time changed, enabled/disabled).
  useEffect(() => {
    const today = todayKey();
    syncNotifications(habits, today, preferences.notifications).catch(() => undefined);
  }, [habits, preferences.notifications]);

  // Handle lifecycle transitions between foreground and background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isComingToForeground =
        appState.current.match(/inactive|background/) && nextAppState === 'active';
      const isGoingToBackground =
        nextAppState.match(/inactive|background/);

      if (isComingToForeground) {
        recordActivity();
        const today = todayKey();
        scheduleDailyHabitReminder(habits, today, preferences.notifications).catch(() => undefined);
        scheduleInactivitySafetyAlert(preferences.notifications.inactivityAlert).catch(() => undefined);
      } else if (isGoingToBackground) {
        scheduleInactivitySafetyAlert(preferences.notifications.inactivityAlert).catch(() => undefined);
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [habits, preferences.notifications, recordActivity]);

  return null;
}
