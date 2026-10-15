import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { spacing } from '../../theme';
import { AppText } from './AppText';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, actionLabel, onAction, tone = 'default', style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <AppText variant="title3" tone={tone === 'danger' ? 'danger' : 'primary'} accessibilityRole="header">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button" style={styles.action}>
          <AppText variant="label" tone="accent">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  action: { paddingVertical: spacing.xs },
});
