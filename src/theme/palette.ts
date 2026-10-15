/**
 * Colour tokens for the light (neumorphic) and dark (tonal elevation) themes.
 *
 * Light theme is neumorphic: raised/inset surfaces share the canvas colour, so
 * `surface` equals `background` and depth comes from the paired light/dark shadows.
 * Dark theme uses tonal elevation instead (light-on-dark shadows read as ghost
 * outlines): the canvas is deepest, cards are one step lighter, and anything raised
 * on a card (`surfaceHigh`) is lighter again. See shadows.ts.
 * Brand accent is ocean blue; the palette deliberately contains no purple/violet.
 * Contrast (WCAG 2.1, against `background`; dark also holds ≥4.5 on `surface`/`surfaceHigh`):
 *   light — text 13.8, textSecondary 5.8, primary 4.9, success 4.5, warning 4.6, danger 4.8
 *   dark  — text 14.3, textSecondary 7.7, primary 6.9, success 8.3, warning 9.2, danger 6.3
 */
export type Palette = {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  /** Selected keys / chips sitting on a surface. Equals `surface` in the light theme. */
  surfaceHigh: string;
  /** Slightly recessed fill used behind inset wells (inputs, tracks). */
  well: string;
  /** Press feedback for flat controls (ghost buttons, list rows), on any surface. */
  highlight: string;
  shadowDark: string;
  shadowLight: string;
  divider: string;
  /** Focus ring for keyboard / switch-access navigation. */
  focus: string;

  text: string;
  textSecondary: string;
  /** Decorative / placeholder only — below 4.5:1, never for essential copy. */
  textMuted: string;

  primary: string;
  primaryStrong: string;
  primarySoft: string;
  onPrimary: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;

  overlay: string;
  /** Snackbar background (inverted surface). */
  toast: string;
  onToast: string;
  toastAction: string;
};

export const lightPalette: Palette = {
  scheme: 'light',
  background: '#E7ECF2',
  surface: '#E7ECF2',
  surfaceHigh: '#E7ECF2',
  well: '#DFE5EC',
  highlight: '#DFE5EC',
  shadowDark: 'rgba(146, 162, 186, 0.55)',
  shadowLight: 'rgba(255, 255, 255, 0.95)',
  divider: 'rgba(110, 128, 152, 0.18)',
  focus: '#1764C0',

  text: '#18202C',
  textSecondary: '#4F5B6D',
  textMuted: '#7D899B',

  primary: '#1764C0',
  primaryStrong: '#0F519F',
  primarySoft: '#D3E3F7',
  onPrimary: '#FFFFFF',

  success: '#137A4B',
  successSoft: '#D2ECDF',
  warning: '#9A5B00',
  warningSoft: '#F4E4C8',
  danger: '#BF2F36',
  dangerSoft: '#F4D7D9',

  overlay: 'rgba(24, 32, 44, 0.55)',
  toast: '#232A35',
  onToast: '#F2F5F9',
  toastAction: '#8CC2FF',
};

export const darkPalette: Palette = {
  scheme: 'dark',
  background: '#171B21',
  surface: '#222831',
  surfaceHigh: '#2D3541',
  well: '#1A1F26',
  highlight: 'rgba(255, 255, 255, 0.06)',
  shadowDark: 'rgba(0, 0, 0, 0.32)',
  /** Hairline edge that outlines raised surfaces. */
  shadowLight: 'rgba(255, 255, 255, 0.06)',
  divider: 'rgba(255, 255, 255, 0.07)',
  focus: '#86BEF8',

  text: '#E6EAF0',
  textSecondary: '#A4AEBD',
  textMuted: '#77818F',

  primary: '#5EA8F5',
  primaryStrong: '#86BEF8',
  primarySoft: '#22364F',
  onPrimary: '#0B1A2B',

  success: '#4FC98E',
  successSoft: '#1F3A30',
  warning: '#F0B254',
  warningSoft: '#3D3424',
  danger: '#F2777B',
  dangerSoft: '#432A2E',

  overlay: 'rgba(6, 8, 12, 0.72)',
  toast: '#E6EAF0',
  onToast: '#1A1F27',
  toastAction: '#1764C0',
};

/**
 * Accent hues for user-created habits and badges, each with a light/dark variant
 * that keeps ≥3:1 contrast against its canvas. No purple.
 */
export const accentHues = {
  blue: { light: '#1F6CC4', dark: '#6AAEF5' },
  sky: { light: '#1B7FAE', dark: '#5CC2EE' },
  teal: { light: '#0E7C76', dark: '#4FD1C5' },
  green: { light: '#2E8540', dark: '#6CCB7B' },
  amber: { light: '#9E6500', dark: '#F0B04F' },
  orange: { light: '#B8540F', dark: '#F59A5B' },
  red: { light: '#C2392F', dark: '#F28A7E' },
  rose: { light: '#BE3458', dark: '#F2879F' },
} as const;

export type AccentHue = keyof typeof accentHues;
export const ACCENT_HUES = Object.keys(accentHues) as AccentHue[];

/** Maps hues stored by older versions of the app onto the current set. */
export const LEGACY_HUES: Record<string, AccentHue> = {
  indigo: 'blue',
  violet: 'teal',
  pink: 'rose',
  coral: 'red',
};

export const toAccentHue = (hue: string): AccentHue =>
  hue in accentHues ? (hue as AccentHue) : (LEGACY_HUES[hue] ?? 'blue');
