import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon3D, Icon3DName } from './Icon3D';

/**
 * 3D icon seated in a neumorphic disc tinted with the item's accent
 * (habits, achievements, settings). Muted = locked / inactive.
 */
export function IconBadge({
  icon,
  color,
  size = 44,
  muted = false,
  style,
}: {
  icon: Icon3DName;
  color?: string;
  size?: number;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, shadows } = useTheme();
  const tint = color && !muted ? `${color}26` : colors.well;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
        { backgroundColor: tint },
        muted ? shadows.insetSm : shadows.raisedSm,
        style,
      ]}
    >
      <Icon3D name={icon} size={Math.round(size * 0.62)} muted={muted} />
    </View>
  );
}

/** Circular initials avatar. */
export function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const { colors, shadows } = useTheme();
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
        { backgroundColor: colors.surface },
        shadows.raised,
      ]}
    >
      <View
        style={{
          width: size - 10,
          height: size - 10,
          borderRadius: (size - 10) / 2,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="title3" tone="accent" style={{ fontSize: size * 0.34, lineHeight: size * 0.42 }}>
          {initials}
        </AppText>
      </View>
    </View>
  );
}

/** Metric tile: 3D icon, big number, small label. */
export function StatTile({
  icon,
  value,
  label,
  style,
}: {
  icon: Icon3DName;
  value: string | number;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.tile, { backgroundColor: colors.surface }, shadows.raised, style]}
    >
      <Icon3D name={icon} size={26} />
      <AppText variant="number" style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, borderRadius: radius.lg, padding: spacing.md, paddingTop: spacing.lg, gap: spacing.xs },
  tileValue: { marginTop: spacing.xs, fontSize: 24, lineHeight: 30 },
});
