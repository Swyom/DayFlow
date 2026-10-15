import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a back button (pushed screens) or close button (modals). */
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  right?: ReactNode;
};

/**
 * Tab roots get a large title; pushed screens get a back button + compact title.
 */
export function ScreenHeader({ title, subtitle, onBack, backIcon = 'back', right }: ScreenHeaderProps) {
  const compact = !!onBack;
  return (
    <View style={[styles.row, compact ? styles.compact : styles.large]}>
      {onBack && (
        <IconButton
          icon={backIcon === 'close' ? 'close' : 'chevron-back'}
          accessibilityLabel={backIcon === 'close' ? 'Close' : 'Go back'}
          onPress={onBack}
        />
      )}
      <View style={styles.titles}>
        {subtitle && !compact ? (
          <AppText variant="label" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
        <AppText variant={compact ? 'title2' : 'title1'} accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && compact ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  large: { minHeight: 56, marginBottom: spacing.lg },
  compact: { minHeight: 52, marginBottom: spacing.lg },
  titles: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
