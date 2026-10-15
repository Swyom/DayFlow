import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart } from '../../components/progress/BarChart';
import { Heatmap } from '../../components/progress/Heatmap';
import { TrophyIllustration, GrowthIllustration } from '../../components/illustrations';
import {
  AppText,
  Card,
  EmptyState,
  Icon,
  IconBadge,
  IconButton,
  PressableSurface,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  StatTile,
} from '../../components/ui';
import { evaluateAchievements } from '../../domain/achievements';
import { completionOn } from '../../domain/habits';
import { rangeStats } from '../../domain/stats';
import { useToday } from '../../hooks/useToday';
import type { TabScreenProps } from '../../navigation/types';
import { useData } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { spacing, useTheme } from '../../theme';
import { formatShortDate, lastNDays, weekdayOf, weekdayShort } from '../../utils/date';

type Range = 'week' | 'month';
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 28 };

export default function ProgressScreen({ navigation }: TabScreenProps<'Progress'>) {
  const theme = useTheme();
  const today = useToday();
  const data = useData();
  const { weekStartsOn } = usePreferences().preferences;
  const [range, setRange] = useState<Range>('week');

  const days = useMemo(() => lastNDays(today, RANGE_DAYS[range]), [today, range]);
  const stats = useMemo(() => rangeStats(data, days, today), [data, days, today]);
  const achievements = useMemo(() => evaluateAchievements({ data, today }), [data, today]);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  const hasAnyData = data.habits.length > 0 || data.tasks.length > 0;

  return (
    <Screen>
      <ScreenHeader
        title="Progress"
        right={<IconButton icon="trophy-outline" accessibilityLabel="Achievements" onPress={() => navigation.navigate('Achievements')} />}
      />

      {!hasAnyData ? (
        <EmptyState
          illustration={<GrowthIllustration size={190} />}
          title="Your progress will show here"
          message="Add a habit or a task and check it off. Charts, streaks and stats fill in automatically."
          actionLabel="Create a habit"
          actionIcon="add"
          onAction={() => navigation.navigate('HabitEditor')}
        />
      ) : (
        <>
          <SegmentedControl<Range>
            accessibilityLabel="Time range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'week', label: 'Last 7 days' },
              { value: 'month', label: 'Last 4 weeks' },
            ]}
          />

          <View style={styles.tiles}>
            <StatTile icon="chart" value={`${Math.round(stats.habitRate * 100)}%`} label="Habit completion" />
            <StatTile icon="streak" value={stats.topStreak} label="Top streak (days)" />
          </View>
          <View style={styles.tiles}>
            <StatTile icon="check" value={stats.checkIns} label="Check-ins" />
            <StatTile icon="tasks" value={stats.tasksDone} label="Tasks completed" />
          </View>

          <SectionHeader title="Habit completion" />
          <Card padding={spacing.xl}>
            {range === 'week' ? (
              <BarChart
                bars={stats.perDay.map((d) => ({
                  key: d.day,
                  label: d.day === today ? 'Today' : weekdayShort(weekdayOf(d.day)).slice(0, 2),
                  value: Math.round(d.habitRate * 100),
                  empty: d.habitsDue === 0,
                  a11yLabel: `${formatShortDate(d.day, today)}: ${d.habitsDue ? `${Math.round(d.habitRate * 100)} percent` : 'no habits due'}`,
                }))}
                max={100}
                highlightKey={today}
                formatValue={(v) => `${v}%`}
              />
            ) : (
              <Heatmap
                today={today}
                weeks={4}
                weekStartsOn={weekStartsOn}
                valueFor={(day) => {
                  const c = completionOn(data.habits, day);
                  return c.due ? c.rate : null;
                }}
              />
            )}
          </Card>

          {range === 'week' && (
            <>
              <SectionHeader title="Tasks completed" />
              <Card padding={spacing.xl}>
                <BarChart
                  bars={stats.perDay.map((d) => ({
                    key: d.day,
                    label: d.day === today ? 'Today' : weekdayShort(weekdayOf(d.day)).slice(0, 2),
                    value: d.tasksDone,
                    a11yLabel: `${formatShortDate(d.day, today)}: ${d.tasksDone} tasks completed`,
                  }))}
                  color={theme.colors.success}
                  highlightKey={today}
                  height={96}
                />
              </Card>
            </>
          )}

          {stats.perHabit.length > 0 && (
            <>
              <SectionHeader title="By habit" />
              <Card style={styles.habitList}>
                {stats.perHabit.map(({ habit, rate, streak }) => {
                  const accent = theme.accent(habit.hue);
                  return (
                    <View key={habit.id} style={styles.habitRow} accessible accessibilityLabel={`${habit.name}: ${Math.round(rate * 100)} percent, ${streak} day streak`}>
                      <IconBadge icon={habit.icon} color={accent} size={38} />
                      <View style={styles.flex}>
                        <View style={styles.habitTop}>
                          <AppText variant="label" numberOfLines={1} style={styles.flex}>
                            {habit.name}
                          </AppText>
                          <AppText variant="label" tone="secondary">
                            {Math.round(rate * 100)}%
                          </AppText>
                        </View>
                        <ProgressBar progress={rate} color={accent} height={6} />
                      </View>
                      <View style={styles.streak}>
                        <Icon name="flame" size={14} color={streak ? theme.colors.warning : theme.colors.textMuted} />
                        <AppText variant="caption" tone={streak ? 'warning' : 'muted'}>
                          {streak}
                        </AppText>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </>
          )}
        </>
      )}

      <SectionHeader title="Achievements" />
      <PressableSurface
        onPress={() => navigation.navigate('Achievements')}
        accessibilityLabel={`Achievements: ${unlocked} of ${achievements.length} unlocked`}
        padding={spacing.lg}
        style={styles.achieve}
      >
        <TrophyIllustration size={72} />
        <View style={styles.flex}>
          <AppText variant="title3">
            {unlocked} of {achievements.length} unlocked
          </AppText>
          <ProgressBar progress={unlocked / achievements.length} color={theme.colors.warning} height={6} style={styles.achieveBar} />
        </View>
        <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
      </PressableSurface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  habitList: { gap: spacing.lg },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  habitTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 30, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  achieve: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  achieveBar: { marginTop: spacing.sm },
});
