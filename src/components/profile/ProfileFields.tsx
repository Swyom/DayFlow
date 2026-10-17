import React, { useCallback, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { LIMITS } from '../../constants/limits';
import type { ProfileErrors, ProfileField, ProfileInput } from '../../domain/profile';
import { spacing } from '../../theme';
import type { ProfileLocation } from '../../types/models';
import { TextField } from '../ui';
import { LocationField } from './LocationField';

type Props = {
  value: ProfileInput;
  onChange: (next: ProfileInput) => void;
  errors: ProfileErrors;
  onClearError: (field: ProfileField) => void;
  autoDetectLocation?: boolean;
};

/** Name, email, mobile, age and location inputs shared by profile setup and edit. */
export function ProfileFields({ value, onChange, errors, onClearError, autoDetectLocation }: Props) {
  const emailRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const latest = useRef(value);
  latest.current = value;

  const set = (field: Exclude<ProfileField, 'location'>) => (text: string) => {
    onChange({ ...latest.current, [field]: text });
    if (errors[field]) onClearError(field);
  };
  const setLocation = useCallback(
    (location: ProfileLocation | null) => {
      onChange({ ...latest.current, location });
      if (location) onClearError('location');
    },
    [onChange, onClearError],
  );

  return (
    <View style={styles.form}>
      <TextField
        label="Full name"
        icon="person-outline"
        placeholder="e.g. Asha Patnaik"
        value={value.fullName}
        onChangeText={set('fullName')}
        error={errors.fullName}
        maxLength={LIMITS.fullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={emailRef}
        label="Email address"
        icon="mail-outline"
        placeholder="you@example.com"
        value={value.email}
        onChangeText={set('email')}
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
        value={value.mobile}
        onChangeText={set('mobile')}
        error={errors.mobile}
        hint="Include your country code, e.g. +91."
        maxLength={LIMITS.mobileInput}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => ageRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={ageRef}
        label="Age"
        icon="calendar-outline"
        placeholder="Years"
        value={value.age}
        onChangeText={(t) => set('age')(t.replace(/\D/g, ''))}
        error={errors.age}
        maxLength={3}
        keyboardType="number-pad"
        returnKeyType="done"
      />
      <LocationField value={value.location} onChange={setLocation} error={errors.location} autoDetect={autoDetectLocation} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
});
