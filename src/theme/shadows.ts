import { ViewStyle } from 'react-native';
import { Palette } from './palette';

/**
 * Depth via React Native's `boxShadow` (New Architecture, iOS + Android).
 *
 * Light theme (neumorphic): every raised element casts a light shadow up-left and a
 * dark shadow down-right; inset elements invert that so they read as pressed in.
 *
 * Dark theme (tonal elevation): a light shadow on a dark canvas reads as a shifted
 * ghost outline, so raised elements instead get a 1px inner hairline plus one soft
 * drop shadow, and rely on their lighter fill (palette `surface` / `surfaceHigh`).
 * Inset wells get a short inner shadow along the top edge. All hairlines are inset
 * shadows rather than borders, so switching theme never shifts layout.
 *
 * `pressed` is the press state of a raised surface: sinks in light, brightens in dark.
 */
export type Elevation = 'flat' | 'raisedSm' | 'raised' | 'raisedLg' | 'inset' | 'insetSm' | 'pressed';

const LEVELS = {
  raisedSm: { offset: 3, blur: 6 },
  raised: { offset: 6, blur: 14 },
  raisedLg: { offset: 10, blur: 24 },
  insetSm: { offset: 2, blur: 4 },
  inset: { offset: 4, blur: 8 },
} as const;

/** Dark drop shadows: [y offset, blur] per raised level (straight down, like overhead light). */
const DARK_DROP = {
  raisedSm: [2, 6],
  raised: [6, 16],
  raisedLg: [10, 28],
} as const;

export function buildShadows(p: Palette): Record<Elevation, ViewStyle> {
  return p.scheme === 'dark' ? buildDarkShadows(p) : buildLightShadows(p);
}

function buildLightShadows(p: Palette): Record<Elevation, ViewStyle> {
  const raised = (o: number, b: number): ViewStyle => ({
    boxShadow: `${-o}px ${-o}px ${b}px ${p.shadowLight}, ${o}px ${o}px ${b}px ${p.shadowDark}`,
  });
  const inset = (o: number, b: number): ViewStyle => ({
    boxShadow: `inset ${o}px ${o}px ${b}px ${p.shadowDark}, inset ${-o}px ${-o}px ${b}px ${p.shadowLight}`,
  });
  const insetSm = inset(LEVELS.insetSm.offset, LEVELS.insetSm.blur);
  return {
    flat: {},
    raisedSm: raised(LEVELS.raisedSm.offset, LEVELS.raisedSm.blur),
    raised: raised(LEVELS.raised.offset, LEVELS.raised.blur),
    raisedLg: raised(LEVELS.raisedLg.offset, LEVELS.raisedLg.blur),
    insetSm,
    inset: inset(LEVELS.inset.offset, LEVELS.inset.blur),
    pressed: insetSm,
  };
}

function buildDarkShadows(p: Palette): Record<Elevation, ViewStyle> {
  const hairline = `inset 0px 0px 0px 1px ${p.shadowLight}`;
  const wellEdge = 'inset 0px 0px 0px 1px rgba(255, 255, 255, 0.035)';
  const raised = ([y, b]: readonly [number, number]): ViewStyle => ({
    boxShadow: `${hairline}, 0px ${y}px ${b}px ${p.shadowDark}`,
  });
  return {
    flat: {},
    raisedSm: raised(DARK_DROP.raisedSm),
    raised: raised(DARK_DROP.raised),
    raisedLg: raised(DARK_DROP.raisedLg),
    // Faint outline keeps wells readable on the canvas, where their fill is only a shade apart.
    insetSm: { boxShadow: `inset 0px 1px 2px rgba(0, 0, 0, 0.35), ${wellEdge}` },
    inset: { boxShadow: `inset 0px 2px 4px rgba(0, 0, 0, 0.4), ${wellEdge}` },
    // Pressed raised surfaces brighten instead of sinking. Must come after the
    // element's own backgroundColor in the style array.
    pressed: { backgroundColor: p.surfaceHigh, boxShadow: hairline },
  };
}

/** Soft coloured glow for filled accent elements (primary buttons, active checks). */
export function accentGlow(color: string, p: Palette): ViewStyle {
  if (p.scheme === 'dark') {
    return { boxShadow: `0px 4px 14px ${color}38, inset 0px 1px 0px rgba(255,255,255,0.22)` };
  }
  return {
    boxShadow: `-3px -3px 8px ${p.shadowLight}, 4px 6px 14px ${color}55, inset 1px 1px 1px rgba(255,255,255,0.25)`,
  };
}
