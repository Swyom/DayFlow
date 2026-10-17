import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthHeader } from '../../components/auth/AuthHeader';
import { ProfileFields } from '../../components/profile/ProfileFields';
import { AppText, Button, Screen } from '../../components/ui';
import { cleanProfileInput, FIELD_LABELS, invalidFields, ProfileErrors, ProfileField, ProfileInput, validateProfile } from '../../domain/profile';
import type { RootScreenProps } from '../../navigation/types';
import { DuplicateProfileError, isCloudConfigured } from '../../services/cloudSync';
import { useProfileContext } from '../../state/ProfileProvider';
import { spacing } from '../../theme';
import { notify } from '../../utils/confirm';

/**
 * First-run profile. Every field is required: the app can't be entered until the form
 * is complete, and an alert lists whatever is still missing.
 */
export default function ProfileSetupScreen({ navigation }: RootScreenProps<'ProfileSetup'>) {
  const { createProfile, legacyAccount } = useProfileContext();
  const [form, setForm] = useState<ProfileInput>(() => ({
    fullName: legacyAccount?.name ?? '',
    email: legacyAccount?.email ?? '',
    mobile: '',
    age: '',
    location: null,
  }));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const clearError = useCallback((f: ProfileField) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e)), []);

  const submit = async () => {
    const next = validateProfile(form);
    setErrors(next);
    const missing = invalidFields(next);
    if (missing.length) {
      notify(
        'Please complete the form',
        `DayFlow needs all of your details before you can continue.\n\nStill to fill in: ${missing.map((f) => FIELD_LABELS[f]).join(', ')}.`,
      );
      return;
    }
    setSaving(true);
    try {
      await createProfile(cleanProfileInput(form));
      // Navigation switches to the app automatically once the profile exists.
    } catch (e) {
      setSaving(false);
      if (e instanceof DuplicateProfileError) {
        setErrors((prev) => ({ ...prev, email: 'This email is already in use.' }));
        notify('Email already registered', 'This email address is already in use by another profile. Please use a different email.');
        return;
      }
      const msg = e instanceof Error && e.message ? e.message : 'Please check your connection and storage, then try again.';
      notify('Couldn’t save your profile', msg);
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      footer={<Button title="Continue" icon="arrow-forward" iconPosition="right" onPress={submit} loading={saving} />}
    >
      <AuthHeader
        title={legacyAccount ? 'Update your profile' : 'Set up your profile'}
        subtitle={
          legacyAccount
            ? 'DayFlow no longer needs a password. Add a few details to keep your habits and tasks.'
            : 'A few details to personalise DayFlow. All fields are required.'
        }
      />
      <ProfileFields value={form} onChange={setForm} errors={errors} onClearError={clearError} autoDetectLocation />
      <View style={styles.note}>
        <AppText variant="caption" tone="secondary" align="center">
          Your profile is saved on this phone and backed up to DayFlow’s secure cloud, where only this app on this phone can
          read it. Your registration date is recorded automatically. You can add a profile photo later in Settings.
        </AppText>
      </View>
      {isCloudConfigured() ? (
        <Button
          title="Restore a deleted profile"
          icon="refresh"
          variant="ghost"
          size="md"
          onPress={() => navigation.navigate('RecoverProfile')}
          style={styles.restore}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.xxl },
  restore: { marginTop: spacing.md },
});
