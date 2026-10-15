import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { countOn, currentStreak, isDoneOn, isScheduledOn } from '../../domain/habits';
import type { DateKey, Habit } from '../../types/models';
import { radius, spacing, useTheme } from '../../theme';
import { AppText, CheckButton, Icon3D, IconBadge, ProgressBar } from '../ui';

type HabitRowProps = {
  habit: Habit;
  day: DateKey;
  today: DateKey;
  /** Receive the habit so parents can pass one stable callback for all rows. */
  onPress: (habit: Habit) => void;
  onAdjust: (habit: Habit, day: DateKey, delta: number) => void;
};

/**
 * Habit card used on Today and Habits. Tap the card for details; tap the check to
 * log progress (counted habits add one per tap, a completed habit taps to undo).
 * Memoised so checking one habit doesn't re-render the others.
 */
export const HabitRow = memo(function HabitRow({ habit, day, today, onPress, onAdjust }: HabitRowProps) {
  const theme = useTheme();
  const { colors, shadows } = theme;
  const accent = theme.accent(habit.hue);
  const count = countOn(habit, day);
  const done = isDoneOn(habit, day);
  const scheduled = isScheduledOn(habit, day);
  const counted = habit.target > 1;
  const streak = currentStreak(habit, today);

  const progressLabel = counted
    ? `${count} of ${habit.target}${habit.unit ? ` ${habit.unit}` : ''}`
    : done
      ? 'Done'
      : scheduled
        ? 'Not done yet'
        : 'Rest day';

  return (
    <Pressable
      onPress={() => onPress(habit)}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}, ${progressLabel}${streak ? `, ${streak} day streak` : ''}`}
      accessibilityHint="Opens habit details"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface },
        pressed ? shadows.pressed : shadows.raised,
        !scheduled && !count && styles.dimmed,
      ]}
    >
      <IconBadge icon={habit.icon} color={accent} size={48} />
      <View style={styles.body}>
        <AppText variant="title3" numberOfLines={2}>
          {habit.name}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.metaText}>
            {progressLabel}
          </AppText>
          {streak > 0 && (
            <View style={styles.streak} accessible={false}>
              <Icon3D name="streak" size={14} />
              <AppText variant="caption" tone="warning">
                {streak}
              </AppText>
            </View>
          )}
        </View>
        {counted && <ProgressBar progress={count / habit.target} color={accent} height={6} style={styles.bar} />}
      </View>
      <CheckButton
        checked={done}
        counted={counted}
        progress={count / habit.target}
        color={accent}
        size={44}
        onPress={() => onAdjust(habit, day, done ? -1 : 1)}
        onLongPress={count > 0 ? () => onAdjust(habit, day, -1) : undefined}
        accessibilityLabel={`Log ${habit.name}`}
        accessibilityHint={
          done ? 'Double tap to undo the last check-in' : counted ? 'Adds one check-in. Long press to remove one.' : undefined
        }
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: radius.lg,
    minHeight: 72,
  },
  dimmed: { opacity: 0.6 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { flexShrink: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { marginTop: spacing.sm, marginRight: spacing.sm },
});
