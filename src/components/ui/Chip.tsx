import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { Icon3D, Icon3DName } from './Icon3D';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** 3D icon (templates); takes precedence over `icon`. */
  icon3d?: Icon3DName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Selectable pill. Selected chips sink into the canvas and pick up the accent colour. */
export function Chip({ label, selected = false, onPress, icon, icon3d, style, accessibilityLabel }: ChipProps) {
  const { colors, shadows } = useTheme();
  const fg = selected ? colors.primary : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected || pressed
          ? [{ backgroundColor: selected ? colors.primarySoft : colors.well }, shadows.insetSm]
          : [{ backgroundColor: colors.surface }, shadows.raisedSm],
        style,
      ]}
    >
      {icon3d ? <Icon3D name={icon3d} size={20} /> : icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <AppText variant="label" color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
});
