import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { HabitCalendar } from '../../components/habits/HabitCalendar';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  IconBadge,
  IconButton,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatTile,
  Stepper,
} from '../../components/ui';
import {
  bestStreak,
  countOn,
  currentStreak,
  describeSchedule,
  describeTarget,
  habitRate,
  isDoneOn,
  isScheduledOn,
} from '../../domain/habits';
import { useToday } from '../../hooks/useToday';
import type { RootScreenProps } from '../../navigation/types';
import { useData, useDataActions } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { spacing, useTheme } from '../../theme';
import { lastNDays } from '../../utils/date';

export default function HabitDetailScreen({ route, navigation }: RootScreenProps<'HabitDetail'>) {
  const theme = useTheme();
  const today = useToday();
  const { weekStartsOn } = usePreferences().preferences;
  const { habits } = useData();
  const { adjustHabit } = useDataActions();
  const habit = habits.find((h) => h.id === route.params.habitId);

  const stats = useMemo(() => {
    if (!habit) return null;
    return {
      current: currentStreak(habit, today),
      best: bestStreak(habit, today),
      rate30: Math.round(habitRate(habit, lastNDays(today, 30)) * 100),
    };
  }, [habit, today]);

  if (!habit || !stats) {
    // Deleted from another screen, or a stale deep link.
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Habit" onBack={navigation.goBack} />
        <EmptyState title="Habit not found" message="It may have been deleted." actionLabel="Go back" onAction={navigation.goBack} />
      </Screen>
    );
  }

  const accent = theme.accent(habit.hue);
  const count = countOn(habit, today);
  const done = isDoneOn(habit, today);
  const scheduled = isScheduledOn(habit, today);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title={habit.name}
        onBack={navigation.goBack}
        right={
          <IconButton
            icon="create-outline"
            accessibilityLabel="Edit habit"
            onPress={() => navigation.navigate('HabitEditor', { habitId: habit.id })}
          />
        }
      />

      <Card style={styles.hero}>
        <IconBadge icon={habit.icon} color={accent} size={64} />
        <View style={styles.flex}>
          <AppText variant="title3">{describeTarget(habit)}</AppText>
          <AppText variant="caption" tone="secondary">
            {describeSchedule(habit.days, weekStartsOn)}
            {scheduled ? '' : ' · rest day today'}
          </AppText>
        </View>
      </Card>

      {/* Today */}
      <SectionHeader title="Today" />
      <Card>
        {habit.target > 1 ? (
          <Stepper
            label={`${habit.name} check-ins today`}
            value={count}
            min={0}
            max={habit.target}
            suffix={`of ${habit.target}${habit.unit ? ` ${habit.unit}` : ''}`}
            onChange={(v) => adjustHabit(habit.id, today, v - count)}
          />
        ) : (
          <Button
            title={done ? 'Completed today' : 'Mark as done'}
            icon={done ? 'checkmark-circle' : 'checkmark'}
            variant={done ? 'secondary' : 'primary'}
            onPress={() => adjustHabit(habit.id, today, done ? -1 : 1)}
            accessibilityHint={done ? 'Tap to undo' : undefined}
          />
        )}
        {done && habit.target > 1 ? (
          <AppText variant="caption" tone="success" align="center" style={styles.doneNote}>
            Target reached for today
          </AppText>
        ) : null}
      </Card>

      {/* Stats */}
      <View style={styles.tiles}>
        <StatTile icon="streak" value={stats.current} label="Current streak" />
        <StatTile icon="trophy" value={stats.best} label="Best streak" />
        <StatTile icon="chart" value={`${stats.rate30}%`} label="Last 30 days" />
      </View>

      <SectionHeader title="History" />
      <Card>
        <HabitCalendar habit={habit} today={today} weekStartsOn={weekStartsOn} color={accent} />
      </Card>

      {habit.notes ? (
        <>
          <SectionHeader title="Notes" />
          <Card>
            <AppText variant="body" tone="secondary">
              {habit.notes}
            </AppText>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  doneNote: { marginTop: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
});
