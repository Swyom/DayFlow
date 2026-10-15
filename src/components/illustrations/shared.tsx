import React, { ReactNode, useId } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme';

/**
 * Shared art direction for DayFlow's original vector illustrations:
 * a soft extruded disc (light from top-left), gently graded shapes and a
 * restrained palette that follows the active theme.
 */
export function useArtPalette() {
  const { colors, isDark } = useTheme();
  return {
    isDark,
    discTop: isDark ? '#2F3440' : '#F6F8FC',
    discBottom: isDark ? '#1E2129' : '#D6DEEA',
    groundShadow: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(110,128,160,0.22)',
    paper: isDark ? '#3A4150' : '#FFFFFF',
    paperShade: isDark ? '#2F3542' : '#E9EEF6',
    line: isDark ? '#566079' : '#CBD4E2',
    lineStrong: isDark ? '#717C96' : '#AEB9CB',
    primary: colors.primary,
    primaryLight: isDark ? '#9CCBFA' : '#5EA8F5',
    primaryDeep: isDark ? '#2F7FD6' : '#0F519F',
    mint: '#4FC59E',
    mintDeep: '#2A9C78',
    coral: '#F2826F',
    coralDeep: '#D65A48',
    amber: '#F6B84B',
    amberDeep: '#DA8E1C',
    sky: '#6CB2EF',
    white: '#FFFFFF',
  };
}

export type ArtPalette = ReturnType<typeof useArtPalette>;

/** Unique, url()-safe id prefix per illustration instance (needed on web where ids are global). */
export function useArtId() {
  return `art${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

type FrameProps = {
  size: number;
  children: (ids: { id: (name: string) => string; url: (name: string) => string }, p: ArtPalette) => ReactNode;
  /** Extra <defs> content rendered inside the shared Defs block. */
  defs?: (id: (name: string) => string, p: ArtPalette) => ReactNode;
  backdrop?: boolean;
  accessibilityLabel?: string;
};

/** 240×240 artboard with the shared backdrop disc. */
export function ArtFrame({ size, children, defs, backdrop = true, accessibilityLabel }: FrameProps) {
  const p = useArtPalette();
  const prefix = useArtId();
  const id = (name: string) => `${prefix}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      {...(accessibilityLabel ? { accessible: true, accessibilityLabel, accessibilityRole: 'image' as const } : null)}
    >
      <Defs>
        <LinearGradient id={id('disc')} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <Stop offset="0" stopColor={p.discTop} />
          <Stop offset="1" stopColor={p.discBottom} />
        </LinearGradient>
        <RadialGradient id={id('ground')} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor={p.groundShadow} />
          <Stop offset="1" stopColor={p.groundShadow} stopOpacity="0" />
        </RadialGradient>
        {defs?.(id, p)}
      </Defs>
      {backdrop && (
        <>
          <Circle cx="120" cy="120" r="104" fill={url('disc')} />
          <Circle cx="120" cy="120" r="103" fill="none" stroke={p.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)'} strokeWidth="2" />
        </>
      )}
      {children({ id, url }, p)}
    </Svg>
  );
}

/** Soft contact shadow under an object. */
export function GroundShadow({ cx, cy, rx, ry, url }: { cx: number; cy: number; rx: number; ry: number; url: (n: string) => string }) {
  return <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={url('ground')} />;
}

/** Four-point sparkle. */
export function sparklePath(cx: number, cy: number, r: number) {
  const k = r * 0.28;
  return `M ${cx} ${cy - r} Q ${cx + k} ${cy - k} ${cx + r} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + r} Q ${cx - k} ${cy + k} ${cx - r} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}
