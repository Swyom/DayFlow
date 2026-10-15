import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { spacing } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconName } from './Icon';

type Props = {
  illustration?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ illustration, title, message, actionLabel, actionIcon, onAction, children, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      {illustration}
      <AppText variant="title2" align="center" style={styles.title}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="callout" tone="secondary" align="center" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} icon={actionIcon} onPress={onAction} size="md" style={styles.action} />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  title: { marginTop: spacing.xl },
  message: { marginTop: spacing.sm, maxWidth: 320 },
  action: { marginTop: spacing.xl, alignSelf: 'center' },
});
