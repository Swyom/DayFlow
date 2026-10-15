import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Screen, ScreenHeader, TextField } from '../../components/ui';
import { LIMITS } from '../../constants/limits';
import type { RootScreenProps } from '../../navigation/types';
import { AuthError } from '../../services/auth';
import { useAuth, useCurrentUser } from '../../state/AuthProvider';
import { spacing } from '../../theme';

/** Deleting an account is irreversible, so it asks for the password again first. */
export default function DeleteAccountScreen({ navigation }: RootScreenProps<'DeleteAccount'>) {
  const user = useCurrentUser();
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submit = async () => {
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(password);
      // Navigation switches to the signed-out stack automatically.
    } catch (e) {
      setDeleting(false);
      setError(e instanceof AuthError ? e.message : 'Couldn’t delete your account. Please try again.');
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Delete account" onBack={navigation.goBack} backIcon="close" />}
      footer={<Button title="Delete account" variant="danger" icon="trash-outline" onPress={submit} loading={deleting} />}
    >
      <View style={styles.form}>
        <AppText variant="body" tone="secondary">
          This permanently deletes {user.email} and all of its habits, tasks and scores from this device. This can’t be
          undone.
        </AppText>
        <TextField
          label="Password"
          icon="lock-closed-outline"
          placeholder="Your password"
          secure
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) setError(null);
          }}
          error={error}
          maxLength={LIMITS.passwordMax}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
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
