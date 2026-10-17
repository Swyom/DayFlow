import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Screen, ScreenHeader, TextField } from '../../components/ui';
import type { RootScreenProps } from '../../navigation/types';
import { useProfile, useProfileContext } from '../../state/ProfileProvider';
import { spacing } from '../../theme';

const CONFIRM_WORD = 'DELETE';

/** Deleting the profile is irreversible, so it asks the person to type DELETE first. */
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
      setError('Couldn’t delete your cloud data. Check your internet connection and try again. Nothing was deleted.');
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Delete profile" onBack={navigation.goBack} backIcon="close" />}
      footer={<Button title="Delete everything" variant="danger" icon="trash-outline" onPress={submit} loading={deleting} />}
    >
      <View style={styles.form}>
        <AppText variant="body" tone="secondary">
          This permanently deletes {profile.fullName}’s profile, photo, habits, tasks, scores, step history and screen-time
          records from this phone and from DayFlow’s cloud. This can’t be undone.
        </AppText>
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
});
