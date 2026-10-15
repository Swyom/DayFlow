import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { Palette, typography, TypographyVariant, useTheme } from '../../theme';

type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'danger' | 'warning' | 'onPrimary';

const toneColor = (c: Palette, tone: Tone): string =>
  ({
    primary: c.text,
    secondary: c.textSecondary,
    muted: c.textMuted,
    accent: c.primary,
    success: c.success,
    danger: c.danger,
    warning: c.warning,
    onPrimary: c.onPrimary,
  })[tone];

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
  /** Overrides `tone` with an explicit colour (e.g. a habit accent). */
  color?: string;
  align?: TextStyle['textAlign'];
};

/** Themed text. Font scaling is honoured but capped so layouts don't break. */
export function AppText({
  variant = 'body',
  tone = 'primary',
  color,
  align,
  style,
  maxFontSizeMultiplier = 1.35,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[typography[variant], { color: color ?? toneColor(colors, tone), textAlign: align }, style]}
      {...rest}
    />
  );
}
