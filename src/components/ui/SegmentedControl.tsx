import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

export type SegmentOption<T extends string> = { value: T; label: string; badge?: number };

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Inset track with a raised "key" for the active option. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, style }: Props<T>) {
  const { colors, shadows } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.well }, shadows.inset, style]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.badge ? `${o.label}, ${o.badge}` : o.label}
            style={[styles.item, active && [{ backgroundColor: colors.surfaceHigh }, shadows.raisedSm]]}
          >
            <AppText
              variant="label"
              tone={active ? 'accent' : 'secondary'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={styles.label}
            >
              {o.label}
            </AppText>
            {o.badge ? (
              <View style={[styles.badge, { backgroundColor: active ? colors.primary : colors.divider }]}>
                <AppText variant="caption" color={active ? colors.onPrimary : colors.textSecondary} style={styles.badgeText}>
                  {o.badge > 99 ? '99+' : o.badge}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, padding: 5, gap: 4 },
  item: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  label: { flexShrink: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 14 },
});
