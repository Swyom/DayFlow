import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Spoken name, e.g. "Daily target". */
  label: string;
  suffix?: string;
};

export function Stepper({ value, onChange, min = 0, max = 99, label, suffix }: StepperProps) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: suffix ? `${value} ${suffix}` : String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - 1));
      }}
    >
      <IconButton
        icon="remove"
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      />
      <View style={[styles.value, { backgroundColor: colors.well }, shadows.insetSm]}>
        <AppText variant="title2">{value}</AppText>
        {suffix ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {suffix}
          </AppText>
        ) : null}
      </View>
      <IconButton
        icon="add"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
