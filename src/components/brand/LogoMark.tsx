import React from 'react';
import { Image } from 'react-native';

/** 512px master (scripts/icons/make_app_icons.py): sharp up to ~170dp at 3x density. */
export const LOGO_SOURCE = require('../../../assets/brand/logo.png');

/** DayFlow mark: the app icon tile (sun rising over flowing waves), with its own rounded shape. */
export function LogoMark({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={LOGO_SOURCE}
      fadeDuration={0}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="DayFlow logo"
      style={{ width: size, height: size }}
    />
  );
}
