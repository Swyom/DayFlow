import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AuthHeader } from '../../components/auth/AuthHeader';
import { AppText, Button, Card, Screen, ScreenHeader, TextField } from '../../components/ui';
import { LIMITS } from '../../constants/limits';
import { cleanRecoveryInput, RECOVERY_DAYS, RECOVERY_MESSAGES, RecoveryErrors, validateRecoveryInput } from '../../domain/recovery';
import type { RootScreenProps } from '../../navigation/types';
import { CloudUnavailableError, RecoveryUnavailableError } from '../../services/cloudSync';
import { useProfileContext } from '../../state/ProfileProvider';
import { spacing } from '../../theme';
import { notify } from '../../utils/confirm';

const TITLE = 'Restore profile';

/**
 * Restores a profile deleted in the last 7 days. The server checks the email and mobile
 * number against the retained record and enforces the attempt limit; this screen only
 * reports the outcome. Every mismatch gets the same message, so nothing about other
 * accounts is revealed.
 */
export default function RecoverProfileScreen({ navigation }: RootScreenProps<'RecoverProfile'>) {
  const { recoverProfile, recoveryArchive } = useProfileContext();
  const mobileRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [errors, setErrors] = useState<RecoveryErrors>({});
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (blocked) {
      notify(TITLE, RECOVERY_MESSAGES.rateLimited);
      return;
    }
    const next = validateRecoveryInput(email, mobile);
    setErrors(next);
    if (next.email || next.mobile) return;

    setBusy(true);
    try {
      const clean = cleanRecoveryInput(email, mobile);
      const result = await recoverProfile(clean.email, clean.mobile);
      if (result.status === 'restored') {
        notify('Welcome back', 'Your profile has been restored.');
        return; // navigation switches to the app automatically
      }
      if (result.status === 'rate_limited') {
        setBlocked(true);
        notify(TITLE, RECOVERY_MESSAGES.rateLimited);
      } else {
        notify(TITLE, RECOVERY_MESSAGES.notFound);
      }
    } catch (e) {
      notify(
        TITLE,
        e instanceof RecoveryUnavailableError
          ? RECOVERY_MESSAGES.unavailable
          : e instanceof CloudUnavailableError
            ? RECOVERY_MESSAGES.offline
            : RECOVERY_MESSAGES.failed,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title={TITLE} onBack={navigation.goBack} />}
      footer={<Button title="Restore profile" icon="refresh" onPress={submit} loading={busy} disabled={blocked} />}
    >
      <AuthHeader
        title="Restore a deleted profile"
        subtitle={`Enter the email address and mobile number you used. Profiles can be restored for ${RECOVERY_DAYS} days after they were deleted.`}
      />
      <View style={styles.form}>
        <TextField
          label="Email address"
          icon="mail-outline"
          placeholder="you@example.com"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
          }}
          error={errors.email}
          maxLength={LIMITS.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => mobileRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={mobileRef}
          label="Mobile number"
          icon="call-outline"
          placeholder="+91 98765 43210"
          value={mobile}
          onChangeText={(v) => {
            setMobile(v);
            if (errors.mobile) setErrors((e) => ({ ...e, mobile: undefined }));
          }}
          error={errors.mobile}
          hint="The same number, with the same country code."
          maxLength={LIMITS.mobileInput}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>

      <Card elevation="insetSm" style={styles.info}>
        <AppText variant="caption" tone="secondary">
          {recoveryArchive
            ? `Habits, tasks, steps and screen time from the profile deleted on this phone are kept here until ${new Date(
                recoveryArchive.expiresAt,
              ).toLocaleDateString()} and come back with it.`
            : 'Habits, tasks, steps and screen time are only stored on the phone they were made on, so they come back only when you restore on that phone within the restore period.'}{' '}
          Profile photos can’t be restored. For your security you have 5 attempts a day.
        </AppText>
      </Card>

      <Button title="Create a new profile instead" variant="ghost" size="md" onPress={navigation.goBack} style={styles.alt} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  info: { marginTop: spacing.xxl },
  alt: { marginTop: spacing.md },
});
