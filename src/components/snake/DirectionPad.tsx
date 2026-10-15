import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Direction } from '../../domain/snake';
import { useTheme } from '../../theme';
import { Icon, IconName } from '../ui';

const ARROWS: Record<Direction, IconName> = {
  up: 'chevron-up',
  down: 'chevron-down',
  left: 'chevron-back',
  right: 'chevron-forward',
};

type Props = {
  onDirection: (dir: Direction) => void;
  center: { icon: IconName; label: string; onPress: () => void };
  size?: number;
};

/** Classic cross-shaped D-pad with a pause/play key in the middle. */
export function DirectionPad({ onDirection, center, size = 60 }: Props) {
  const { colors, shadows, isDark } = useTheme();
  // Steer on touch-down so it feels instant; onPress is only a fallback for input
  // that never produces a press-in (e.g. keyboard / assistive activation).
  const handledOnPressIn = useRef(false);

  const key = (dir: Direction) => (
    <Pressable
      key={dir}
      onPressIn={() => {
        handledOnPressIn.current = true;
        onDirection(dir);
      }}
      onPress={() => {
        if (!handledOnPressIn.current) onDirection(dir);
        handledOnPressIn.current = false;
      }}
      accessibilityRole="button"
      accessibilityLabel={`Move ${dir}`}
      style={({ pressed }) => [
        styles.key,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface },
        pressed ? (isDark ? shadows.pressed : shadows.inset) : shadows.raised,
      ]}
    >
      <Icon name={ARROWS[dir]} size={size * 0.45} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={styles.pad}>
      {key('up')}
      <View style={styles.middle}>
        {key('left')}
        <Pressable
          onPress={center.onPress}
          accessibilityRole="button"
          accessibilityLabel={center.label}
          style={({ pressed }) => [
            styles.key,
            { width: size * 0.82, height: size * 0.82, borderRadius: size, backgroundColor: colors.well },
            pressed ? shadows.inset : shadows.insetSm,
          ]}
        >
          <Icon name={center.icon} size={size * 0.36} color={colors.primary} />
        </Pressable>
        {key('right')}
      </View>
      {key('down')}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: 4 },
  middle: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  key: { alignItems: 'center', justifyContent: 'center' },
});
