import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AuthHeader, DeviceNote } from '../../components/auth/AuthHeader';
import { AppText, Button, Screen, TextField } from '../../components/ui';
import { LIMITS } from '../../constants/limits';
import type { RootScreenProps } from '../../navigation/types';
import { AuthError } from '../../services/auth';
import { useAuth } from '../../state/AuthProvider';
import { fonts, spacing } from '../../theme';
import { validateEmail } from '../../utils/validation';

type Errors = { email?: string | null; password?: string | null; form?: string | null };

export default function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const { logIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const next: Errors = {
      email: validateEmail(email),
      password: password ? null : 'Enter your password.',
    };
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    try {
      await logIn({ email, password });
      // Navigation switches automatically once the session is set.
    } catch (e) {
      if (e instanceof AuthError) setErrors(e.field ? { [e.field]: e.message } : { form: e.message });
      else setErrors({ form: 'Something went wrong. Please try again.' });
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <AuthHeader title="Welcome back" subtitle="Log in to pick up your streaks where you left off." />

      <View style={styles.form}>
        <TextField
          label="Email"
          maxLength={LIMITS.email}
          icon="mail-outline"
          placeholder="you@example.com"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errors.email) setErrors((e) => ({ ...e, email: null }));
          }}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={passwordRef}
          label="Password"
          maxLength={LIMITS.passwordMax}
          icon="lock-closed-outline"
          placeholder="Your password"
          secure
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors((e) => ({ ...e, password: null }));
          }}
          error={errors.password}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {errors.form ? (
          <AppText variant="callout" tone="danger" accessibilityLiveRegion="polite">
            {errors.form}
          </AppText>
        ) : null}
        <Button title="Log in" onPress={submit} loading={submitting} style={styles.submit} />
      </View>

      <View style={styles.switchRow}>
        <AppText variant="callout" tone="secondary">
          New to DayFlow?
        </AppText>
        <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={12} accessibilityRole="link">
          <AppText variant="callout" tone="accent" style={styles.link}>
            Create an account
          </AppText>
        </Pressable>
      </View>
      <DeviceNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xxl, flexWrap: 'wrap' },
  link: { fontFamily: fonts.bold },
});
