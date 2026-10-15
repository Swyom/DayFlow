import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { HABIT_ICONS, HabitIconName } from '../../constants/habits';
import type { Weekday } from '../../types/models';
import { ACCENT_HUES, AccentHue, radius, spacing, useTheme } from '../../theme';
import { orderedWeekdays, weekdayShort } from '../../utils/date';
import { useResponsive } from '../../hooks/useResponsive';
import { AppText, Icon, Icon3D } from '../ui';

const HUE_NAMES: Record<AccentHue, string> = {
  blue: 'Blue',
  sky: 'Sky blue',
  teal: 'Teal',
  green: 'Green',
  amber: 'Amber',
  orange: 'Orange',
  red: 'Red',
  rose: 'Rose',
};

const ICON_LABELS: Partial<Record<HabitIconName, string>> = {
  run: 'running shoe',
  yoga: 'meditation',
  journal: 'writing',
  code: 'laptop',
  meds: 'medicine',
  phone: 'phone off',
  clean: 'cleaning',
};

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: HabitIconName;
  color: string;
  onChange: (icon: HabitIconName) => void;
}) {
  const { colors, shadows } = useTheme();
  const { iconColumns } = useResponsive();
  // Percent width keeps an even grid on every screen width without measuring.
  const cellWidth = `${100 / iconColumns - 2.5}%` as const;
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Icon">
      {HABIT_ICONS.map((icon) => {
        const active = icon === value;
        return (
          <Pressable
            key={icon}
            onPress={() => onChange(icon)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={ICON_LABELS[icon] ?? icon}
            style={({ pressed }) => [
              styles.iconCell,
              { width: cellWidth },
              active
                ? [{ backgroundColor: `${color}26`, borderColor: color }, shadows.insetSm]
                : [{ backgroundColor: colors.surface, borderColor: 'transparent' }, pressed ? shadows.insetSm : shadows.raisedSm],
            ]}
          >
            <Icon3D name={icon} size={30} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function HuePicker({ value, onChange }: { value: AccentHue; onChange: (hue: AccentHue) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.hues} accessibilityRole="radiogroup" accessibilityLabel="Colour">
      {ACCENT_HUES.map((hue) => {
        const active = hue === value;
        const c = theme.accent(hue);
        return (
          <Pressable
            key={hue}
            onPress={() => onChange(hue)}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={HUE_NAMES[hue]}
            style={[styles.hueOuter, { backgroundColor: theme.colors.surface }, active ? theme.shadows.insetSm : theme.shadows.raisedSm]}
          >
            <View style={[styles.hueDot, { backgroundColor: c }]}>
              {active && <Icon name="checkmark" size={14} color={theme.isDark ? theme.colors.background : '#FFFFFF'} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WeekdayPicker({
  value,
  weekStartsOn,
  onChange,
}: {
  value: Weekday[];
  weekStartsOn: 0 | 1;
  onChange: (days: Weekday[]) => void;
}) {
  const { colors, shadows } = useTheme();
  const toggle = (d: Weekday) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <View style={styles.days} accessibilityLabel="Repeat on">
      {orderedWeekdays(weekStartsOn).map((d) => {
        const active = value.includes(d);
        return (
          <Pressable
            key={d}
            onPress={() => toggle(d)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={weekdayShort(d)}
            style={[
              styles.day,
              active ? [{ backgroundColor: colors.primary }] : [{ backgroundColor: colors.surface }, shadows.raisedSm],
            ]}
          >
            <AppText variant="label" color={active ? colors.onPrimary : colors.textSecondary} maxFontSizeMultiplier={1.1}>
              {weekdayShort(d).slice(0, 2)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // 6 columns × 4 rows; cells flex so the grid fills the width evenly on any screen.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  iconCell: {
    aspectRatio: 1,
    maxWidth: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  // One even row of 8 swatches that scales with the screen width.
  hues: { flexDirection: 'row', justifyContent: 'space-between' },
  hueOuter: { width: '11%', maxWidth: 48, aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  hueDot: { width: '68%', aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { flex: 1, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
