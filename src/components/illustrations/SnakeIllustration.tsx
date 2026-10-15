import React from 'react';
import { Circle, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ArtFrame, GroundShadow, sparklePath } from './shared';

/** A tiny Snake board — "take a mindful break". */
export function SnakeIllustration({ size = 240, accessibilityLabel }: { size?: number; accessibilityLabel?: string }) {
  return (
    <ArtFrame
      size={size}
      accessibilityLabel={accessibilityLabel}
      defs={(id, p) => (
        <>
          <LinearGradient id={id('case')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.paper} />
            <Stop offset="1" stopColor={p.paperShade} />
          </LinearGradient>
          <LinearGradient id={id('snake')} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#86E2C2" />
            <Stop offset="1" stopColor={p.mintDeep} />
          </LinearGradient>
          <LinearGradient id={id('apple')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.coral} />
            <Stop offset="1" stopColor={p.coralDeep} />
          </LinearGradient>
        </>
      )}
    >
      {({ url }, p) => (
        <>
          <GroundShadow cx={120} cy={198} rx={66} ry={8} url={url} />
          <Rect x="52" y="50" width="136" height="140" rx="28" fill={url('case')} />
          <Rect x="64" y="62" width="112" height="112" rx="18" fill={p.isDark ? '#242934' : '#E2E8F1'} />
          {/* Grid dots */}
          {Array.from({ length: 6 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => (
              <Circle key={`${r}-${c}`} cx={76 + c * 17.6} cy={74 + r * 17.6} r="1.6" fill={p.line} />
            )),
          )}
          {/* Snake body */}
          <Path
            d="M 84 156 L 84 122 L 116 122 L 116 90 L 146 90"
            stroke={url('snake')}
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Head */}
          <G>
            <Circle cx="150" cy="90" r="10.5" fill={p.mintDeep} />
            <Circle cx="153" cy="85.5" r="2.6" fill={p.white} />
            <Circle cx="153" cy="94.5" r="2.6" fill={p.white} />
            <Circle cx="153.8" cy="85.5" r="1.3" fill="#1C2333" />
            <Circle cx="153.8" cy="94.5" r="1.3" fill="#1C2333" />
          </G>
          {/* Apple */}
          <Circle cx="150" cy="142" r="10" fill={url('apple')} />
          <Path d="M 150 133 Q 151 128 154 126" stroke={p.isDark ? '#C9A27A' : '#8A5A3C'} strokeWidth="2" strokeLinecap="round" fill="none" />
          <Ellipse cx="157" cy="129" rx="5" ry="2.6" fill={p.mint} transform="rotate(-25 157 129)" />
          <Circle cx="146" cy="138" r="2.6" fill="rgba(255,255,255,0.45)" />

          {/* Sparkles */}
          <Path d={sparklePath(196, 58, 9)} fill={p.amber} />
          <Path d={sparklePath(42, 100, 6)} fill={p.primaryLight} />
          <Circle cx="48" cy="170" r="4" fill={p.coral} />
        </>
      )}
    </ArtFrame>
  );
}
