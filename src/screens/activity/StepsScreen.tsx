import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { BarChart } from '../../components/progress/BarChart';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ProgressRing,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatTile,
} from '../../components/ui';
import { LIMITS } from '../../constants/limits';
import { clampGoal, estimateKcal, estimateKm, formatSteps } from '../../domain/steps';
import { useResponsive } from '../../hooks/useResponsive';
import type { RootScreenProps } from '../../navigation/types';
import { useSteps } from '../../state/StepsProvider';
import { spacing, useTheme } from '../../theme';
import { formatShortDate, lastNDays, weekdayOf, weekdayShort } from '../../utils/date';

const GOAL_PRESETS = [5000, 6000, 8000, 10000, 12000, 15000];
const GOAL_STEP = 500;

export default function StepsScreen({ navigation }: RootScreenProps<'Steps'>) {
  const theme = useTheme();
  const { ring } = useResponsive();
  const { status, todaySteps, goal, today, days, enable, setGoal } = useSteps();
  const [draft, setDraft] = useState(goal);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(goal), [goal]);

  const week = useMemo(() => lastNDays(today, 7), [today]);
  const bars = week.map((d) => {
    const steps = days[d]?.steps ?? 0;
    return {
      key: d,
      label: weekdayShort(weekdayOf(d)).slice(0, 2),
      value: steps,
      a11yLabel: `${formatShortDate(d, today)}: ${steps} steps`,
    };
  });
  const history = useMemo(
    () =>
      Object.keys(days)
        .filter((d) => d < today && days[d].steps > 0)
        .sort()
        .reverse()
        .slice(0, 14),
    [days, today],
  );

  const progress = goal ? todaySteps / goal : 0;
  const done = todaySteps >= goal;
  const accent = done ? theme.colors.success : theme.accent('teal');

  const saveGoal = async () => {
    setSaving(true);
    await setGoal(clampGoal(draft)).catch(() => undefined);
    setSaving(false);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Steps" onBack={navigation.goBack} />

      {status === 'active' ? (
        <Card padding={spacing.xl} style={styles.hero}>
          <ProgressRing
            progress={progress}
            size={Math.round(ring * 1.35)}
            strokeWidth={14}
            color={accent}
            accessibilityLabel={`${todaySteps} of ${goal} steps today`}
          >
            <AppText variant="number" numberOfLines={1} adjustsFontSizeToFit style={styles.ringValue}>
              {formatSteps(todaySteps)}
            </AppText>
            <AppText variant="caption" tone="secondary">
              of {formatSteps(goal)}
            </AppText>
          </ProgressRing>
          <AppText variant="title3" align="center">
            {done ? 'Goal reached — nice work!' : `${formatSteps(goal - todaySteps)} steps to go`}
          </AppText>
          <AppText variant="caption" tone="secondary" align="center">
            Today resets at midnight. Earlier days stay in your history.
          </AppText>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title={
              status === 'unsupported'
                ? 'No step sensor found'
                : status === 'denied'
                  ? 'Step counting is off'
                  : status === 'loading'
                    ? 'Checking your phone…'
                    : 'Count your steps'
            }
            message={
              status === 'unsupported'
                ? 'This phone doesn’t have a step counter DayFlow can read, so no steps are shown.'
                : status === 'denied'
                  ? 'DayFlow needs Physical activity (Android) or Motion & Fitness (iPhone) access. You can allow it in Settings.'
                  : 'DayFlow uses your phone’s motion sensor to count steps, even while the app is closed. Counting starts once you allow it.'
            }
            actionLabel={status === 'needsPermission' ? 'Allow step counting' : status === 'denied' ? 'Open Settings' : undefined}
            actionIcon="walk-outline"
            onAction={status === 'denied' ? () => void Linking.openSettings() : () => void enable()}
          />
        </Card>
      )}

      {status === 'active' ? (
        <View style={styles.tiles}>
          <StatTile icon="walk" value={`${estimateKm(todaySteps).toFixed(1)} km`} label="Distance (est.)" />
          <StatTile icon="streak" value={`${estimateKcal(todaySteps)}`} label="kcal (est.)" />
          <StatTile icon="target" value={`${Math.min(999, Math.round(progress * 100))}%`} label="Of goal" />
        </View>
      ) : null}

      <SectionHeader title="Daily goal" />
      <Card style={styles.goalCard}>
        <View style={styles.goalRow}>
          <IconButton
            icon="remove"
            accessibilityLabel="Decrease goal"
            onPress={() => setDraft((g) => clampGoal(g - GOAL_STEP))}
            disabled={draft <= LIMITS.stepGoalMin}
          />
          <View style={styles.goalValue} accessible accessibilityLabel={`Goal ${draft} steps`}>
            <AppText variant="title1">{formatSteps(draft)}</AppText>
            <AppText variant="caption" tone="secondary">
              steps per day
            </AppText>
          </View>
          <IconButton
            icon="add"
            accessibilityLabel="Increase goal"
            onPress={() => setDraft((g) => clampGoal(g + GOAL_STEP))}
            disabled={draft >= LIMITS.stepGoalMax}
          />
        </View>
        <View style={styles.chips}>
          {GOAL_PRESETS.map((g) => (
            <Chip key={g} label={formatSteps(g)} selected={draft === g} onPress={() => setDraft(g)} />
          ))}
        </View>
        {draft !== goal ? <Button title="Save goal" icon="checkmark" onPress={saveGoal} loading={saving} /> : null}
      </Card>

      <SectionHeader title="Last 7 days" />
      <Card>
        <BarChart bars={bars} max={Math.max(goal, ...bars.map((b) => b.value))} color={theme.accent('teal')} highlightKey={today} formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
      </Card>

      {history.length ? (
        <>
          <SectionHeader title="History" />
          <Card padding={spacing.xs}>
            {history.map((d, i) => {
              const day = days[d];
              const hit = day.steps >= day.goal;
              return (
                <View key={d} style={[styles.historyRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider }]}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {formatShortDate(d, today)}
                  </AppText>
                  <AppText variant="body" tone={hit ? 'success' : 'secondary'}>
                    {formatSteps(day.steps)}
                    {hit ? ' ✓' : ''}
                  </AppText>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md },
  ringValue: { fontSize: 30, lineHeight: 36, maxWidth: '86%' },
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  goalCard: { gap: spacing.lg },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  goalValue: { alignItems: 'center', flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  flex: { flex: 1 },
});
