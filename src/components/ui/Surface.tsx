import React, { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { Elevation, radius as radii, spacing, useTheme } from '../../theme';

type RadiusKey = keyof typeof radii;

type SurfaceBaseProps = {
  elevation?: Elevation;
  radius?: RadiusKey | number;
  padding?: number;
  /** Fill override (e.g. a tinted surface). Defaults to the canvas colour. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

function useSurfaceStyle({ elevation = 'raised', radius = 'lg', padding, color }: SurfaceBaseProps): ViewStyle {
  const theme = useTheme();
  const isInset = elevation === 'inset' || elevation === 'insetSm';
  return {
    backgroundColor: color ?? (isInset ? theme.colors.well : theme.colors.surface),
    borderRadius: typeof radius === 'number' ? radius : radii[radius],
    padding,
    ...theme.shadows[elevation],
  };
}

/** Static neumorphic container: raised (extruded) or inset (pressed into the canvas). */
export function Surface({
  elevation,
  radius,
  padding,
  color,
  style,
  children,
  ...viewProps
}: SurfaceBaseProps & Omit<ViewProps, 'style'>) {
  const base = useSurfaceStyle({ elevation, radius, padding, color });
  return (
    <View style={[base, style]} {...viewProps}>
      {children}
    </View>
  );
}

/** Card = raised surface with default padding. */
export function Card({ padding = spacing.lg, ...props }: SurfaceBaseProps & Omit<ViewProps, 'style'>) {
  return <Surface padding={padding} {...props} />;
}

/**
 * Tactile button surface: raised at rest; while pressed it sinks into the canvas
 * (light theme) or brightens (dark theme).
 */
export function PressableSurface({
  elevation = 'raised',
  radius,
  padding,
  color,
  style,
  children,
  disabled,
  ...pressableProps
}: SurfaceBaseProps & Omit<PressableProps, 'style' | 'children'>) {
  const theme = useTheme();
  const rest = useSurfaceStyle({ elevation, radius, padding, color });
  // Light: sinks into the canvas. Dark: brightens; a tinted surface keeps its tint and dims instead.
  const pressedStyle = theme.isDark
    ? color
      ? [{ boxShadow: theme.shadows.pressed.boxShadow }, { opacity: 0.85 }]
      : theme.shadows.pressed
    : elevation === 'raisedLg'
      ? theme.shadows.inset
      : theme.shadows.insetSm;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [rest, pressed && pressedStyle, disabled && { opacity: 0.5 }, style]}
      {...pressableProps}
    >
      {children}
    </Pressable>
  );
}
