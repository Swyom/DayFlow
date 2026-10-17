import React, { ReactNode } from 'react';
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
import { useProfile, useProfileContext } from '../../state/ProfileProvider';
import { useData, useDataActions } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { spacing, useTheme } from '../../theme';
import type { Preferences } from '../../types/models';
import { confirm } from '../../utils/confirm';

export default function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const theme = useTheme();
  const profile = useProfile();
  const { avatarUrl } = useProfileContext();
  const { habits, tasks, snake } = useData();
  const { resetSnakeStats, resetAllData } = useDataActions();
  const { preferences, setPreference } = usePreferences();
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
          icon="shield"
          title="Privacy"
          subtitle="Your habits, tasks, steps and screen-time data stay on your device. Only the information you submit for your profile is stored in DayFlow’s cloud."
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
  account: { marginTop: spacing.xxxl, gap: spacing.md },
});
