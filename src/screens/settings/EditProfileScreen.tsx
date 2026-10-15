import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, Button, Screen, ScreenHeader, TextField } from '../../components/ui';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import type { RootScreenProps } from '../../navigation/types';
import { useAuth, useCurrentUser } from '../../state/AuthProvider';
import { spacing } from '../../theme';
import { validateName } from '../../utils/validation';

export default function EditProfileScreen({ navigation }: RootScreenProps<'EditProfile'>) {
  const user = useCurrentUser();
  const { updateName } = useAuth();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const exit = useDiscardGuard(name.trim() !== user.name && !saving);

  const save = async () => {
    const err = validateName(name);
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      await updateName(name);
      exit(() => navigation.goBack());
    } catch {
      setSaving(false);
      setError('Couldn’t save your name. Please try again.');
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Edit profile" onBack={navigation.goBack} backIcon="close" />}
      footer={<Button title="Save" icon="checkmark" onPress={save} loading={saving} />}
    >
      <View style={styles.avatar}>
        <Avatar name={name || user.name} size={88} />
      </View>
      <View style={styles.form}>
        <TextField
          label="Name"
          icon="person-outline"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError(null);
          }}
          error={error}
          maxLength={40}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <View>
          <TextField label="Email" icon="mail-outline" value={user.email} editable={false} />
          <AppText variant="caption" tone="secondary" style={styles.note}>
            Your email identifies this profile on the device and can’t be changed.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', marginVertical: spacing.xl },
  form: { gap: spacing.xl },
  note: { marginTop: spacing.sm, marginLeft: spacing.xs },
});
