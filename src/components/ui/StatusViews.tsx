import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

export function ErrorView({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Icon name="cloud-offline-outline" size={44} color={colors.textSecondary} />
      <AppText variant="title2" align="center" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="callout" tone="secondary" align="center" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? <Button title="Try again" icon="refresh" onPress={onRetry} size="md" style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  title: { marginTop: spacing.lg },
  message: { marginTop: spacing.sm, maxWidth: 320 },
  button: { marginTop: spacing.xl },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm },
  inlineText: { flex: 1 },
});

/** Inline, announced error row for forms (e.g. a failed save). */
export function InlineError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.inline, { backgroundColor: colors.dangerSoft }]} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <Icon name="alert-circle-outline" size={18} color={colors.danger} />
      <AppText variant="caption" tone="danger" style={styles.inlineText}>
        {message}
      </AppText>
    </View>
  );
}
