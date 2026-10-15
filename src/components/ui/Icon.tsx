import React, { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** The single icon set used across the app (Ionicons, MIT). Decorative by default. */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
