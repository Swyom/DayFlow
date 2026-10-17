import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { donutSegmentPath, formatDuration, formatPercent, spokenDuration, UsageSlice } from '../../domain/screenTime';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTheme } from '../../theme';
import { AppText } from '../ui';

type Props = {
  slices: UsageSlice[];
  colors: string[];
  totalMs: number;
  size: number;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
};

const GAP = 0.025; // radians between segments

/**
 * Interactive doughnut: tap a segment (or its legend row) to select it; the centre then
 * shows that app's time and share. Tapping it again shows the total.
 */
export function UsageDonut({ slices, colors, totalMs, size, selectedKey, onSelect }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const appear = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slices, appear, reduceMotion]);

  const c = size / 2;
  const outer = c - 6;
  const inner = outer * 0.62;
  const selected = slices.find((s) => s.key === selectedKey) ?? null;
  const gap = slices.length > 1 ? GAP : 0;

  let angle = 0;
  const segments = slices.map((s, i) => {
    const a0 = angle;
    const a1 = angle + s.fraction * Math.PI * 2;
    angle = a1;
    const isSelected = s.key === selectedKey;
    // The selected segment pops out slightly along its middle angle.
    const mid = (a0 + a1) / 2;
    const push = isSelected ? 5 : 0;
    const dx = Math.sin(mid) * push;
    const dy = -Math.cos(mid) * push;
    const tiny = a1 - a0 <= gap * 1.5;
    return (
      <Path
        key={s.key}
        d={donutSegmentPath(c, c, isSelected ? outer : outer - 3, inner, a0 + (tiny ? 0 : gap / 2), a1 - (tiny ? 0 : gap / 2))}
        fill={colors[i % colors.length]}
        opacity={selectedKey && !isSelected ? 0.45 : 1}
        transform={`translate(${dx} ${dy})`}
        onPress={() => onSelect(isSelected ? null : s.key)}
      />
    );
  });

  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const rotate = appear.interpolate({ inputRange: [0, 1], outputRange: ['-60deg', '0deg'] });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={{ opacity: appear, transform: [{ scale }, { rotate }] }}>
        <Svg width={size} height={size}>
          <G>{segments}</G>
        </Svg>
      </Animated.View>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.center, { padding: size * 0.22 }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          selected
            ? `${selected.name}: ${spokenDuration(selected.usageMs)}, ${formatPercent(selected.fraction)} of total`
            : `Total screen time ${spokenDuration(totalMs)}`
        }
      >
        <AppText variant="caption" tone="secondary" numberOfLines={1} align="center">
          {selected ? selected.name : 'Total'}
        </AppText>
        <AppText variant="title1" numberOfLines={1} adjustsFontSizeToFit align="center" color={theme.colors.text}>
          {formatDuration(selected ? selected.usageMs : totalMs)}
        </AppText>
        <AppText variant="label" tone="accent" align="center">
          {selected ? formatPercent(selected.fraction) : `${slices.reduce((n, s) => n + s.appCount, 0)} apps`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
