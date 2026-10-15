import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { countOn, historyStart, isScheduledOn } from '../../domain/habits';
import type { DateKey, Habit } from '../../types/models';
import { addDays, formatShortDate, fromDateKey, orderedWeekdays, startOfWeek, weekdayInitial } from '../../utils/date';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from '../ui';

const WEEKS = 6;

/** Six-week history grid: filled = done, tinted = partial, outlined = missed, faded = not scheduled. */
export function HabitCalendar({
  habit,
  today,
  weekStartsOn,
  color,
}: {
  habit: Habit;
  today: DateKey;
  weekStartsOn: 0 | 1;
  color: string;
}) {
  const { colors } = useTheme();
  const start = useMemo(() => addDays(startOfWeek(today, weekStartsOn), -(WEEKS - 1) * 7), [today, weekStartsOn]);
  const first = historyStart(habit);

  return (
    <View>
      <View style={styles.row}>
        {orderedWeekdays(weekStartsOn).map((d) => (
          <AppText key={d} variant="caption" tone="secondary" align="center" style={styles.cell}>
            {weekdayInitial(d)}
          </AppText>
        ))}
      </View>
      {Array.from({ length: WEEKS }, (_, w) => (
        <View key={w} style={styles.row}>
          {Array.from({ length: 7 }, (_, d) => {
            const day = addDays(start, w * 7 + d);
            const future = day > today;
            const before = day < first;
            const scheduled = isScheduledOn(habit, day);
            const n = countOn(habit, day);
            const done = n >= habit.target;
            const state = future || before ? 'none' : done ? 'done' : n > 0 ? 'partial' : scheduled ? 'missed' : 'rest';
            const label = `${formatShortDate(day, today)}: ${
              { none: 'no data', done: 'done', partial: `${n} of ${habit.target}`, missed: 'missed', rest: 'not scheduled' }[state]
            }`;
            return (
              <View key={day} style={styles.cell} accessible accessibilityLabel={label}>
                <View
                  style={[
                    styles.dot,
                    state === 'done' && { backgroundColor: color },
                    state === 'partial' && { backgroundColor: `${color}55` },
                    state === 'missed' && { borderWidth: 1.5, borderColor: colors.divider },
                    state === 'rest' && { backgroundColor: colors.well },
                    day === today && state !== 'done' && { borderWidth: 2, borderColor: colors.primary },
                  ]}
                >
                  <AppText
                    variant="caption"
                    maxFontSizeMultiplier={1}
                    color={state === 'done' ? (colors.scheme === 'dark' ? colors.background : '#FFFFFF') : future || before ? colors.textMuted : colors.textSecondary}
                    style={styles.num}
                  >
                    {fromDateKey(day).getDate()}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: spacing.xs },
  cell: { flex: 1, alignItems: 'center' },
  dot: { width: '88%', maxWidth: 36, aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 11 },
});
