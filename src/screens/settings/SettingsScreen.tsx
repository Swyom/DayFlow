import React, { ReactNode } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import {
  AppText,
  Avatar,
  Button,
  Card,
  ListRow,
  PressableSurface,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Icon,
} from '../../components/ui';
import { useToast } from '../../components/feedback/ToastProvider';
import { APP_NAME, APP_VERSION } from '../../constants/app';
import type { RootScreenProps } from '../../navigation/types';
import { useProfile, useProfileContext } from '../../state/ProfileProvider';
import { useData, useDataActions } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { requestNotificationPermission } from '../../services/notificationService';
import { spacing, useTheme } from '../../theme';
import type { Preferences } from '../../types/models';
import { confirm } from '../../utils/confirm';
import * as Updates from 'expo-updates';

export default function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const theme = useTheme();
  const profile = useProfile();
  const { avatarUrl } = useProfileContext();
  const { habits, tasks, snake } = useData();
  const { resetSnakeStats, resetAllData } = useDataActions();
  const { preferences, setPreference } = usePreferences();
  const toast = useToast();
  const notifications = preferences.notifications;

  const onToggleDailyReminder = async (nextValue: boolean) => {
    if (nextValue) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast.show({
          message: 'Notification permission is required to enable reminders.',
          tone: 'error',
        });
        return;
      }
    }
    setPreference('notifications', {
      ...notifications,
      enabled: nextValue,
    });
  };

  const onToggleInactivityAlert = async (nextValue: boolean) => {
    if (nextValue) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast.show({
          message: 'Notification permission is required to enable safety alerts.',
          tone: 'error',
        });
        return;
      }
    }
    setPreference('notifications', {
      ...notifications,
      inactivityAlert: nextValue,
    });
  };

  const onChangeReminderTime = (time: string) => {
    setPreference('notifications', {
      ...notifications,
      dailyReminderTime: time,
    });
  };

  // Asks for typed confirmation on its own screen before anything is deleted.
  const onDeleteAccount = () => navigation.navigate('DeleteAccount');

  const onResetData = async () => {
    const ok = await confirm({
      title: 'Erase all habits and tasks?',
      message: `${habits.length} habits, ${tasks.length} tasks and your Snake scores will be permanently erased. Your profile stays.`,
      confirmLabel: 'Erase',
      destructive: true,
    });
    if (ok) resetAllData();
  };

  const onResetSnake = async () => {
    const ok = await confirm({
      title: 'Reset Snake scores?',
      message: `Best score (${snake.bestScore}) and games played (${snake.gamesPlayed}) will go back to zero.`,
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (ok) resetSnakeStats();
  };

  const onCheckForUpdates = async () => {
    if (!Updates.isEnabled) {
      toast.show({ message: 'Running in development mode (connected to Metro).' });
      return;
    }
    try {
      toast.show({ message: 'Checking for updates...' });
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        toast.show({ message: 'Downloading update...' });
        await Updates.fetchUpdateAsync();
        const ok = await confirm({
          title: 'Update ready',
          message: 'A new version of DayFlow is ready to apply. Restart now?',
          confirmLabel: 'Restart',
        });
        if (ok) {
          await Updates.reloadAsync();
        }
      } else {
        toast.show({ message: 'DayFlow is already up to date!' });
      }
    } catch {
      toast.show({ message: 'Could not check for updates. Try again later.', tone: 'error' });
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Settings" onBack={navigation.goBack} />

      <PressableSurface
        onPress={() => navigation.navigate('EditProfile')}
        accessibilityLabel={`Profile: ${profile.fullName}, ${profile.email}. Edit profile`}
        padding={spacing.lg}
        style={styles.profile}
      >
        <Avatar name={profile.fullName} size={56} uri={avatarUrl} />
        <View style={styles.flex}>
          <AppText variant="title3" numberOfLines={1}>
            {profile.fullName}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {profile.email}
          </AppText>
        </View>
        <Icon name="create-outline" size={20} color={theme.colors.primary} />
      </PressableSurface>

      <SectionHeader title="Appearance" />
      <Card style={styles.prefs}>
        <Pref label="Theme">
          <SegmentedControl<Preferences['appearance']>
            accessibilityLabel="Theme"
            value={preferences.appearance}
            onChange={(v) => setPreference('appearance', v)}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Pref>
        <Pref label="Week starts on">
          <SegmentedControl<'0' | '1'>
            accessibilityLabel="Week starts on"
            value={String(preferences.weekStartsOn) as '0' | '1'}
            onChange={(v) => setPreference('weekStartsOn', Number(v) as 0 | 1)}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
          />
        </Pref>
      </Card>

      <SectionHeader title="Notifications" />
      <Card padding={spacing.xs}>
        <ListRow
          icon="target"
          title="Daily check-in"
          subtitle="1 gentle reminder if you have unfinished habits"
          right={
            <Switch
              value={notifications.enabled}
              onValueChange={onToggleDailyReminder}
              trackColor={{ false: theme.colors.well, true: theme.colors.primary }}
              thumbColor={Platform.OS === 'android' ? (notifications.enabled ? theme.colors.surface : theme.colors.textMuted) : undefined}
            />
          }
        />
        {notifications.enabled ? (
          <>
            <View style={styles.timeOptionBox}>
              <AppText variant="caption" tone="secondary" style={styles.timeLabel}>
                Check-in time
              </AppText>
              <SegmentedControl<string>
                accessibilityLabel="Check-in time"
                value={notifications.dailyReminderTime}
                onChange={onChangeReminderTime}
                options={[
                  { value: '19:00', label: '7:00 PM' },
                  { value: '20:00', label: '8:00 PM' },
                  { value: '21:00', label: '9:00 PM' },
                  { value: '21:30', label: '9:30 PM' },
                ]}
              />
            </View>
            <ListRow
              icon="sparkles"
              title="Smart suppression"
              subtitle="Automatically muted when all habits are completed"
              value="Active"
              divider
            />
            <ListRow
              icon="hourglass"
              title="Account safety alert"
              subtitle="Alert on Day 5 before 7-day inactivity deletion"
              right={
                <Switch
                  value={notifications.inactivityAlert}
                  onValueChange={onToggleInactivityAlert}
                  trackColor={{ false: theme.colors.well, true: theme.colors.primary }}
                  thumbColor={Platform.OS === 'android' ? (notifications.inactivityAlert ? theme.colors.surface : theme.colors.textMuted) : undefined}
                />
              }
              divider
            />
          </>
        ) : null}
      </Card>

      <SectionHeader title="Data" />
      <Card padding={spacing.xs}>
        <ListRow icon="trophy" title="Achievements" subtitle="Badges you’ve earned" onPress={() => navigation.navigate('Achievements')} />
        <ListRow icon="footprints" title="Steps & daily goal" onPress={() => navigation.navigate('Steps')} divider />
        <ListRow icon="phone" title="Screen time" onPress={() => navigation.navigate('ScreenTime')} divider />
        <ListRow icon="joystick" title="Reset Snake scores" onPress={onResetSnake} divider />
        <ListRow icon="trash" title="Erase habits & tasks" destructive onPress={onResetData} divider />
      </Card>

      <SectionHeader title="About" />
      <Card padding={spacing.xs}>
        <ListRow icon="logo" title={APP_NAME} value={`Version ${APP_VERSION}`} />
        <ListRow
          icon="sparkles"
          title="Check for updates"
          subtitle="Download the latest version immediately"
          onPress={onCheckForUpdates}
          divider
        />
        <ListRow
          icon="shield"
          title="Privacy & Data Retention"
          subtitle="Your habits, tasks, steps and screen-time data stay strictly on your device. Only your profile details are stored in DayFlow's cloud. Inactive accounts with 7 consecutive days of non-use are automatically and permanently deleted from both cloud and device."
          divider
        />
      </Card>

      <View style={styles.account}>
        <Button title="Delete profile & data" variant="ghost" size="md" onPress={onDeleteAccount} />
      </View>
    </Screen>
  );
}

function Pref({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <AppText variant="label" tone="secondary" style={styles.prefLabel}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1 },
  prefs: { gap: spacing.xl },
  prefLabel: { marginBottom: spacing.sm, marginLeft: spacing.xs },
  timeOptionBox: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  timeLabel: {
    marginLeft: spacing.xs,
  },
  account: { marginTop: spacing.xxxl, gap: spacing.md },
});
