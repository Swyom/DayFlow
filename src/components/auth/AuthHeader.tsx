import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../ui';
import { LogoMark } from '../brand/LogoMark';
import { spacing } from '../../theme';

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.root}>
      {/* The tile carries its own depth and shape, so it sits directly on the canvas. */}
      <LogoMark size={88} />
      <AppText variant="title1" align="center" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="callout" tone="secondary" align="center" style={styles.subtitle}>
        {subtitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xxxl },
  title: { marginTop: spacing.xl },
  subtitle: { marginTop: spacing.sm, maxWidth: 300 },
});
