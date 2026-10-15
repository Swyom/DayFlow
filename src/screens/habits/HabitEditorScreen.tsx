import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useToast } from '../../components/feedback/ToastProvider';
import { HuePicker, IconPicker, WeekdayPicker } from '../../components/habits/HabitPickers';
import {
  AppText,
  Button,
  Card,
  Chip,
  IconBadge,
  InlineError,
  Screen,
  ScreenHeader,
  Stepper,
  TextField,
} from '../../components/ui';
import { EVERY_DAY, HABIT_TARGET_MAX, HABIT_TEMPLATES, WEEKDAYS, WEEKENDS } from '../../constants/habits';
import { describeSchedule, describeTarget } from '../../domain/habits';
import { useCommit } from '../../hooks/useCommit';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import type { RootScreenProps } from '../../navigation/types';
import type { HabitInput } from '../../state/dataReducer';
import { useData, useDataActions } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { spacing, useTheme } from '../../theme';
import type { Habit, Weekday } from '../../types/models';
import { confirm } from '../../utils/confirm';
import { validateName } from '../../utils/validation';

const BLANK: HabitInput = { name: '', icon: 'plant', hue: 'teal', target: 1, unit: '', days: EVERY_DAY, notes: '' };

const sameDays = (a: Weekday[], b: Weekday[]) => a.length === b.length && b.every((d) => a.includes(d));

export default function HabitEditorScreen({ route, navigation }: RootScreenProps<'HabitEditor'>) {
  const theme = useTheme();
  const toast = useToast();
  const { weekStartsOn } = usePreferences().preferences;
  const { habits } = useData();
  const { addHabit, updateHabit, deleteHabit, restoreHabit } = useDataActions();

  // Snapshot once: the store changes underneath us while saving/deleting and the
  // header must not flip to "New habit" during the closing animation.
  const [original] = useState<Habit | undefined>(() => habits.find((h) => h.id === route.params?.habitId));
  const isEdit = !!original;
  const [initial] = useState<HabitInput>(() =>
    original
      ? { name: original.name, icon: original.icon, hue: original.hue, target: original.target, unit: original.unit, days: original.days, notes: original.notes }
      : BLANK,
  );
  const [form, setForm] = useState<HabitInput>(initial);
  const [errors, setErrors] = useState<{ name?: string | null; days?: string | null }>({});
  /** Id of a habit this screen already created; retries update it instead of duplicating. */
  const createdId = useRef<string | null>(null);
  const { saving, error, commit } = useCommit();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const exit = useDiscardGuard(dirty);

  const update = <K extends keyof HabitInput>(key: K, value: HabitInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'name' && errors.name) setErrors((e) => ({ ...e, name: null }));
    if (key === 'days' && errors.days) setErrors((e) => ({ ...e, days: null }));
  };

  const save = async () => {
    const next = {
      name: validateName(form.name, 'habit name'),
      days: form.days.length ? null : 'Pick at least one day.',
    };
    setErrors(next);
    if (next.name || next.days) return;
    const input = { ...form, unit: form.target > 1 ? form.unit : '' };
    const ok = await commit(() => {
      const id = original?.id ?? createdId.current;
      if (id) return updateHabit(id, input);
      const created = addHabit(input);
      createdId.current = created.id;
      return created.saved;
    });
    if (!ok) return;
    toast.show({ message: isEdit ? 'Habit updated' : `“${input.name.trim()}” added`, tone: 'success' });
    exit(() => navigation.goBack());
  };

  const remove = async () => {
    if (!original) return;
    const yes = await confirm({
      title: `Delete “${original.name}”?`,
      message: 'Its streaks and check-in history will be removed. You can undo right after.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!yes) return;
    // Leave the (now orphaned) detail screen behind as well, then delete.
    exit(() => navigation.popTo('Main'));
    const { snapshot, saved } = deleteHabit(original.id);
    saved.then(
      () =>
        toast.show({
          message: `“${original.name}” deleted`,
          actionLabel: snapshot ? 'Undo' : undefined,
          onAction: snapshot ? () => void restoreHabit(snapshot) : undefined,
        }),
      () => toast.show({ message: 'Couldn’t save the deletion. It may reappear after restarting.', tone: 'error' }),
    );
  };

  const accent = theme.accent(form.hue);

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title={isEdit ? 'Edit habit' : 'New habit'} onBack={navigation.goBack} backIcon="close" />}
      footer={
        <View style={styles.footer}>
          {error ? <InlineError message={error} /> : null}
          <Button
            title={saving ? 'Saving…' : error ? 'Try again' : isEdit ? 'Save changes' : 'Create habit'}
            icon={error ? 'refresh' : 'checkmark'}
            onPress={save}
            loading={saving}
          />
        </View>
      }
    >
      {/* Live preview */}
      <Card style={styles.preview} accessibilityLabel="Preview">
        <IconBadge icon={form.icon} color={accent} size={52} />
        <View style={styles.flex}>
          <AppText variant="title3" numberOfLines={1} tone={form.name.trim() ? 'primary' : 'muted'}>
            {form.name.trim() || 'Habit name'}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {describeTarget(form)} · {form.days.length ? describeSchedule(form.days, weekStartsOn) : 'No days'}
          </AppText>
        </View>
      </Card>

      {!isEdit && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templates} style={styles.templatesScroll}>
          {HABIT_TEMPLATES.map((t) => (
            <Chip
              key={t.name}
              label={t.name}
              icon3d={t.icon}
              selected={form.name === t.name}
              onPress={() => setForm({ ...t, notes: form.notes })}
              accessibilityLabel={`Use template ${t.name}`}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.form}>
        <TextField
          label="Name"
          placeholder="e.g. Drink water"
          value={form.name}
          onChangeText={(v) => update('name', v)}
          error={errors.name}
          maxLength={40}
          autoCapitalize="sentences"
          returnKeyType="done"
        />

        <Field label="Icon">
          <IconPicker value={form.icon} color={accent} onChange={(v) => update('icon', v)} />
        </Field>

        <Field label="Colour">
          <HuePicker value={form.hue} onChange={(v) => update('hue', v)} />
        </Field>

        <Field label="Daily goal">
          <Stepper
            label="Daily goal"
            value={form.target}
            min={1}
            max={HABIT_TARGET_MAX}
            suffix={form.target === 1 ? 'once a day' : form.unit.trim() || 'times a day'}
            onChange={(v) => update('target', v)}
          />
          {form.target > 1 && (
            <TextField
              label="Unit (optional)"
              placeholder="glasses, pages, minutes…"
              value={form.unit}
              onChangeText={(v) => update('unit', v)}
              maxLength={16}
              containerStyle={styles.unit}
            />
          )}
        </Field>

        <Field label="Repeat on" error={errors.days}>
          <View style={styles.presets}>
            {[
              { label: 'Every day', days: EVERY_DAY },
              { label: 'Weekdays', days: WEEKDAYS },
              { label: 'Weekends', days: WEEKENDS },
            ].map((p) => (
              <Chip key={p.label} label={p.label} selected={sameDays(form.days, p.days)} onPress={() => update('days', p.days)} />
            ))}
          </View>
          <WeekdayPicker value={form.days} weekStartsOn={weekStartsOn} onChange={(v) => update('days', v)} />
        </Field>

        <TextField
          label="Notes (optional)"
          placeholder="Why does this habit matter to you?"
          value={form.notes}
          onChangeText={(v) => update('notes', v)}
          multiline
          maxLength={280}
        />

        {isEdit && <Button title="Delete habit" icon="trash-outline" variant="danger" size="md" onPress={remove} disabled={saving} />}
      </View>
    </Screen>
  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <View>
      <AppText variant="label" tone="secondary" style={styles.fieldLabel}>
        {label}
      </AppText>
      {children}
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.fieldError} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  templatesScroll: { marginHorizontal: -spacing.xl, marginTop: spacing.lg },
  templates: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  form: { gap: spacing.xxl, marginTop: spacing.xl },
  fieldLabel: { marginBottom: spacing.md, marginLeft: spacing.xs },
  fieldError: { marginTop: spacing.sm, marginLeft: spacing.xs },
  unit: { marginTop: spacing.lg },
  footer: { gap: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
});
