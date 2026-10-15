import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { completionOn } from '../../domain/habits';
import type { DateKey, Habit } from '../../types/models';
import { formatLongDate, fromDateKey, lastNDays, weekdayOf, weekdayShort } from '../../utils/date';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from '../ui';

/** The last seven days; pick one to view or back-fill check-ins. */
export function WeekStrip({
  habits,
  today,
  selected,
  onSelect,
}: {
  habits: Habit[];
  today: DateKey;
  selected: DateKey;
  onSelect: (day: DateKey) => void;
}) {
  const { colors, shadows } = useTheme();
  const days = useMemo(() => lastNDays(today, 7), [today]);

  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel="Choose a day">
      {days.map((day) => {
        const active = day === selected;
        const c = completionOn(habits, day);
        const complete = c.due > 0 && c.done === c.due;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${day === today ? 'Today, ' : ''}${formatLongDate(day)}, ${c.done} of ${c.due} habits done`}
            style={[
              styles.day,
              active
                ? [{ backgroundColor: colors.well }, shadows.insetSm]
                : [{ backgroundColor: colors.surface }, shadows.raisedSm],
            ]}
          >
            <AppText
              variant="caption"
              tone={active ? 'accent' : 'secondary'}
              maxFontSizeMultiplier={1.1}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {day === today ? 'Today' : weekdayShort(weekdayOf(day))}
            </AppText>
            <AppText variant="title3" tone={active ? 'accent' : 'primary'} maxFontSizeMultiplier={1.1}>
              {fromDateKey(day).getDate()}
            </AppText>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: complete ? colors.success : c.done > 0 ? colors.warning : 'transparent',
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    gap: 2,
    minHeight: 68,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});
