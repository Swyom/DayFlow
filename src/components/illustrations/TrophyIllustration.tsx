import React from 'react';
import { Circle, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { ArtFrame, GroundShadow, sparklePath } from './shared';

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

/** Gold cup on a plinth — achievements. */
export function TrophyIllustration({ size = 240, accessibilityLabel }: { size?: number; accessibilityLabel?: string }) {
  return (
    <ArtFrame
      size={size}
      accessibilityLabel={accessibilityLabel}
      defs={(id, p) => (
        <>
          <LinearGradient id={id('gold')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFD983" />
            <Stop offset="1" stopColor={p.amberDeep} />
          </LinearGradient>
          <LinearGradient id={id('base')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.primaryLight} />
            <Stop offset="1" stopColor={p.primaryDeep} />
          </LinearGradient>
        </>
      )}
    >
      {({ url }, p) => (
        <>
          <GroundShadow cx={120} cy={200} rx={54} ry={8} url={url} />
          {/* Handles */}
          <Path d="M 82 74 C 54 74 56 114 90 114" stroke={p.amberDeep} strokeWidth="8" strokeLinecap="round" fill="none" />
          <Path d="M 158 74 C 186 74 184 114 150 114" stroke={p.amberDeep} strokeWidth="8" strokeLinecap="round" fill="none" />
          {/* Stem */}
          <Path d="M 111 142 L 129 142 L 133 170 L 107 170 Z" fill={p.amberDeep} />
          {/* Cup */}
          <Path d="M 78 64 L 162 64 Q 162 122 120 146 Q 78 122 78 64 Z" fill={url('gold')} />
          <Rect x="74" y="56" width="92" height="14" rx="7" fill="#FFD983" />
          <Path d="M 92 76 Q 92 106 110 126" stroke="rgba(255,255,255,0.45)" strokeWidth="5" strokeLinecap="round" fill="none" />
          <Polygon points={starPoints(122, 98, 15, 6.5)} fill={p.white} opacity={0.92} />
          {/* Plinth */}
          <Rect x="84" y="168" width="72" height="26" rx="9" fill={url('base')} />
          <Rect x="104" y="176" width="32" height="9" rx="4.5" fill="#FFD983" />

          <Path d={sparklePath(190, 66, 10)} fill={p.amber} />
          <Path d={sparklePath(50, 92, 7)} fill={p.primaryLight} />
          <Circle cx="186" cy="150" r="4" fill={p.coral} />
          <Circle cx="56" cy="154" r="3" fill={p.mint} />
        </>
      )}
    </ArtFrame>
  );
}
