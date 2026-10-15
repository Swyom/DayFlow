import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { accentGlow, useTheme } from '../../theme';
import { Icon } from './Icon';

type CheckButtonProps = {
  checked: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  color?: string;
  size?: number;
  /** Counted habits show a "+" and a partial arc (0..1) instead of an empty box. */
  counted?: boolean;
  progress?: number;
  disabled?: boolean;
};

/**
 * Circular completion control. Inset when open, filled accent when done; for
 * counted habits it shows an arc of progress plus the "+" affordance.
 */
export function CheckButton({
  checked,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  color,
  size = 40,
  counted = false,
  progress = 0,
  disabled,
}: CheckButtonProps) {
  const theme = useTheme();
  const { colors, shadows } = theme;
  const accent = color ?? colors.primary;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const showArc = !checked && progress > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked, disabled: !!disabled }}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2 },
        styles.center,
        checked
          ? [{ backgroundColor: accent }, accentGlow(accent, colors)]
          : [{ backgroundColor: colors.well }, shadows.insetSm],
        pressed && { transform: [{ scale: 0.94 }] },
        disabled && { opacity: 0.4 },
      ]}
    >
      {showArc && (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - Math.min(1, progress))}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      )}
      {checked ? (
        <Icon name="checkmark" size={size * 0.55} color={theme.isDark ? colors.background : '#FFFFFF'} />
      ) : counted ? (
        <Icon name="add" size={size * 0.5} color={progress > 0 ? accent : colors.textSecondary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
