import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { DateKey } from '../../types/models';
import { radius, spacing, useTheme } from '../../theme';
import {
  formatLongDate,
  formatMonthYear,
  fromDateKey,
  orderedWeekdays,
  toDateKey,
  weekdayInitial,
} from '../../utils/date';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  value: DateKey | null;
  today: DateKey;
  weekStartsOn: 0 | 1;
  onChange: (day: DateKey) => void;
};

/** Dependency-free month grid date picker. */
export function MonthCalendar({ value, today, weekStartsOn, onChange }: Props) {
  const { colors, shadows } = useTheme();
  const initial = fromDateKey(value ?? today);
  const [cursor, setCursor] = useState({ y: initial.getFullYear(), m: initial.getMonth() });

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = (first.getDay() - weekStartsOn + 7) % 7;
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: (DateKey | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toDateKey(new Date(cursor.y, cursor.m, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor, weekStartsOn]);

  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <View>
      <View style={styles.header}>
        <IconButton icon="chevron-back" size={36} accessibilityLabel="Previous month" onPress={() => shift(-1)} />
        <AppText variant="title3" accessibilityRole="header" accessibilityLiveRegion="polite">
          {formatMonthYear(cursor.y, cursor.m)}
        </AppText>
        <IconButton icon="chevron-forward" size={36} accessibilityLabel="Next month" onPress={() => shift(1)} />
      </View>
      <View style={styles.row}>
        {orderedWeekdays(weekStartsOn).map((d) => (
          <AppText key={d} variant="caption" tone="secondary" align="center" style={styles.cell}>
            {weekdayInitial(d)}
          </AppText>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.row}>
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const selected = day === value;
            const isToday = day === today;
            const past = day < today;
            return (
              <View key={day} style={styles.cell}>
                <Pressable
                  onPress={() => onChange(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${isToday ? 'Today, ' : ''}${formatLongDate(day)}`}
                  style={({ pressed }) => [
                    styles.day,
                    selected && { backgroundColor: colors.primary },
                    !selected && pressed && [{ backgroundColor: colors.well }, shadows.insetSm],
                    !selected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                  ]}
                >
                  <AppText
                    variant="label"
                    maxFontSizeMultiplier={1.1}
                    color={selected ? colors.onPrimary : past ? colors.textMuted : colors.text}
                  >
                    {fromDateKey(day).getDate()}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  row: { flexDirection: 'row', marginBottom: 2 },
  cell: { flex: 1, alignItems: 'center' },
  // Fills its 1/7 column up to 40dp, so the grid never overflows narrow (320dp) screens.
  day: { width: '92%', maxWidth: 40, aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
