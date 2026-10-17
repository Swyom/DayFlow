import { weekdayOf } from '../utils/date';
import type { DateKey, Habit } from '../types/models';

/**
 * Android Notification Channel Identifiers
 */
export const NOTIFICATION_CHANNELS = {
  reminders: {
    id: 'dayflow-reminders',
    name: 'Daily Check-ins',
    description: 'Gentle evening reminders if you have unfinished habits.',
  },
  safety: {
    id: 'dayflow-safety',
    name: 'Account Safety Alerts',
    description: 'Occasional alerts before 7 days of inactivity to protect your account.',
  },
} as const;

/**
 * Checks whether a habit is scheduled to be performed on a given calendar date.
 */
export function isHabitScheduledForDate(habit: Habit, dateKey: DateKey): boolean {
  if (habit.createdAt > dateKey) return false;
  const dayOfWeek = weekdayOf(dateKey);
  return habit.days.includes(dayOfWeek);
}

/**
 * Checks if a habit has reached its daily target on a given calendar date.
 */
export function isHabitCompletedForDate(habit: Habit, dateKey: DateKey): boolean {
  const current = habit.log[dateKey] ?? 0;
  return current >= habit.target;
}

/**
 * Returns all habits scheduled for today that are not yet completed.
 */
export function getPendingHabitsForDate(habits: Habit[], dateKey: DateKey): Habit[] {
  return habits.filter(
    (h) => isHabitScheduledForDate(h, dateKey) && !isHabitCompletedForDate(h, dateKey),
  );
}

/**
 * Smart Suppression Rule:
 * Returns true if all scheduled habits are already done (or none were scheduled).
 * In this case, tonight's notification MUST be suppressed / cancelled.
 */
export function shouldSuppressDailyReminder(habits: Habit[], dateKey: DateKey): boolean {
  const pending = getPendingHabitsForDate(habits, dateKey);
  return pending.length === 0;
}

/**
 * Generates calm, encouraging notification text based on unfinished habits.
 */
export function buildDailyHabitContent(pendingCount: number): { title: string; body: string } {
  if (pendingCount <= 0) {
    return {
      title: 'All done today! 🎉',
      body: "You've finished all your habits for today. Great job!",
    };
  }
  if (pendingCount === 1) {
    return {
      title: 'Evening check-in',
      body: '1 habit left today whenever you have a moment. 🌿',
    };
  }
  return {
    title: 'Evening check-in',
    body: `${pendingCount} habits left today whenever you're ready. 🌿`,
  };
}

/**
 * Generates the Day-5 inactivity alert copy (protects against the 7-day automatic deletion).
 */
export function buildInactivityWarningContent(): { title: string; body: string } {
  return {
    title: 'Keep your DayFlow account active',
    body: "You haven't checked in for 5 days. Open DayFlow to keep your habits and account active! ⏳",
  };
}

/**
 * Parses a "HH:mm" time string into hours and minutes.
 * Defaults to 20:00 (8:00 PM) if invalid.
 */
export function parseReminderTime(timeStr: string): { hour: number; minute: number } {
  if (!timeStr || typeof timeStr !== 'string') return { hour: 20, minute: 0 };
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 20, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return { hour, minute };
}

/**
 * Calculates the next trigger timestamp for the daily reminder.
 * If the scheduled time has already passed today, schedules for tomorrow.
 */
export function getNextReminderDate(timeStr: string, now = new Date()): Date {
  const { hour, minute } = parseReminderTime(timeStr);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Calculates the trigger date for the 5-day inactivity warning alert.
 */
export function getInactivityAlertDate(now = new Date(), daysAhead = 5): Date {
  const alertDate = new Date(now);
  alertDate.setDate(alertDate.getDate() + daysAhead);
  // Fire at 12:00 noon local time on Day 5 so it never disturbs sleep
  alertDate.setHours(12, 0, 0, 0);
  return alertDate;
}
