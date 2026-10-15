import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isOverdue, PRIORITY_LABEL } from '../../domain/tasks';
import type { DateKey, Priority, Task } from '../../types/models';
import { relativeDayLabel } from '../../utils/date';
import { Palette, radius, spacing, useTheme } from '../../theme';
import { AppText, CheckButton, Icon } from '../ui';

export const priorityColor = (c: Palette, p: Priority) =>
  ({ high: c.danger, medium: c.warning, low: c.textSecondary })[p];

type Props = {
  task: Task;
  today: DateKey;
  /** Receive the task so parents can pass one stable callback for every row. */
  onPress: (task: Task) => void;
  onToggle: (task: Task) => void;
};

/** Memoised: only re-renders when its own task (or the day) changes. */
export const TaskRow = memo(function TaskRow({ task, today, onPress, onToggle }: Props) {
  const { colors, shadows } = useTheme();
  const done = task.completedAt !== null;
  const overdue = isOverdue(task, today);
  const dueLabel = task.due ? relativeDayLabel(task.due, today) : null;
  const pColor = done ? colors.textSecondary : priorityColor(colors, task.priority);

  return (
    <Pressable
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={[
        task.title,
        done ? 'completed' : null,
        `${PRIORITY_LABEL[task.priority]} priority`,
        dueLabel ? `${overdue ? 'overdue, was due' : 'due'} ${dueLabel}` : 'no due date',
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Opens the task to edit"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface },
        pressed ? shadows.pressed : shadows.raised,
      ]}
    >
      <CheckButton
        checked={done}
        onPress={() => onToggle(task)}
        size={30}
        color={colors.success}
        accessibilityLabel={done ? `Mark ${task.title} as not done` : `Complete ${task.title}`}
      />
      <View style={styles.body}>
        <AppText variant="bodyStrong" tone={done ? 'secondary' : 'primary'} numberOfLines={2} style={done && styles.strike}>
          {task.title}
        </AppText>
        <View style={styles.meta}>
          {task.priority !== 'low' ? (
            <View style={styles.metaItem}>
              <Icon name="flag" size={12} color={pColor} />
              <AppText variant="caption" color={pColor}>
                {PRIORITY_LABEL[task.priority]}
              </AppText>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Icon name="calendar-clear-outline" size={12} color={overdue ? colors.danger : colors.textSecondary} />
            <AppText variant="caption" tone={overdue ? 'danger' : 'secondary'}>
              {dueLabel ?? 'No date'}
            </AppText>
          </View>
          {task.notes ? <Icon name="document-text-outline" size={13} color={colors.textSecondary} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    minHeight: 64,
  },
  body: { flex: 1, gap: 4 },
  strike: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md, rowGap: 2, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
