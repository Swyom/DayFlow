import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HabitRow } from '../../components/habits/HabitRow';
import { WeekStrip } from '../../components/habits/WeekStrip';
import { GrowthIllustration } from '../../components/illustrations';
import { AppText, Chip, EmptyState, IconButton, Screen, ScreenHeader, SectionHeader } from '../../components/ui';
import { useToast } from '../../components/feedback/ToastProvider';
import { HABIT_TEMPLATES, HabitTemplate } from '../../constants/habits';
import { completionOn, historyStart, isScheduledOn } from '../../domain/habits';
import { SAVE_ERROR_MESSAGE } from '../../hooks/useCommit';
import { useHabitLogger } from '../../hooks/useHabitLogger';
import { useResponsive } from '../../hooks/useResponsive';
import { useToday } from '../../hooks/useToday';
import type { TabScreenProps } from '../../navigation/types';
import { useData, useDataActions } from '../../state/DataProvider';
import { spacing } from '../../theme';
import type { Habit } from '../../types/models';
import { formatLongDate } from '../../utils/date';

export default function HabitsScreen({ navigation }: TabScreenProps<'Habits'>) {
  const today = useToday();
  const { habits } = useData();
  const { addHabit } = useDataActions();
  const logHabit = useHabitLogger();
  const toast = useToast();
  const { illustration } = useResponsive();
  const openHabit = useCallback((h: Habit) => navigation.navigate('HabitDetail', { habitId: h.id }), [navigation]);

  const addTemplate = (t: HabitTemplate) =>
    addHabit({ ...t, notes: '' }).saved.then(
      () => toast.show({ message: `“${t.name}” added`, tone: 'success' }),
      () => toast.show({ message: SAVE_ERROR_MESSAGE, tone: 'error' }),
    );
  const [selected, setSelected] = useState(today);
  const day = selected > today ? today : selected;

  const { scheduled, other } = useMemo(() => {
    const visible = habits.filter((h) => historyStart(h) <= day || h.log[day]);
    return {
      scheduled: visible.filter((h) => isScheduledOn(h, day)),
      other: visible.filter((h) => !isScheduledOn(h, day)),
    };
  }, [habits, day]);
  const c = completionOn(habits, day);

  const addButton = (
    <IconButton icon="add" variant="primary" accessibilityLabel="New habit" onPress={() => navigation.navigate('HabitEditor')} />
  );

  if (habits.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Habits" right={addButton} />
        <EmptyState
          illustration={<GrowthIllustration size={illustration} />}
          title="Build your first habit"
          message="Habits repeat on the days you choose. Start from scratch or tap a suggestion to add it instantly."
          actionLabel="Create a habit"
          actionIcon="add"
          onAction={() => navigation.navigate('HabitEditor')}
        >
          <AppText variant="overline" tone="secondary" style={styles.suggestTitle}>
            Suggestions
          </AppText>
          <View style={styles.templates}>
            {HABIT_TEMPLATES.map((t) => (
              <Chip key={t.name} label={t.name} icon3d={t.icon} onPress={() => addTemplate(t)} accessibilityLabel={`Add ${t.name}`} />
            ))}
          </View>
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Habits" subtitle={`${habits.length} ${habits.length === 1 ? 'habit' : 'habits'}`} right={addButton} />
      <WeekStrip habits={habits} today={today} selected={day} onSelect={setSelected} />

      <View style={styles.dayLine}>
        <AppText variant="label" tone="secondary">
          {day === today ? 'Today' : formatLongDate(day)}
        </AppText>
        <AppText variant="label" tone={c.due && c.done === c.due ? 'success' : 'secondary'}>
          {c.due ? `${c.done} of ${c.due} done` : 'Nothing scheduled'}
        </AppText>
      </View>

      {scheduled.length > 0 && (
        <View style={styles.list}>
          {scheduled.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              day={day}
              today={today}
              onPress={openHabit}
              onAdjust={logHabit}
            />
          ))}
        </View>
      )}

      {other.length > 0 && (
        <>
          <SectionHeader title="Not scheduled" />
          <View style={styles.list}>
            {other.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                day={day}
                today={today}
                onPress={openHabit}
                onAdjust={logHabit}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  list: { gap: spacing.md },
  suggestTitle: { marginTop: spacing.xxxl, marginBottom: spacing.md },
  templates: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});
