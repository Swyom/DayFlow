import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { DateKey } from '../../types/models';
import { addDays, formatShortDate, orderedWeekdays, startOfWeek, weekdayInitial } from '../../utils/date';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from '../ui';

type Props = {
  today: DateKey;
  weeks: number;
  weekStartsOn: 0 | 1;
  /** null = nothing scheduled / no data that day. */
  valueFor: (day: DateKey) => number | null;
  color?: string;
};

const STEPS = [0.25, 0.5, 0.75, 1];

/** Calendar heatmap of daily completion (0..1). */
export function Heatmap({ today, weeks, weekStartsOn, valueFor, color }: Props) {
  const { colors, shadows } = useTheme();
  const accent = color ?? colors.primary;
  const start = addDays(startOfWeek(today, weekStartsOn), -(weeks - 1) * 7);
  const shade = (v: number) => {
    const step = STEPS.find((s) => v <= s) ?? 1;
    return `${accent}${Math.round(step * 255).toString(16).padStart(2, '0')}`;
  };

  return (
    <View>
      <View style={styles.row}>
        {orderedWeekdays(weekStartsOn).map((d) => (
          <AppText key={d} variant="caption" tone="secondary" align="center" style={styles.cell}>
            {weekdayInitial(d)}
          </AppText>
        ))}
      </View>
      {Array.from({ length: weeks }, (_, w) => (
        <View key={w} style={styles.row}>
          {Array.from({ length: 7 }, (_, d) => {
            const day = addDays(start, w * 7 + d);
            const v = day > today ? null : valueFor(day);
            return (
              <View
                key={day}
                style={styles.cell}
                accessible
                accessibilityLabel={`${formatShortDate(day, today)}: ${day > today ? 'upcoming' : v === null ? 'no habits due' : `${Math.round(v * 100)} percent`}`}
              >
                <View
                  style={[
                    styles.square,
                    v === null || v === 0
                      ? [{ backgroundColor: colors.well }, shadows.insetSm]
                      : { backgroundColor: shade(v) },
                    day === today && { borderWidth: 2, borderColor: colors.text },
                    day > today && styles.future,
                  ]}
                />
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <AppText variant="caption" tone="secondary">
          Less
        </AppText>
        {[0, ...STEPS].map((s) => (
          <View
            key={s}
            style={[styles.legendSquare, s === 0 ? [{ backgroundColor: colors.well }, shadows.insetSm] : { backgroundColor: shade(s) }]}
          />
        ))}
        <AppText variant="caption" tone="secondary">
          More
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 6 },
  cell: { flex: 1, alignItems: 'center' },
  square: { width: '80%', maxWidth: 32, aspectRatio: 1, borderRadius: radius.xs },
  future: { opacity: 0.35 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: spacing.sm },
  legendSquare: { width: 14, height: 14, borderRadius: 4 },
});
