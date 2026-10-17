import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { HomeBannerAd } from '../../components/ads/HomeBannerAd';
import { HabitRow } from '../../components/habits/HabitRow';
import { TodayProgressCard } from '../../components/home/TodayProgressCard';
import { CelebrateIllustration, GrowthIllustration } from '../../components/illustrations';
import { TaskRow } from '../../components/tasks/TaskRow';
import {
  AppText,
  Card,
  EmptyState,
  Icon,
  Icon3D,
  Icon3DName,
  IconBadge,
  IconButton,
  PressableSurface,
  Screen,
  SectionHeader,
} from '../../components/ui';
import { useDailySummary } from '../../hooks/useDailySummary';
import { useHabitLogger } from '../../hooks/useHabitLogger';
import { useResponsive } from '../../hooks/useResponsive';
import { useTaskToggle } from '../../hooks/useTaskToggle';
import { useToday } from '../../hooks/useToday';
import type { TabScreenProps } from '../../navigation/types';
import { useProfile } from '../../state/ProfileProvider';
import { useData } from '../../state/DataProvider';
import { radius, spacing, useTheme } from '../../theme';
import type { Habit, Task } from '../../types/models';
import { formatLongDate, greetingFor } from '../../utils/date';

const MAX_HABITS = 4;
const MAX_TASKS = 3;

export default function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const theme = useTheme();
  const today = useToday();
  const profile = useProfile();
  const { illustration, compact, largeText } = useResponsive();
  const { habits, snake } = useData();
  const logHabit = useHabitLogger();
  const toggleTask = useTaskToggle();
  const summary = useDailySummary(today);
  const firstName = profile.fullName.split(' ')[0];

  const openHabit = useCallback((h: Habit) => navigation.navigate('HabitDetail', { habitId: h.id }), [navigation]);
  const openTask = useCallback((t: Task) => navigation.navigate('TaskEditor', { taskId: t.id }), [navigation]);
  const newTask = () => navigation.navigate('TaskEditor', { due: today });

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="label" tone="secondary" numberOfLines={1}>
            {formatLongDate(today)}
          </AppText>
          <AppText variant="title1" accessibilityRole="header" numberOfLines={2}>
            {greetingFor()}, {firstName}
          </AppText>
        </View>
        <IconButton icon="settings-outline" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>

      <TodayProgressCard summary={summary} />

      {/* Side by side normally; stacked when narrow or with large system text so labels never clip. */}
      <View style={[styles.quickRow, (compact || largeText) && styles.quickColumn]}>
        <QuickAction icon="habits" label="New habit" onPress={() => navigation.navigate('HabitEditor')} />
        <QuickAction icon="memo" label="New task" onPress={newTask} />
      </View>

      {/* Habits */}
      <SectionHeader
        title="Today’s habits"
        actionLabel={habits.length ? 'See all' : undefined}
        onAction={() => navigation.navigate('Habits')}
      />
      {habits.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<GrowthIllustration size={Math.min(illustration, 160)} />}
            title="Start your first habit"
            message="Pick something small you want to do regularly — drinking water, reading, a short walk."
            actionLabel="Create a habit"
            actionIcon="add"
            onAction={() => navigation.navigate('HabitEditor')}
            style={styles.emptyInCard}
          />
        </Card>
      ) : summary.dueHabits.length === 0 ? (
        <InfoCard icon="tea" text="No habits scheduled today. Enjoy the rest day." />
      ) : summary.habitDay.done === summary.habitDay.due ? (
        <Card style={styles.allDone}>
          <CelebrateIllustration size={84} />
          <View style={styles.flex}>
            <AppText variant="title3">All habits done!</AppText>
            <AppText variant="caption" tone="secondary">
              {summary.habitDay.done} of {summary.habitDay.due} complete. Great consistency.
            </AppText>
          </View>
        </Card>
      ) : (
        <View style={styles.list}>
          {summary.dueHabits.slice(0, MAX_HABITS).map((h) => (
            <HabitRow key={h.id} habit={h} day={today} today={today} onPress={openHabit} onAdjust={logHabit} />
          ))}
        </View>
      )}

      {/* Tasks */}
      <SectionHeader
        title={summary.overdueCount ? `Due today · ${summary.overdueCount} overdue` : 'Due today'}
        actionLabel="All tasks"
        onAction={() => navigation.navigate('Tasks')}
      />
      {summary.openToday.length === 0 ? (
        <InfoCard
          icon="check"
          text={summary.taskDay.done ? 'Every task due today is done.' : 'Nothing due today.'}
          actionLabel="Add task"
          onAction={newTask}
        />
      ) : (
        <View style={styles.list}>
          {summary.openToday.slice(0, MAX_TASKS).map((t) => (
            <TaskRow key={t.id} task={t} today={today} onToggle={toggleTask} onPress={openTask} />
          ))}
          {summary.openToday.length > MAX_TASKS ? (
            <AppText variant="caption" tone="secondary" align="center">
              +{summary.openToday.length - MAX_TASKS} more in Tasks
            </AppText>
          ) : null}
        </View>
      )}

      {/* Sponsored: clearly labelled and kept away from the tab bar and primary actions. */}
      <HomeBannerAd />

      {/* Break */}
      <SectionHeader title="Take a break" />
      <PressableSurface
        onPress={() => navigation.navigate('Snake')}
        accessibilityLabel={`Play Snake. Best score ${snake.bestScore}`}
        padding={spacing.lg}
        style={styles.breakCard}
      >
        <IconBadge icon="snake" color={theme.accent('green')} size={52} />
        <View style={styles.flex}>
          <AppText variant="title3">Play Snake</AppText>
          <AppText variant="caption" tone="secondary">
            {snake.gamesPlayed ? `Best score ${snake.bestScore} · works offline` : 'A two-minute reset · works offline'}
          </AppText>
        </View>
        <Icon name="play" size={20} color={theme.colors.primary} />
      </PressableSurface>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: Icon3DName; label: string; onPress: () => void }) {
  return (
    <PressableSurface onPress={onPress} accessibilityLabel={label} radius="md" style={styles.quick}>
      <Icon3D name={icon} size={24} />
      <AppText variant="label" tone="accent" numberOfLines={1} style={styles.quickLabel}>
        {label}
      </AppText>
    </PressableSurface>
  );
}

function InfoCard({
  icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: Icon3DName;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card style={styles.info}>
      <Icon3D name={icon} size={30} />
      <AppText variant="callout" tone="secondary" style={styles.flex}>
        {text}
      </AppText>
      {actionLabel && onAction ? (
        <PressableSurface onPress={onAction} elevation="raisedSm" radius="pill" style={styles.infoAction} accessibilityLabel={actionLabel}>
          <AppText variant="label" tone="accent" numberOfLines={1}>
            {actionLabel}
          </AppText>
        </PressableSurface>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  headerText: { flex: 1 },
  quickRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  quickColumn: { flexDirection: 'column' },
  quick: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  quickLabel: { flexShrink: 1 },
  list: { gap: spacing.md },
  emptyInCard: { paddingVertical: spacing.sm },
  allDone: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  flex: { flex: 1 },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoAction: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 40, justifyContent: 'center' },
  breakCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
