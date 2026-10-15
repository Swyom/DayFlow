import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useToast } from '../../components/feedback/ToastProvider';
import { DueDatePicker } from '../../components/tasks/DueDatePicker';
import { AppText, Button, InlineError, Screen, ScreenHeader, SegmentedControl, TextField } from '../../components/ui';
import { describeAdded, filterForTask, PRIORITIES, PRIORITY_LABEL } from '../../domain/tasks';
import { useCommit } from '../../hooks/useCommit';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { useToday } from '../../hooks/useToday';
import { openTaskList } from '../../navigation/navigationRef';
import type { RootScreenProps } from '../../navigation/types';
import type { TaskInput } from '../../state/dataReducer';
import { useData, useDataActions } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { spacing } from '../../theme';
import type { Priority, Task } from '../../types/models';
import { confirm } from '../../utils/confirm';
import { validateName } from '../../utils/validation';

export default function TaskEditorScreen({ route, navigation }: RootScreenProps<'TaskEditor'>) {
  const today = useToday();
  const toast = useToast();
  const { weekStartsOn } = usePreferences().preferences;
  const { tasks } = useData();
  const { addTask, updateTask, deleteTask, restoreTask, toggleTask } = useDataActions();

  // Snapshot what we're editing once: the store changes underneath us while saving/deleting,
  // and the header must not flip to "New task" during the closing animation.
  const [original] = useState<Task | undefined>(() => tasks.find((t) => t.id === route.params?.taskId));
  const isEdit = !!original;
  const [initial] = useState<TaskInput>(() =>
    original
      ? { title: original.title, notes: original.notes, priority: original.priority, due: original.due }
      : { title: '', notes: '', priority: 'medium', due: route.params?.due === undefined ? today : route.params.due },
  );
  const [form, setForm] = useState<TaskInput>(initial);
  const [titleError, setTitleError] = useState<string | null>(null);
  /** Id of a task this screen already created; retries update it instead of creating a duplicate. */
  const createdId = useRef<string | null>(null);
  const { saving, error, commit } = useCommit();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const exit = useDiscardGuard(dirty);

  const validate = () => {
    const err = validateName(form.title, 'task name', 120);
    setTitleError(err);
    return !err;
  };

  /** Creates once, then only ever updates — safe to call again after a failed save. */
  const persistForm = () => {
    const id = original?.id ?? createdId.current;
    if (id) return updateTask(id, form);
    const created = addTask(form);
    createdId.current = created.id;
    return created.saved;
  };

  const save = async () => {
    if (!validate()) return;
    const ok = await commit(persistForm);
    if (!ok) return;
    if (isEdit) {
      toast.show({ message: 'Changes saved', tone: 'success' });
    } else {
      const filter = filterForTask({ due: form.due, completedAt: null }, today);
      toast.show({
        message: describeAdded(form.due, today),
        tone: 'success',
        actionLabel: 'View',
        onAction: () => openTaskList(filter),
      });
    }
    exit(() => navigation.goBack());
  };

  /** Saves any edits and flips completion in one step. */
  const saveAndToggle = async () => {
    if (!original || !validate()) return;
    const wasDone = original.completedAt !== null;
    const ok = await commit(async () => {
      await updateTask(original.id, form);
      await toggleTask(original.id);
    });
    if (!ok) return;
    toast.show({ message: wasDone ? 'Task reopened' : 'Task completed', tone: 'success' });
    exit(() => navigation.goBack());
  };

  const remove = async () => {
    if (!original) return;
    const yes = await confirm({
      title: 'Delete this task?',
      message: `“${original.title}” will be removed. You can undo right after.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!yes) return;
    const { snapshot, saved } = deleteTask(original.id);
    exit(() => navigation.goBack());
    saved.then(
      () =>
        toast.show({
          message: 'Task deleted',
          actionLabel: snapshot ? 'Undo' : undefined,
          onAction: snapshot ? () => void restoreTask(snapshot) : undefined,
        }),
      () => toast.show({ message: 'Couldn’t save the deletion. It may reappear after restarting.', tone: 'error' }),
    );
  };

  const done = original?.completedAt != null;

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title={isEdit ? 'Edit task' : 'New task'} onBack={navigation.goBack} backIcon="close" />}
      footer={
        <View style={styles.footer}>
          {error ? <InlineError message={error} /> : null}
          <Button
            title={saving ? 'Saving…' : error ? 'Try again' : isEdit ? 'Save changes' : 'Add task'}
            icon={error ? 'refresh' : 'checkmark'}
            onPress={save}
            loading={saving}
          />
        </View>
      }
    >
      <View style={styles.form}>
        <TextField
          label="Task"
          placeholder="What needs to get done?"
          value={form.title}
          onChangeText={(v) => {
            setForm((f) => ({ ...f, title: v }));
            if (titleError) setTitleError(null);
          }}
          error={titleError}
          maxLength={120}
          autoFocus={!isEdit}
          autoCapitalize="sentences"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
        />

        <View>
          <AppText variant="label" tone="secondary" style={styles.label}>
            Due date
          </AppText>
          <DueDatePicker
            value={form.due}
            today={today}
            weekStartsOn={weekStartsOn}
            onChange={(due) => setForm((f) => ({ ...f, due }))}
          />
        </View>

        <View>
          <AppText variant="label" tone="secondary" style={styles.label}>
            Priority
          </AppText>
          <SegmentedControl<Priority>
            accessibilityLabel="Priority"
            value={form.priority}
            onChange={(priority) => setForm((f) => ({ ...f, priority }))}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          />
        </View>

        <TextField
          label="Notes (optional)"
          placeholder="Add details, links or sub-steps"
          value={form.notes}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
          multiline
          maxLength={500}
        />

        {original && (
          <View style={styles.actions}>
            <Button
              title={done ? 'Mark as not done' : 'Mark as done'}
              icon={done ? 'arrow-undo-outline' : 'checkmark-done-outline'}
              variant="secondary"
              size="md"
              onPress={saveAndToggle}
              disabled={saving}
              accessibilityHint="Saves your changes and closes the task"
            />
            <Button title="Delete task" icon="trash-outline" variant="danger" size="md" onPress={remove} disabled={saving} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xxl },
  label: { marginBottom: spacing.md, marginLeft: spacing.xs },
  actions: { gap: spacing.lg },
  footer: { gap: spacing.sm },
});
