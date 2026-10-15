import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { radius, useTheme } from '../../theme';

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

type RingProps = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
};

/** Circular progress: an inset groove with a rounded accent arc. */
export function ProgressRing({ progress, size = 120, strokeWidth = 12, color, children, accessibilityLabel }: RingProps) {
  const { colors, shadows } = useTheme();
  const p = clamp01(progress);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const inner = size - strokeWidth * 2 - 4;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.well }, shadows.inset, styles.center]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color ?? colors.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View
        style={[
          { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.surface },
          shadows.raisedSm,
          styles.center,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

type BarProps = {
  progress: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function ProgressBar({ progress, color, height = 8, style, accessibilityLabel }: BarProps) {
  const { colors, shadows } = useTheme();
  const p = clamp01(progress);
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={[{ height, borderRadius: radius.pill, backgroundColor: colors.well, overflow: 'hidden' }, shadows.insetSm, style]}
    >
      {p > 0 && (
        <View
          style={{
            width: `${Math.max(p * 100, 4)}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: color ?? colors.primary,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
