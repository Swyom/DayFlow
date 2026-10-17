import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatSteps } from '../../domain/steps';
import { useSteps } from '../../state/StepsProvider';
import { spacing, useTheme } from '../../theme';
import { AppText, Icon, IconBadge, PressableSurface, ProgressBar } from '../ui';

/** Progress card: today's steps against the goal. Opens the Steps screen. */
export function StepsCard({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { status, todaySteps, goal } = useSteps();
  const progress = goal ? todaySteps / goal : 0;
  const done = todaySteps >= goal;
  const subtitle =
    status === 'active'
      ? done
        ? `Goal reached · ${formatSteps(goal)}`
        : `${formatSteps(Math.max(0, goal - todaySteps))} to go · goal ${formatSteps(goal)}`
      : status === 'unsupported'
        ? 'This phone has no step sensor'
        : status === 'loading'
          ? 'Checking step sensor…'
          : 'Tap to turn on step counting';

  return (
    <PressableSurface
      onPress={onPress}
      padding={spacing.lg}
      accessibilityLabel={status === 'active' ? `Steps today ${todaySteps} of ${goal}. Open steps` : `Steps. ${subtitle}`}
      style={styles.card}
    >
      <View style={styles.row}>
        <IconBadge icon="footprints" color={theme.accent('teal')} size={48} />
        <View style={styles.flex}>
          <AppText variant="label" tone="secondary">
            Steps today
          </AppText>
          <AppText variant="title2" numberOfLines={1}>
            {status === 'active' ? formatSteps(todaySteps) : '—'}
          </AppText>
        </View>
        <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </View>
      {status === 'active' ? <ProgressBar progress={progress} color={done ? theme.colors.success : theme.accent('teal')} /> : null}
      <AppText variant="caption" tone="secondary" numberOfLines={2}>
        {subtitle}
      </AppText>
    </PressableSurface>
  );
}

/** Progress card linking to screen-time analytics. */
export function ScreenTimeCard({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableSurface onPress={onPress} padding={spacing.lg} accessibilityLabel="Screen time. See which apps you used today" style={styles.row}>
      <IconBadge icon="phone" color={theme.accent('orange')} size={48} />
      <View style={styles.flex}>
        <AppText variant="title3">Screen time</AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={2}>
          See which apps you used today and for how long
        </AppText>
      </View>
      <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
});
