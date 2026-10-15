import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Icon3D, Icon3DName } from './Icon3D';

type ListRowProps = {
  icon?: Icon3DName;
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Draw a hairline above (for rows after the first in a grouped card). */
  divider?: boolean;
  accessibilityHint?: string;
};

/** Row for grouped lists (settings, menus). Shows a chevron when tappable. */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  right,
  onPress,
  destructive,
  divider,
  accessibilityHint,
}: ListRowProps) {
  const { colors, shadows } = useTheme();

  const content = (
    <>
      {icon && (
        <View style={[styles.iconWell, { backgroundColor: colors.well }, shadows.insetSm]}>
          <Icon3D name={icon} size={24} />
        </View>
      )}
      <View style={styles.text}>
        <AppText variant="bodyStrong" tone={destructive ? 'danger' : 'primary'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="callout" tone="secondary" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right}
      {onPress && !right ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </>
  );

  const rowStyle = [styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }];

  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.highlight }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  iconWell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  value: { maxWidth: '45%' },
});
