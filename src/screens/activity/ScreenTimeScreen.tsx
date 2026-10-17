import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { DayflowDevice } from '../../../modules/dayflow-device';
import { UsageDonut } from '../../components/screentime/UsageDonut';
import {
  AppText,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
} from '../../components/ui';
import { formatDuration, formatPercent, OTHER_KEY, spokenDuration, summarizeUsage } from '../../domain/screenTime';
import { useResponsive } from '../../hooks/useResponsive';
import { useToday } from '../../hooks/useToday';
import type { RootScreenProps } from '../../navigation/types';
import { radius, spacing, useTheme } from '../../theme';
import type { AppUsage, DateKey } from '../../types/models';
import { addDays, fromDateKey, lastNDays } from '../../utils/date';

type Range = 'today' | 'yesterday' | 'week';
type Access = 'checking' | 'unsupported' | 'denied' | 'granted';

const RANGE_LABEL: Record<Range, string> = { today: 'today', yesterday: 'yesterday', week: 'in the last 7 days' };

function daysFor(range: Range, today: DateKey): DateKey[] {
  if (range === 'today') return [today];
  if (range === 'yesterday') return [addDays(today, -1)];
  return lastNDays(today, 7);
}

/** Per-app foreground time for each local day, read from Android's usage stats. */
async function loadDays(days: DateKey[]): Promise<{ day: DateKey; apps: AppUsage[] }[]> {
  const device = DayflowDevice;
  if (!device) return [];
  const now = Date.now();
  const out = [];
  for (const day of days) {
    const start = fromDateKey(day).getTime();
    const end = Math.min(fromDateKey(addDays(day, 1)).getTime(), now);
    const apps = await device.getAppUsage(start, end);
    out.push({ day, apps: apps.map((a) => ({ packageName: a.packageName, appName: a.appName, usageMs: a.usageMs })) });
  }
  return out;
}

export default function ScreenTimeScreen({ navigation }: RootScreenProps<'ScreenTime'>) {
  const theme = useTheme();
  const { contentWidth } = useResponsive();
  const today = useToday();
  const [access, setAccess] = useState<Access>('checking');
  const [range, setRange] = useState<Range>('today');
  const [apps, setApps] = useState<AppUsage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const palette = useMemo(
    () => (['blue', 'teal', 'amber', 'rose', 'sky', 'green'] as const).map((h) => theme.accent(h)).concat(theme.colors.textMuted),
    [theme],
  );

  const checkAccess = useCallback(() => {
    if (Platform.OS !== 'android' || !DayflowDevice) return setAccess('unsupported');
    setAccess(DayflowDevice.hasUsageAccess() ? 'granted' : 'denied');
  }, []);

  useEffect(() => {
    checkAccess();
    // Coming back from the Usage access settings page.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkAccess());
    return () => sub.remove();
  }, [checkAccess]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const perDay = await loadDays(daysFor(range, today));
      const merged = new Map<string, AppUsage>();
      for (const { apps: list } of perDay) {
        for (const a of list) {
          const prev = merged.get(a.packageName);
          merged.set(a.packageName, prev ? { ...prev, usageMs: prev.usageMs + a.usageMs } : a);
        }
      }
      setApps([...merged.values()]);
      setSelected(null);
    } catch {
      setFailed(true);
      checkAccess();
    } finally {
      setLoading(false);
    }
  }, [range, today, checkAccess]);

  useEffect(() => {
    if (access === 'granted') void load();
  }, [access, load]);

  const summary = useMemo(() => summarizeUsage(apps ?? []), [apps]);
  const colorOf = (key: string) => {
    const i = summary.slices.findIndex((s) => s.key === key);
    return i < 0 ? theme.colors.textMuted : key === OTHER_KEY ? theme.colors.textMuted : palette[i % (palette.length - 1)];
  };
  const chartSize = Math.round(Math.min(contentWidth - spacing.xl * 2, 280));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="Screen time"
        onBack={navigation.goBack}
        right={
          access === 'granted' ? (
            <IconButton icon="refresh" accessibilityLabel="Refresh" onPress={() => void load()} disabled={loading} />
          ) : undefined
        }
      />

      {access === 'unsupported' ? (
        <Card>
          <EmptyState
            title={Platform.OS === 'ios' ? 'Not available on iPhone' : 'Not available here'}
            message={
              Platform.OS === 'ios'
                ? 'Apple doesn’t let apps read how long you use other apps. You can see your screen time in Settings → Screen Time on your iPhone. DayFlow never shows estimated or sample data.'
                : 'Screen time needs the DayFlow app installed from a build that includes its Android module (it isn’t available in Expo Go).'
            }
          />
        </Card>
      ) : access === 'denied' ? (
        <Card>
          <EmptyState
            title="Allow usage access"
            message={'To show which apps you use and for how long, Android needs you to turn on “Usage access” for DayFlow.\n\nOn the next screen, find DayFlow and switch on “Permit usage access”, then come back.'}
            actionLabel="Open usage access settings"
            actionIcon="settings-outline"
            onAction={() => DayflowDevice?.openUsageAccessSettings()}
          />
        </Card>
      ) : access === 'checking' ? null : (
        <>
          <SegmentedControl<Range>
            accessibilityLabel="Period"
            value={range}
            onChange={setRange}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'week', label: '7 days' },
            ]}
          />

          <Card padding={spacing.xl} style={styles.chartCard}>
            {loading && !apps ? (
              <ActivityIndicator color={theme.colors.primary} style={{ height: chartSize }} />
            ) : failed ? (
              <EmptyState title="Couldn’t read usage" message="Please try again." actionLabel="Retry" actionIcon="refresh" onAction={() => void load()} />
            ) : summary.totalMs === 0 ? (
              <EmptyState title="No app use recorded" message={`Android hasn’t recorded any app use ${RANGE_LABEL[range]} yet.`} />
            ) : (
              <>
                <UsageDonut
                  slices={summary.slices}
                  colors={summary.slices.map((s) => colorOf(s.key))}
                  totalMs={summary.totalMs}
                  size={chartSize}
                  selectedKey={selected}
                  onSelect={setSelected}
                />
                <AppText variant="caption" tone="secondary" align="center">
                  Tap a section or an app below for details.
                </AppText>
                <View style={styles.legend}>
                  {summary.slices.map((s) => {
                    const active = s.key === selected;
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => setSelected(active ? null : s.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${s.name}: ${spokenDuration(s.usageMs)}, ${formatPercent(s.fraction)}`}
                        style={({ pressed }) => [
                          styles.legendRow,
                          (active || pressed) && { backgroundColor: theme.colors.highlight },
                        ]}
                      >
                        <View style={[styles.dot, { backgroundColor: colorOf(s.key) }]} />
                        <AppText variant={active ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.flex}>
                          {s.name}
                        </AppText>
                        <AppText variant="label" tone="secondary">
                          {formatDuration(s.usageMs)}
                        </AppText>
                        <AppText variant="label" tone="accent" style={styles.pct}>
                          {formatPercent(s.fraction)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </Card>

          {summary.apps.length ? (
            <>
              <SectionHeader title={`All apps · ${formatDuration(summary.totalMs)}`} />
              <Card padding={spacing.xs}>
                {summary.apps.map((a, i) => {
                  const fraction = a.usageMs / summary.totalMs;
                  return (
                    <View
                      key={a.packageName}
                      accessible
                      accessibilityLabel={`${a.appName}: ${spokenDuration(a.usageMs)}, ${formatPercent(fraction)} of total`}
                      style={[styles.appRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider }]}
                    >
                      <View style={styles.appHeader}>
                        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                          {a.appName}
                        </AppText>
                        <AppText variant="label" tone="secondary">
                          {formatDuration(a.usageMs)} · {formatPercent(fraction)}
                        </AppText>
                      </View>
                      <ProgressBar progress={fraction} height={6} color={colorOf(a.packageName)} />
                    </View>
                  );
                })}
              </Card>
              <AppText variant="caption" tone="secondary" style={styles.footnote}>
                Time each app was open on screen, from Android’s usage records. Apps used for under a minute aren’t listed.
              </AppText>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chartCard: { marginTop: spacing.lg, alignItems: 'center', gap: spacing.md },
  legend: { alignSelf: 'stretch', gap: spacing.xxs },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  pct: { minWidth: 44, textAlign: 'right' },
  appRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  appHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footnote: { marginTop: spacing.md, marginHorizontal: spacing.xs },
  flex: { flex: 1, minWidth: 0 },
});
