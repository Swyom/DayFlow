import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { useDailySummary } from '../../hooks/useDailySummary';
import { useResponsive } from '../../hooks/useResponsive';
import { spacing } from '../../theme';
import { AppText, Card, Icon3D, Icon3DName, ProgressRing } from '../ui';

type Summary = ReturnType<typeof useDailySummary>;

export function TodayProgressCard({ summary }: { summary: Summary }) {
  const { ring, compact, largeText } = useResponsive();
  // Side-by-side normally; stacked on narrow screens or with large system fonts so nothing clips.
  const stacked = compact || largeText;
  const pct = Math.round(summary.progress * 100);
  const headline = !summary.hasPlan
    ? 'Your day is open'
    : pct === 100
      ? 'Day complete!'
      : pct >= 50
        ? 'Over halfway there'
        : pct > 0
          ? 'Good start'
          : 'Let’s get going';

  return (
    <Card padding={spacing.xl} style={[styles.card, stacked && styles.stacked]}>
      <ProgressRing progress={summary.progress} size={ring} strokeWidth={12} accessibilityLabel={`Today’s progress ${pct} percent`}>
        <AppText variant="number" style={{ fontSize: ring * 0.24, lineHeight: ring * 0.28 }}>
          {pct}
          <AppText variant="title3" tone="secondary">
            %
          </AppText>
        </AppText>
        <AppText variant="caption" tone="secondary">
          done
        </AppText>
      </ProgressRing>

      <View style={[styles.stats, stacked && styles.statsStacked]}>
        <AppText variant="title3" numberOfLines={2} align={stacked ? 'center' : undefined}>
          {headline}
        </AppText>
        <Stat icon="habits" label="Habits" value={`${summary.habitDay.done}/${summary.habitDay.due}`} />
        <Stat icon="tasks" label="Tasks" value={`${summary.taskDay.done}/${summary.taskDay.total}`} />
        <Stat icon="streak" label="Streak" value={`${summary.bestStreak}d`} />
      </View>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: Icon3DName; label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Icon3D name={icon} size={20} />
      <AppText variant="callout" tone="secondary" style={styles.statLabel} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  stacked: { flexDirection: 'column', gap: spacing.lg },
  stats: { flex: 1, gap: spacing.sm },
  statsStacked: { flex: 0, alignSelf: 'stretch' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statLabel: { flex: 1 },
});
