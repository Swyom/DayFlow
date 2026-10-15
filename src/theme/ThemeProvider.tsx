import React, { createContext, ReactNode, useContext } from 'react';
import { useColorScheme, ViewStyle } from 'react-native';
import { AccentHue, accentHues, darkPalette, lightPalette, Palette } from './palette';
import { buildShadows, Elevation } from './shadows';

export type AppearancePreference = 'system' | 'light' | 'dark';

export type Theme = {
  colors: Palette;
  shadows: Record<Elevation, ViewStyle>;
  isDark: boolean;
  /** Resolves a habit accent hue for the active scheme. */
  accent: (hue: AccentHue) => string;
};

function createTheme(colors: Palette): Theme {
  const isDark = colors.scheme === 'dark';
  return {
    colors,
    shadows: buildShadows(colors),
    isDark,
    accent: (hue) => accentHues[hue][isDark ? 'dark' : 'light'],
  };
}

const lightTheme = createTheme(lightPalette);
const darkTheme = createTheme(darkPalette);

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({
  preference,
  children,
}: {
  preference: AppearancePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const resolved = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return (
    <ThemeContext.Provider value={resolved === 'dark' ? darkTheme : lightTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
