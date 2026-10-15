import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { DateKey } from '../../types/models';
import { addDays, formatLongDate, startOfWeek } from '../../utils/date';
import { spacing } from '../../theme';
import { AppText, Card, Chip, MonthCalendar } from '../ui';

type Props = {
  value: DateKey | null;
  today: DateKey;
  weekStartsOn: 0 | 1;
  onChange: (day: DateKey | null) => void;
};

/** Quick presets for the common cases, plus a full calendar for anything else. */
export function DueDatePicker({ value, today, weekStartsOn, onChange }: Props) {
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(startOfWeek(today, weekStartsOn), 7);
  const presets: { label: string; value: DateKey | null }[] = [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: tomorrow },
    { label: 'Next week', value: nextWeek },
    { label: 'No date', value: null },
  ];
  const isPreset = presets.some((p) => p.value === value);
  const [showCalendar, setShowCalendar] = useState(!isPreset);

  return (
    <View>
      <View style={styles.chips}>
        {presets.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            selected={!showCalendar && p.value === value}
            onPress={() => {
              setShowCalendar(false);
              onChange(p.value);
            }}
          />
        ))}
        <Chip
          label="Pick date"
          icon="calendar-outline"
          selected={showCalendar}
          onPress={() => {
            setShowCalendar(true);
            if (!value) onChange(today);
          }}
        />
      </View>
      {showCalendar ? (
        <Card style={styles.calendar}>
          <MonthCalendar value={value} today={today} weekStartsOn={weekStartsOn} onChange={onChange} />
        </Card>
      ) : null}
      <AppText variant="caption" tone="secondary" style={styles.summary} accessibilityLiveRegion="polite">
        {value ? `Due ${formatLongDate(value)}` : 'No due date — it will appear under Upcoming.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  calendar: { marginTop: spacing.lg },
  summary: { marginTop: spacing.md, marginLeft: spacing.xs },
});
