import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useToast } from '../../components/feedback/ToastProvider';
import { CelebrateIllustration, PlanIllustration } from '../../components/illustrations';
import { TaskRow } from '../../components/tasks/TaskRow';
import {
  AppText,
  EmptyState,
  IconButton,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
} from '../../components/ui';
import { countForFilter, sectionTasks, TaskFilter } from '../../domain/tasks';
import { SAVE_ERROR_MESSAGE } from '../../hooks/useCommit';
import { useResponsive } from '../../hooks/useResponsive';
import { useTaskToggle } from '../../hooks/useTaskToggle';
import { useToday } from '../../hooks/useToday';
import type { TabScreenProps } from '../../navigation/types';
import { useData, useDataActions } from '../../state/DataProvider';
import { MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '../../theme';
import type { Task } from '../../types/models';
import { confirm } from '../../utils/confirm';

const EMPTY: Record<TaskFilter, { title: string; message: string; art: 'plan' | 'celebrate' }> = {
  today: { title: 'Nothing due today', message: 'Add a task for today, or enjoy the free time.', art: 'celebrate' },
  upcoming: { title: 'No upcoming tasks', message: 'Plan ahead by giving tasks a future date — or no date at all.', art: 'plan' },
  done: { title: 'No completed tasks yet', message: 'Tasks you check off will collect here.', art: 'plan' },
};

export default function TasksScreen({ navigation, route }: TabScreenProps<'Tasks'>) {
  const today = useToday();
  const toast = useToast();
  const { illustration } = useResponsive();
  const { tasks } = useData();
  const { clearCompletedTasks } = useDataActions();
  const toggle = useTaskToggle();
  const [filter, setFilter] = useState<TaskFilter>(route.params?.filter ?? 'today');

  // Deep-link from elsewhere (e.g. the "View" action after adding a task).
  const requested = route.params?.filter;
  useEffect(() => {
    if (!requested) return;
    setFilter(requested);
    navigation.setParams({ filter: undefined });
  }, [requested, navigation]);

  const sections = useMemo(() => sectionTasks(tasks, filter, today), [tasks, filter, today]);
  const todayCount = useMemo(() => countForFilter(tasks, 'today', today), [tasks, today]);

  const openTask = useCallback((task: Task) => navigation.navigate('TaskEditor', { taskId: task.id }), [navigation]);
  const newTask = () => navigation.navigate('TaskEditor', { due: filter === 'upcoming' ? null : today });

  const clearCompleted = async () => {
    const n = countForFilter(tasks, 'done', today);
    const ok = await confirm({
      title: `Clear ${n} completed ${n === 1 ? 'task' : 'tasks'}?`,
      message: 'They will be permanently removed and will no longer count towards achievements.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (!ok) return;
    clearCompletedTasks().then(
      () => toast.show({ message: `Cleared ${n} ${n === 1 ? 'task' : 'tasks'}`, tone: 'success' }),
      () => toast.show({ message: SAVE_ERROR_MESSAGE, tone: 'error' }),
    );
  };

  const empty = EMPTY[filter];

  return (
    <Screen scroll={false} contentStyle={styles.noPad}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={12}
        windowSize={11}
        ListHeaderComponent={
          <>
            <ScreenHeader
              title="Tasks"
              right={<IconButton icon="add" variant="primary" accessibilityLabel="New task" onPress={newTask} />}
            />
            <SegmentedControl
              accessibilityLabel="Task filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'today', label: 'Today', badge: todayCount },
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'done', label: 'Done' },
              ]}
            />
          </>
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={section.title}
            tone={section.tone}
            actionLabel={filter === 'done' ? 'Clear all' : undefined}
            onAction={clearCompleted}
          />
        )}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <TaskRow task={item} today={today} onToggle={toggle} onPress={openTask} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            illustration={
              empty.art === 'plan' ? <PlanIllustration size={illustration} /> : <CelebrateIllustration size={illustration} />
            }
            title={empty.title}
            message={empty.message}
            actionLabel={filter === 'done' ? undefined : 'Add a task'}
            actionIcon="add"
            onAction={newTask}
            style={styles.empty}
          />
        }
        ListFooterComponent={
          filter !== 'done' && sections.length ? (
            <AppText variant="caption" tone="secondary" align="center" style={styles.footer}>
              Tap a task to edit it · tap the circle to complete
            </AppText>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  noPad: { paddingHorizontal: 0, paddingTop: 0, maxWidth: undefined },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.sm,
    paddingBottom: spacing.huge,
  },
  item: { marginBottom: spacing.md },
  empty: { marginTop: spacing.xl },
  footer: { marginTop: spacing.lg },
});
