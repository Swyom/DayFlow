import React, { memo } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { ICONS_3D, Icon3DName } from '../../constants/icons3d';

export type { Icon3DName };

type Props = {
  name: Icon3DName;
  size?: number;
  /** Dim inactive/locked states without swapping assets. */
  muted?: boolean;
  style?: StyleProp<ImageStyle>;
};

/**
 * Bundled 3D icon. Decorative by default (the surrounding control carries the label).
 * `fadeDuration={0}` stops Android's default 300ms fade-in, which causes visible
 * flicker when lists or tabs re-mount.
 */
export const Icon3D = memo(function Icon3D({ name, size = 28, muted = false, style }: Props) {
  return (
    <Image
      source={ICONS_3D[name]}
      fadeDuration={0}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[{ width: size, height: size, opacity: muted ? 0.45 : 1 }, style]}
    />
  );
});
