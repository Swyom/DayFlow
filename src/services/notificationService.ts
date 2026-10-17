import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  buildDailyHabitContent,
  buildInactivityWarningContent,
  getInactivityAlertDate,
  getNextReminderDate,
  getPendingHabitsForDate,
  NOTIFICATION_CHANNELS,
  shouldSuppressDailyReminder,
} from '../domain/notifications';
import type { DateKey, Habit, NotificationPreferences } from '../types/models';
import { navigationRef } from '../navigation/navigationRef';

export const NOTIFICATION_IDS = {
  dailyReminder: 'dayflow_daily_habit_reminder',
  inactivitySafety: 'dayflow_inactivity_safety_alert',
} as const;

// Configure global foreground notification behavior
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Ensures Android Notification Channels are created with appropriate user-facing descriptions.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.reminders.id, {
      name: NOTIFICATION_CHANNELS.reminders.name,
      description: NOTIFICATION_CHANNELS.reminders.description,
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0A2FB8',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.safety.id, {
      name: NOTIFICATION_CHANNELS.safety.name,
      description: NOTIFICATION_CHANNELS.safety.description,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#EAB308',
    });
  } catch (e) {
    if (__DEV__) console.warn('[notifications] Failed to set up Android channels', e);
  }
}

/**
 * Checks current notification permission status.
 */
export async function getNotificationPermissionStatus(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Requests notification permissions from the user.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await setupNotificationChannels();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Cancels a specific scheduled notification by ID.
 */
export async function cancelNotification(identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Ignore error if not scheduled
  }
}

/**
 * Cancels all DayFlow scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignore error
  }
}

/**
 * Schedules or updates the 5-day inactivity safety alert.
 * This runs whenever the app goes to the background.
 * Active users reset this timer on every app open, so it only fires if
 * the user has genuinely been absent for 5 days.
 */
export async function scheduleInactivitySafetyAlert(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!enabled) {
    await cancelNotification(NOTIFICATION_IDS.inactivitySafety);
    return;
  }

  const hasPermission = await getNotificationPermissionStatus();
  if (!hasPermission) return;

  try {
    // Cancel existing alert first to push it forward
    await cancelNotification(NOTIFICATION_IDS.inactivitySafety);

    const triggerDate = getInactivityAlertDate(new Date(), 5);
    const content = buildInactivityWarningContent();

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.inactivitySafety,
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        data: { type: 'inactivity_alert' },
        ...(Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNELS.safety.id } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('[notifications] Failed to schedule inactivity alert', e);
  }
}

/**
 * Smart Daily Habit Reminder:
 * 1. If habits are already completed today: SUPPRESS notification (cancels tonight's alert).
 * 2. If habits are unfinished: Schedules a gentle reminder for the user's chosen time.
 */
export async function scheduleDailyHabitReminder(
  habits: Habit[],
  todayKey: DateKey,
  preferences: NotificationPreferences,
): Promise<void> {
  if (Platform.OS === 'web') return;

  if (!preferences.enabled) {
    await cancelNotification(NOTIFICATION_IDS.dailyReminder);
    return;
  }

  const hasPermission = await getNotificationPermissionStatus();
  if (!hasPermission) return;

  try {
    // 1. SMART SUPPRESSION: Are today's habits already completed?
    const suppress = shouldSuppressDailyReminder(habits, todayKey);
    if (suppress) {
      // User already finished all habits! Do not disturb them.
      await cancelNotification(NOTIFICATION_IDS.dailyReminder);
      return;
    }

    const pending = getPendingHabitsForDate(habits, todayKey);
    const nextTrigger = getNextReminderDate(preferences.dailyReminderTime, new Date());
    const content = buildDailyHabitContent(pending.length);

    await cancelNotification(NOTIFICATION_IDS.dailyReminder);
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.dailyReminder,
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        data: { type: 'daily_reminder' },
        ...(Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNELS.reminders.id } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextTrigger,
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('[notifications] Failed to schedule daily reminder', e);
  }
}

/**
 * Top-level synchronization function:
 * Recalculates both daily habit reminders and the 5-day inactivity timer.
 */
export async function syncNotifications(
  habits: Habit[],
  todayKey: DateKey,
  preferences: NotificationPreferences,
): Promise<void> {
  if (!preferences.enabled) {
    await cancelAllNotifications();
    return;
  }
  await Promise.all([
    scheduleDailyHabitReminder(habits, todayKey, preferences),
    scheduleInactivitySafetyAlert(preferences.inactivityAlert),
  ]);
}

/**
 * Listens for user taps on notifications to route them seamlessly.
 */
export function subscribeToNotificationResponses(): { remove: () => void } {
  if (Platform.OS === 'web') return { remove: () => {} };

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const type = response.notification.request.content.data?.type;
        if (navigationRef.isReady()) {
          if (type === 'daily_reminder') {
            navigationRef.navigate('Main', { screen: 'Habits' });
          } else {
            navigationRef.navigate('Main', { screen: 'Home' });
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[notifications] Failed to navigate on notification response', e);
      }
    });

    return subscription;
  } catch {
    return { remove: () => {} };
  }
}
