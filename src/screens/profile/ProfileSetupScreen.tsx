import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthHeader } from '../../components/auth/AuthHeader';
import { ProfileFields } from '../../components/profile/ProfileFields';
import { AppText, Button, Card, Icon, Screen } from '../../components/ui';
import { cleanProfileInput, FIELD_LABELS, invalidFields, ProfileErrors, ProfileField, ProfileInput, validateProfile } from '../../domain/profile';
import { DuplicateProfileError, RateLimitError } from '../../services/cloudSync';
import { useProfileContext } from '../../state/ProfileProvider';
import { spacing, useTheme } from '../../theme';
import { notify } from '../../utils/confirm';

/**
 * First-run profile setup. Every field is required: the app can't be entered until the form
 * is complete, and an alert lists whatever is still missing.
 * Duplicate emails and mobile numbers are rejected by both pre-flight checks and database unique constraints.
 */
export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { createProfile, legacyAccount, isPendingInactivityPurge, retryInactivityPurge } = useProfileContext();
  const [form, setForm] = useState<ProfileInput>(() => ({
    fullName: legacyAccount?.name ?? '',
    email: legacyAccount?.email ?? '',
    mobile: '',
    age: '',
    location: null,
  }));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [retryingPurge, setRetryingPurge] = useState(false);
  const clearError = useCallback((f: ProfileField) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e)), []);

  const handleRetryPurge = async () => {
    setRetryingPurge(true);
    try {
      await retryInactivityPurge();
    } finally {
      setRetryingPurge(false);
    }
  };

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
      if (e instanceof RateLimitError) {
        notify(
          'Account creation limit reached',
          e.message || 'You have reached the maximum of 5 account creation attempts permitted within 24 hours. Please try again later.',
        );
        return;
      }
      if (e instanceof DuplicateProfileError) {
        const nextErrors: ProfileErrors = {};
        const reasons: string[] = [];
        if (e.conflicts?.nameTaken) {
          nextErrors.fullName = 'This full name is already registered.';
          reasons.push('full name');
        }
        if (e.conflicts?.emailTaken) {
          nextErrors.email = 'This email address is already registered.';
          reasons.push('email address');
        }
        if (e.conflicts?.mobileTaken) {
          nextErrors.mobile = 'This mobile number is already registered.';
          reasons.push('mobile number');
        }
        if (reasons.length === 0) {
          nextErrors.email = 'Already in use.';
          reasons.push('details');
        }
        setErrors((prev) => ({ ...prev, ...nextErrors }));

        notify(
          'Account already in use',
          `An account with this ${reasons.join(', ')} already exists in DayFlow.\n\nPlease check your details and enter a different email address or mobile number.`,
        );
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
      footer={
        <Button
          title="Create account"
          icon="arrow-forward"
          iconPosition="right"
          onPress={submit}
          loading={saving}
          disabled={isPendingInactivityPurge}
        />
      }
    >
      {isPendingInactivityPurge ? (
        <Card style={styles.purgeBanner}>
          <View style={styles.bannerRow}>
            <Icon name="cloud-offline" size={24} color={theme.colors.warning} />
            <View style={styles.bannerContent}>
              <AppText variant="bodyStrong">Completing account cleanup</AppText>
              <AppText variant="caption" tone="secondary">
                A previous account was scheduled for deletion due to 7 days of inactivity. Connecting to the server to finalize deletion.
              </AppText>
            </View>
          </View>
          <Button
            title="Retry deletion"
            variant="secondary"
            size="md"
            onPress={handleRetryPurge}
            loading={retryingPurge}
            style={styles.retryButton}
          />
        </Card>
      ) : null}

      <AuthHeader
        title={legacyAccount ? 'Update your profile' : 'Create your account'}
        subtitle={
          legacyAccount
            ? 'DayFlow no longer needs a password. Add a few details to keep your habits and tasks.'
            : 'Enter your details to create a new DayFlow account. All fields are required.'
        }
      />
      <ProfileFields value={form} onChange={setForm} errors={errors} onClearError={clearError} autoDetectLocation />
      <View style={styles.note}>
        <AppText variant="caption" tone="secondary" align="center">
          DayFlow accounts and associated cloud data are permanently deleted after 7 consecutive days of inactivity.
          Your profile is stored securely in DayFlow’s cloud and encrypted locally on this device.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.xxl, marginBottom: spacing.md },
  purgeBanner: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.25)',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bannerContent: {
    flex: 1,
    gap: spacing.xs,
  },
  retryButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
});
