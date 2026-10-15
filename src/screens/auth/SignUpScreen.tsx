import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AuthHeader, DeviceNote } from '../../components/auth/AuthHeader';
import { AppText, Button, IconButton, Screen, TextField } from '../../components/ui';
import { LIMITS } from '../../constants/limits';
import type { RootScreenProps } from '../../navigation/types';
import { AuthError } from '../../services/auth';
import { useAuth } from '../../state/AuthProvider';
import { fonts, spacing } from '../../theme';
import { PASSWORD_MIN, validateEmail, validateName, validatePassword } from '../../utils/validation';

type Field = 'name' | 'email' | 'password';
type Errors = Partial<Record<Field | 'form', string | null>>;

export default function SignUpScreen({ navigation }: RootScreenProps<'SignUp'>) {
  const { signUp } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field: Field) => (v: string) => {
    setValues((s) => ({ ...s, [field]: v }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const submit = async () => {
    const next: Errors = {
      name: validateName(values.name, 'name'),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
    };
    setErrors(next);
    if (next.name || next.email || next.password) return;

    setSubmitting(true);
    try {
      await signUp(values);
    } catch (e) {
      if (e instanceof AuthError) setErrors(e.field ? { [e.field]: e.message } : { form: e.message });
      else setErrors({ form: 'Something went wrong. Please try again.' });
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <View style={styles.back}>
        <IconButton icon="chevron-back" accessibilityLabel="Back to log in" onPress={navigation.goBack} />
      </View>
      <AuthHeader title="Create your account" subtitle="A few details and you’re ready to plan your first day." />

      <View style={styles.form}>
        <TextField
          label="Name"
          icon="person-outline"
          placeholder="What should we call you?"
          value={values.name}
          onChangeText={set('name')}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={40}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Email"
          maxLength={LIMITS.email}
          icon="mail-outline"
          placeholder="you@example.com"
          value={values.email}
          onChangeText={set('email')}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          maxLength={LIMITS.passwordMax}
          icon="lock-closed-outline"
          placeholder={`At least ${PASSWORD_MIN} characters`}
          secure
          value={values.password}
          onChangeText={set('password')}
          error={errors.password}
          hint={`Use ${PASSWORD_MIN} or more characters.`}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {errors.form ? (
          <AppText variant="callout" tone="danger" accessibilityLiveRegion="polite">
            {errors.form}
          </AppText>
        ) : null}
        <Button title="Create account" onPress={submit} loading={submitting} style={styles.submit} />
      </View>

      <View style={styles.switchRow}>
        <AppText variant="callout" tone="secondary">
          Already have an account?
        </AppText>
        <Pressable onPress={navigation.goBack} hitSlop={12} accessibilityRole="link">
          <AppText variant="callout" tone="accent" style={styles.link}>
            Log in
          </AppText>
        </Pressable>
      </View>
      <DeviceNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignItems: 'flex-start' },
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xxl, flexWrap: 'wrap' },
  link: { fontFamily: fonts.bold },
});
