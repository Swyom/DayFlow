import React, { forwardRef, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { fonts, radius, spacing, typography, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Hide the visible label (still announced by screen readers). */
  hideLabel?: boolean;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Inset (pressed-in) text input with label, focus ring, inline error and password reveal. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hideLabel, error, hint, icon, secure, multiline, containerStyle, onFocus, onBlur, ...inputProps },
  ref,
) {
  const { colors, shadows } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  const ringColor = error ? colors.danger : focused ? colors.primary : 'transparent';

  return (
    <View style={containerStyle}>
      {!hideLabel && (
        <AppText variant="label" tone="secondary" style={styles.label}>
          {label}
        </AppText>
      )}
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          { backgroundColor: colors.well, borderColor: ringColor },
          shadows.inset,
        ]}
      >
        {icon && (
          <View style={styles.leading}>
            <Icon name={icon} size={19} color={focused ? colors.primary : colors.textSecondary} />
          </View>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          secureTextEntry={hidden}
          multiline={multiline}
          maxFontSizeMultiplier={1.35}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, { color: colors.text }]}
          {...inputProps}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={styles.trailing}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon name="alert-circle-outline" size={15} color={colors.danger} />
          <AppText variant="caption" tone="danger" style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" tone="secondary" style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm, marginLeft: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
  },
  multiline: { alignItems: 'flex-start', minHeight: 110, paddingVertical: spacing.md },
  leading: { marginRight: spacing.md },
  trailing: { marginLeft: spacing.sm, padding: spacing.xs },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.md,
  },
  inputMultiline: { textAlignVertical: 'top', paddingVertical: 0, minHeight: 84 },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, marginLeft: spacing.xs },
  hint: { marginTop: spacing.sm, marginLeft: spacing.xs },
  flex: { flex: 1 },
});
