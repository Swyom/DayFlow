import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { accentGlow, TOUCH_TARGET, useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only controls need a spoken label. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: 'raised' | 'primary' | 'ghost';
  size?: number;
  iconColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'raised',
  size = TOUCH_TARGET,
  iconColor,
  disabled,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const { colors, shadows } = theme;
  const fg = iconColor ?? (variant === 'primary' ? colors.onPrimary : colors.text);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={size < TOUCH_TARGET ? (TOUCH_TARGET - size) / 2 : 0}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        variant === 'raised' && {
          backgroundColor: colors.surface,
          ...(pressed ? shadows.pressed : shadows.raisedSm),
        },
        variant === 'primary' && {
          backgroundColor: pressed ? colors.primaryStrong : colors.primary,
          ...(pressed ? shadows.raisedSm : accentGlow(colors.primary, colors)),
        },
        variant === 'ghost' && pressed && { backgroundColor: colors.highlight },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} color={fg} />
    </Pressable>
  );
}
