import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Screen, ScreenHeader, TextField } from '../../components/ui';
import type { RootScreenProps } from '../../navigation/types';
import { useProfile, useProfileContext } from '../../state/ProfileProvider';
import { spacing } from '../../theme';

const CONFIRM_WORD = 'DELETE';

/**
 * Permanent account deletion. Asks the user to type DELETE to confirm.
 * Erases cloud profile, avatar in Supabase Storage, and all local AsyncStorage records immediately.
 */
export default function DeleteAccountScreen({ navigation }: RootScreenProps<'DeleteAccount'>) {
  const profile = useProfile();
  const { deleteProfile } = useProfileContext();
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
      await deleteProfile();
      // Navigation switches to profile setup automatically.
    } catch {
      setDeleting(false);
      setError('Couldn’t reach DayFlow’s servers to delete your cloud profile. Check your internet connection and try again. Nothing was deleted.');
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Delete profile" onBack={navigation.goBack} backIcon="close" />}
      footer={
        <Button
          title="Delete permanently"
          variant="danger"
          icon="trash-outline"
          onPress={submit}
          loading={deleting}
        />
      }
    >
      <View style={styles.form}>
        <Card elevation="insetSm" style={styles.info}>
          <AppText variant="bodyStrong">This action is permanent and cannot be undone</AppText>
          <AppText variant="body" tone="secondary">
            {profile.fullName}’s profile details, photo, habits, tasks, scores, step history, and screen-time records will be permanently deleted from this phone and from DayFlow’s cloud servers.
          </AppText>
          <AppText variant="body" tone="secondary">
            DayFlow does not offer profile restoration. Once deleted, your account cannot be recovered.
          </AppText>
          <AppText variant="caption" tone="muted">
            Note: DayFlow accounts with 7 consecutive days of inactivity are also permanently and automatically deleted.
          </AppText>
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
