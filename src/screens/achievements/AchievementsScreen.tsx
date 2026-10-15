import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { TrophyIllustration } from '../../components/illustrations';
import {
  AppText,
  Card,
  Icon,
  IconBadge,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  Surface,
} from '../../components/ui';
import { AchievementStatus, evaluateAchievements } from '../../domain/achievements';
import { useResponsive } from '../../hooks/useResponsive';
import { useToday } from '../../hooks/useToday';
import type { RootScreenProps } from '../../navigation/types';
import { useData } from '../../state/DataProvider';
import { radius, spacing, useTheme } from '../../theme';

export default function AchievementsScreen({ navigation }: RootScreenProps<'Achievements'>) {
  const today = useToday();
  const data = useData();
  const theme = useTheme();
  const all = useMemo(() => evaluateAchievements({ data, today }), [data, today]);
  const earned = all.filter((a) => a.unlocked);
  const pending = all.filter((a) => !a.unlocked).sort((a, b) => b.progress - a.progress);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Achievements" onBack={navigation.goBack} />

      <Card padding={spacing.xl} style={styles.hero}>
        <TrophyIllustration size={120} />
        <View style={styles.flex}>
          <AppText variant="overline" tone="secondary">
            Collection
          </AppText>
          <AppText variant="title1">
            {earned.length}
            <AppText variant="title3" tone="secondary">
              {' '}
              / {all.length}
            </AppText>
          </AppText>
          <ProgressBar progress={earned.length / all.length} color={theme.colors.warning} style={styles.heroBar} accessibilityLabel="Achievements unlocked" />
          <AppText variant="caption" tone="secondary" style={styles.heroNote}>
            Earned automatically from your habits, tasks and games.
          </AppText>
        </View>
      </Card>

      {earned.length > 0 && (
        <>
          <SectionHeader title="Earned" />
          <Grid items={earned} />
        </>
      )}
      {pending.length > 0 && (
        <>
          <SectionHeader title={earned.length ? 'Up next' : 'Get started'} />
          <Grid items={pending} />
        </>
      )}
    </Screen>
  );
}

function Grid({ items }: { items: AchievementStatus[] }) {
  const { gridColumns } = useResponsive();
  const width = `${100 / gridColumns - 2}%` as const;
  return (
    <View style={styles.grid}>
      {items.map((a) => (
        <Badge key={a.id} a={a} width={width} />
      ))}
    </View>
  );
}

function Badge({ a, width }: { a: AchievementStatus; width: `${number}%` }) {
  const theme = useTheme();
  const color = theme.accent(a.hue);
  return (
    <Surface
      elevation={a.unlocked ? 'raised' : 'raisedSm'}
      radius="lg"
      padding={spacing.lg}
      style={[styles.badge, { width }]}
      accessible
      accessibilityLabel={`${a.title}. ${a.description}. ${a.unlocked ? 'Unlocked' : `${a.value} of ${a.target}`}`}
    >
      <View style={styles.badgeTop}>
        <IconBadge icon={a.icon} color={color} size={48} muted={!a.unlocked} />
        {a.unlocked ? (
          <Icon name="checkmark-circle" size={20} color={theme.colors.success} />
        ) : (
          <Icon name="lock-closed-outline" size={16} color={theme.colors.textMuted} />
        )}
      </View>
      <AppText variant="title3" numberOfLines={1} style={styles.badgeTitle}>
        {a.title}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={2} style={styles.badgeDesc}>
        {a.description}
      </AppText>
      {!a.unlocked && (
        <View style={styles.badgeProgress}>
          <ProgressBar progress={a.progress} color={color} height={6} style={styles.flex} />
          <AppText variant="caption" tone="secondary">
            {a.value}/{a.target}
          </AppText>
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1 },
  heroBar: { marginTop: spacing.sm },
  heroNote: { marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  badge: { borderRadius: radius.lg },
  badgeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badgeTitle: { marginTop: spacing.md },
  badgeDesc: { marginTop: 2, minHeight: 32 },
  badgeProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
