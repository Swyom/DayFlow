import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AvatarPicker } from '../../components/profile/AvatarPicker';
import { ProfileFields } from '../../components/profile/ProfileFields';
import { AppText, Button, Card, Screen, ScreenHeader } from '../../components/ui';
import {
  cleanProfileInput,
  FIELD_LABELS,
  invalidFields,
  ProfileErrors,
  ProfileField,
  ProfileInput,
  validateProfile,
} from '../../domain/profile';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import type { RootScreenProps } from '../../navigation/types';
import { useProfile, useProfileContext } from '../../state/ProfileProvider';
import { spacing } from '../../theme';
import type { Profile } from '../../types/models';
import { notify } from '../../utils/confirm';

const toInput = (p: Profile): ProfileInput => ({
  fullName: p.fullName,
  email: p.email,
  mobile: p.mobile,
  age: String(p.age),
  location: p.location,
});

export function formatRegistered(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function EditProfileScreen({ navigation }: RootScreenProps<'EditProfile'>) {
  const profile = useProfile();
  const { updateProfile } = useProfileContext();
  const initial = useMemo(() => toInput(profile), [profile]);
  const [form, setForm] = useState<ProfileInput>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const clearError = useCallback((f: ProfileField) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e)), []);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const exit = useDiscardGuard(dirty && !saving);

  const save = async () => {
    const next = validateProfile(form);
    setErrors(next);
    const missing = invalidFields(next);
    if (missing.length) {
      notify('Please complete the form', `Still to fix: ${missing.map((f) => FIELD_LABELS[f]).join(', ')}.`);
      return;
    }
    setSaving(true);
    try {
      await updateProfile(cleanProfileInput(form));
      exit(() => navigation.goBack());
    } catch {
      setSaving(false);
      notify('Couldn’t save your profile', 'Please try again.');
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Edit profile" onBack={navigation.goBack} backIcon="close" />}
      footer={<Button title="Save" icon="checkmark" onPress={save} loading={saving} disabled={!dirty} />}
    >
      <AvatarPicker name={form.fullName || profile.fullName} />
      <ProfileFields value={form} onChange={setForm} errors={errors} onClearError={clearError} />
      <Card style={styles.meta} elevation="insetSm">
        <AppText variant="label" tone="secondary">
          Registered
        </AppText>
        <View>
          <AppText variant="bodyStrong">{formatRegistered(profile.registeredAt)}</AppText>
          <AppText variant="caption" tone="secondary">
            Recorded automatically when you created your profile.
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { marginTop: spacing.xxl, gap: spacing.xs },
});
