import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from '../ui';

/** `empty` marks days with nothing to measure (shown as a dash rather than 0). */
export type Bar = { key: string; label: string; value: number; a11yLabel: string; empty?: boolean };

type Props = {
  bars: Bar[];
  /** Scale maximum; defaults to the largest value (min 1). */
  max?: number;
  color?: string;
  highlightKey?: string;
  formatValue?: (v: number) => string;
  height?: number;
};

/** Vertical bars in inset tracks, with the value printed above each bar. */
export function BarChart({ bars, max, color, highlightKey, formatValue = String, height = 132 }: Props) {
  const { colors, shadows } = useTheme();
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  const fill = color ?? colors.primary;

  return (
    <View style={styles.row}>
      {bars.map((b) => {
        const ratio = Math.max(0, Math.min(1, b.value / top));
        const active = b.key === highlightKey;
        return (
          <View key={b.key} style={styles.col} accessible accessibilityLabel={b.a11yLabel}>
            <AppText variant="caption" tone={active ? 'accent' : 'secondary'} maxFontSizeMultiplier={1} style={styles.value}>
              {b.empty ? '–' : formatValue(b.value)}
            </AppText>
            <View style={[styles.track, { height, backgroundColor: colors.well }, shadows.insetSm]}>
              {ratio > 0 && (
                <View
                  style={{
                    height: `${Math.max(ratio * 100, 6)}%`,
                    borderRadius: radius.pill,
                    backgroundColor: fill,
                    opacity: active || !highlightKey ? 1 : 0.7,
                  }}
                />
              )}
            </View>
            <AppText variant="caption" tone={active ? 'accent' : 'secondary'} maxFontSizeMultiplier={1} style={styles.label}>
              {b.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  col: { flex: 1, alignItems: 'center' },
  value: { fontSize: 10, marginBottom: spacing.xs },
  track: { width: 16, borderRadius: radius.pill, justifyContent: 'flex-end', overflow: 'hidden' },
  label: { marginTop: spacing.sm, fontSize: 11 },
});
