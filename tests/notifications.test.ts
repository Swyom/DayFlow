import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDailyHabitContent,
  buildInactivityWarningContent,
  getInactivityAlertDate,
  getNextReminderDate,
  getPendingHabitsForDate,
  isHabitCompletedForDate,
  isHabitScheduledForDate,
  parseReminderTime,
  shouldSuppressDailyReminder,
} from '../src/domain/notifications';
import type { Habit } from '../src/types/models';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Read 20 pages',
    icon: 'read',
    hue: 'blue',
    target: 20,
    unit: 'pages',
    days: [0, 1, 2, 3, 4, 5, 6], // all week
    notes: '',
    createdAt: '2026-10-01',
    log: {},
    ...overrides,
  };
}

describe('Notification domain logic & Smart Suppression', () => {
  it('determines if habit is scheduled for date', () => {
    // Habit created today vs in the future
    const habit = makeHabit({ createdAt: '2026-10-15', days: [6] }); // Saturday only (2026-10-17 is Saturday)
    assert.equal(isHabitScheduledForDate(habit, '2026-10-10'), false); // created in future
    assert.equal(isHabitScheduledForDate(habit, '2026-10-17'), true); // scheduled Saturday
    assert.equal(isHabitScheduledForDate(habit, '2026-10-18'), false); // Sunday not in days
  });

  it('determines habit completion for date', () => {
    const habit = makeHabit({ target: 10, log: { '2026-10-17': 5 } });
    assert.equal(isHabitCompletedForDate(habit, '2026-10-17'), false);
    assert.equal(isHabitCompletedForDate(habit, '2026-10-16'), false);

    const completedHabit = makeHabit({ target: 10, log: { '2026-10-17': 10 } });
    assert.equal(isHabitCompletedForDate(completedHabit, '2026-10-17'), true);

    const overachievedHabit = makeHabit({ target: 10, log: { '2026-10-17': 15 } });
    assert.equal(isHabitCompletedForDate(overachievedHabit, '2026-10-17'), true);
  });

  it('filters pending habits for a given date', () => {
    const h1 = makeHabit({ id: 'h1', target: 1, log: { '2026-10-17': 1 } }); // Done
    const h2 = makeHabit({ id: 'h2', target: 5, log: { '2026-10-17': 2 } }); // Pending
    const h3 = makeHabit({ id: 'h3', target: 1, days: [0] }); // Not scheduled for Saturday (weekday 6)

    const pending = getPendingHabitsForDate([h1, h2, h3], '2026-10-17');
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, 'h2');
  });

  it('SMART SUPPRESSION: suppresses notification when all habits are done', () => {
    const h1 = makeHabit({ id: 'h1', target: 1, log: { '2026-10-17': 1 } });
    const h2 = makeHabit({ id: 'h2', target: 10, log: { '2026-10-17': 10 } });

    // Both habits completed today: notification MUST be suppressed
    assert.equal(shouldSuppressDailyReminder([h1, h2], '2026-10-17'), true);
  });

  it('SMART SUPPRESSION: suppresses notification when no habits are scheduled today', () => {
    const h1 = makeHabit({ id: 'h1', days: [1] }); // Monday only
    // Today is Saturday (6), so no habits scheduled
    assert.equal(shouldSuppressDailyReminder([h1], '2026-10-17'), true);
    // Empty habits list also suppresses
    assert.equal(shouldSuppressDailyReminder([], '2026-10-17'), true);
  });

  it('SMART SUPPRESSION: does NOT suppress when pending habits remain', () => {
    const h1 = makeHabit({ id: 'h1', target: 1, log: { '2026-10-17': 1 } }); // Done
    const h2 = makeHabit({ id: 'h2', target: 10, log: { '2026-10-17': 3 } }); // Pending

    assert.equal(shouldSuppressDailyReminder([h1, h2], '2026-10-17'), false);
  });

  it('generates friendly, encouraging copy for notifications', () => {
    const zeroContent = buildDailyHabitContent(0);
    assert.match(zeroContent.title, /All done/);

    const oneContent = buildDailyHabitContent(1);
    assert.match(oneContent.body, /1 habit left/);

    const threeContent = buildDailyHabitContent(3);
    assert.match(threeContent.body, /3 habits left/);
  });

  it('generates clear Day-5 inactivity warning copy', () => {
    const alert = buildInactivityWarningContent();
    assert.match(alert.title, /Keep your DayFlow account active/i);
    assert.match(alert.body, /5 days/i);
    assert.match(alert.body, /Open DayFlow/i);
  });

  it('parses reminder time and handles defaults', () => {
    assert.deepEqual(parseReminderTime('20:00'), { hour: 20, minute: 0 });
    assert.deepEqual(parseReminderTime('19:30'), { hour: 19, minute: 30 });
    assert.deepEqual(parseReminderTime('08:15'), { hour: 8, minute: 15 });
    // Invalid strings fall back to 20:00 (8:00 PM)
    assert.deepEqual(parseReminderTime(''), { hour: 20, minute: 0 });
    assert.deepEqual(parseReminderTime('invalid'), { hour: 20, minute: 0 });
    assert.deepEqual(parseReminderTime('25:99'), { hour: 23, minute: 59 });
  });

  it('calculates the next reminder trigger date correctly', () => {
    // Current time: 14:00 (2:00 PM). Target reminder: 20:00 (8:00 PM).
    // Should trigger TODAY at 20:00.
    const now = new Date('2026-10-17T14:00:00');
    const trigger = getNextReminderDate('20:00', now);
    assert.equal(trigger.getDate(), now.getDate());
    assert.equal(trigger.getHours(), 20);
    assert.equal(trigger.getMinutes(), 0);

    // Current time: 21:00 (9:00 PM). Target reminder: 20:00 (8:00 PM).
    // Target has already passed today -> Should trigger TOMORROW at 20:00.
    const lateNow = new Date('2026-10-17T21:00:00');
    const nextTrigger = getNextReminderDate('20:00', lateNow);
    assert.equal(nextTrigger.getDate(), lateNow.getDate() + 1);
    assert.equal(nextTrigger.getHours(), 20);
    assert.equal(nextTrigger.getMinutes(), 0);
  });

  it('calculates the 5-day inactivity warning date at 12:00 noon', () => {
    const now = new Date('2026-10-17T10:00:00');
    const alertDate = getInactivityAlertDate(now, 5);
    // 5 days after October 17 is October 22
    assert.equal(alertDate.getDate(), 22);
    assert.equal(alertDate.getHours(), 12);
    assert.equal(alertDate.getMinutes(), 0);
  });
});
