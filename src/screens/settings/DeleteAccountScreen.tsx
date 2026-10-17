import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Screen, ScreenHeader, SegmentedControl, TextField } from '../../components/ui';
import { RECOVERY_DAYS } from '../../domain/recovery';
import type { RootScreenProps } from '../../navigation/types';
import { isCloudConfigured, RecoveryUnavailableError } from '../../services/cloudSync';
import { useProfile, useProfileContext } from '../../state/ProfileProvider';
import { spacing } from '../../theme';
import { confirm } from '../../utils/confirm';

const CONFIRM_WORD = 'DELETE';
type Mode = 'recoverable' | 'permanent';

/** Deleting the profile asks the person to type DELETE first, and to choose recoverable or permanent. */
export default function DeleteAccountScreen({ navigation }: RootScreenProps<'DeleteAccount'>) {
  const profile = useProfile();
  const { deleteProfile } = useProfileContext();
  const canRecover = isCloudConfigured();
  const [mode, setMode] = useState<Mode>(canRecover ? 'recoverable' : 'permanent');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submit = async () => {
    if (text.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Type ${CONFIRM_WORD} to confirm.`);
      return;
    }
    setDeleting(true);
    try {
      await deleteProfile(mode);
      // Navigation switches to profile setup automatically.
    } catch (e) {
      if (e instanceof RecoveryUnavailableError) {
        // Nothing has been deleted. Never fall back to permanent deletion without asking.
        const permanent = await confirm({
          title: 'Restorable deletion unavailable',
          message:
            'Keeping your profile for 7 days isn’t available right now, so nothing has been deleted. You can delete everything permanently instead, or cancel and try again later.',
          confirmLabel: 'Delete permanently',
          destructive: true,
        });
        if (permanent) {
          setMode('permanent');
          try {
            await deleteProfile('permanent');
            return;
          } catch {
            // fall through to the generic message
          }
        } else {
          setDeleting(false);
          return;
        }
      }
      setDeleting(false);
      setError('Couldn’t reach DayFlow’s servers. Check your internet connection and try again. Nothing was deleted.');
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Delete profile" onBack={navigation.goBack} backIcon="close" />}
      footer={
        <Button
          title={mode === 'recoverable' ? 'Delete profile' : 'Delete permanently'}
          variant="danger"
          icon="trash-outline"
          onPress={submit}
          loading={deleting}
        />
      }
    >
      <View style={styles.form}>
        {canRecover ? (
          <SegmentedControl<Mode>
            accessibilityLabel="How to delete"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'recoverable', label: `Restorable for ${RECOVERY_DAYS} days` },
              { value: 'permanent', label: 'Permanently now' },
            ]}
          />
        ) : null}

        <Card elevation="insetSm" style={styles.info}>
          {mode === 'recoverable' ? (
            <>
              <AppText variant="bodyStrong">You can change your mind for {RECOVERY_DAYS} days</AppText>
              <AppText variant="body" tone="secondary">
                {profile.fullName}’s profile details are kept securely in DayFlow’s cloud for {RECOVERY_DAYS} days. Habits,
                tasks, steps and screen time stay on this phone only for the same time and are never uploaded.
              </AppText>
              <AppText variant="body" tone="secondary">
                To restore, choose “Restore a deleted profile” and enter the same email address and mobile number. After{' '}
                {RECOVERY_DAYS} days everything is deleted permanently and can’t be restored.
              </AppText>
              <AppText variant="body" tone="secondary">Your profile photo is deleted right away and can’t be restored.</AppText>
            </>
          ) : (
            <>
              <AppText variant="bodyStrong">This can’t be undone</AppText>
              <AppText variant="body" tone="secondary">
                {profile.fullName}’s profile, photo, habits, tasks, scores, step history and screen-time records are deleted
                from this phone and from DayFlow’s cloud right now. Nothing can be restored later.
              </AppText>
            </>
          )}
        </Card>

        <TextField
          label={`Type ${CONFIRM_WORD} to confirm`}
          icon="warning-outline"
          placeholder={CONFIRM_WORD}
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (error) setError(null);
          }}
          error={error}
          maxLength={12}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl, marginTop: spacing.lg },
  info: { gap: spacing.sm },
});
