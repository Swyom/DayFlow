import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { accentGlow, radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * Primary = filled accent (one per screen, the main action).
 * Secondary = raised neumorphic. Ghost = text only. Danger = raised with red label.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const { colors, shadows } = theme;
  const inactive = disabled || loading;

  const fg =
    variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.primary;

  const container = (pressed: boolean): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: pressed ? colors.primaryStrong : colors.primary,
          ...(pressed || inactive ? shadows.raisedSm : accentGlow(colors.primary, theme.colors)),
        };
      case 'ghost':
        return { backgroundColor: pressed ? colors.highlight : 'transparent' };
      default:
        return { backgroundColor: colors.surface, ...(pressed ? shadows.pressed : shadows.raised) };
    }
  };

  const iconEl = icon ? <Icon name={icon} size={size === 'lg' ? 20 : 18} color={fg} /> : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        container(pressed),
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {iconPosition === 'left' && iconEl}
          <AppText variant="bodyStrong" color={fg} numberOfLines={1}>
            {title}
          </AppText>
          {iconPosition === 'right' && iconEl}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  lg: { minHeight: 56 },
  md: { minHeight: 46, paddingHorizontal: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inactive: { opacity: 0.55 },
});
