import React, { ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { APP_NAME, APP_VERSION } from '../../constants/app';
import type { RootScreenProps } from '../../navigation/types';
import { useAuth, useCurrentUser } from '../../state/AuthProvider';
import { useData, useDataActions } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { spacing, useTheme } from '../../theme';
import type { Preferences, SnakeSpeed } from '../../types/models';
import { confirm, notify } from '../../utils/confirm';

export default function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const theme = useTheme();
  const user = useCurrentUser();
  const { logOut } = useAuth();
  const { habits, tasks, snake } = useData();
  const { resetSnakeStats, resetAllData } = useDataActions();
  const { preferences, setPreference } = usePreferences();
  const [busy, setBusy] = useState<'logout' | null>(null);

  const onLogOut = async () => {
    const ok = await confirm({
      title: 'Log out?',
      message: 'Your habits and tasks stay saved on this device for when you log back in.',
      confirmLabel: 'Log out',
    });
    if (!ok) return;
    setBusy('logout');
    await logOut().catch(() => {
      setBusy(null);
      notify('Couldn’t log out', 'Please try again.');
    });
  };

  // Asks for the password on its own screen before anything is deleted.
  const onDeleteAccount = () => navigation.navigate('DeleteAccount');

  const onResetData = async () => {
    const ok = await confirm({
      title: 'Erase all habits and tasks?',
      message: `${habits.length} habits, ${tasks.length} tasks and your Snake scores will be permanently erased. Your account stays.`,
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

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Settings" onBack={navigation.goBack} />

      <PressableSurface
        onPress={() => navigation.navigate('EditProfile')}
        accessibilityLabel={`Profile: ${user.name}, ${user.email}. Edit profile`}
        padding={spacing.lg}
        style={styles.profile}
      >
        <Avatar name={user.name} size={56} />
        <View style={styles.flex}>
          <AppText variant="title3" numberOfLines={1}>
            {user.name}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {user.email}
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
        <Pref label="Snake speed">
          <SegmentedControl<SnakeSpeed>
            accessibilityLabel="Snake speed"
            value={preferences.snakeSpeed}
            onChange={(v) => setPreference('snakeSpeed', v)}
            options={[
              { value: 'relaxed', label: 'Relaxed' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
        </Pref>
      </Card>

      <SectionHeader title="Data" />
      <Card padding={spacing.xs}>
        <ListRow icon="trophy" title="Achievements" subtitle="Badges you’ve earned" onPress={() => navigation.navigate('Achievements')} />
        <ListRow icon="joystick" title="Reset Snake scores" onPress={onResetSnake} divider />
        <ListRow icon="trash" title="Erase habits & tasks" destructive onPress={onResetData} divider />
      </Card>

      <SectionHeader title="About" />
      <Card padding={spacing.xs}>
        <ListRow icon="logo" title={APP_NAME} value={`Version ${APP_VERSION}`} />
        <ListRow
          icon="shield"
          title="Privacy"
          subtitle="Everything is stored on this device. Nothing is sent to a server."
          divider
        />
        <ListRow
          icon="memo"
          title="Credits"
          subtitle="Plus Jakarta Sans (SIL OFL 1.1) · Fluent Emoji 3D icons by Microsoft (MIT) · Ionicons (MIT) · Illustrations made for DayFlow"
          divider
        />
      </Card>

      <View style={styles.account}>
        <Button title="Log out" icon="log-out-outline" variant="secondary" onPress={onLogOut} loading={busy === 'logout'} disabled={!!busy} />
        <Button title="Delete account" variant="ghost" size="md" onPress={onDeleteAccount} disabled={!!busy} />
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
  account: { marginTop: spacing.xxxl, gap: spacing.md },
});
