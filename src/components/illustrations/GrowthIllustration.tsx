import React from 'react';
import { Circle, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ArtFrame, GroundShadow, sparklePath } from './shared';

const leaf = (len: number) =>
  `M 0 0 C ${len * 0.3} ${-len * 0.36} ${len * 0.74} ${-len * 0.36} ${len} 0 C ${len * 0.74} ${len * 0.36} ${len * 0.3} ${len * 0.36} 0 0 Z`;

const LEAVES: { x: number; y: number; a: number; len: number }[] = [
  { x: 120, y: 132, a: -158, len: 36 },
  { x: 120, y: 124, a: -22, len: 38 },
  { x: 120.5, y: 106, a: -146, len: 30 },
  { x: 121.5, y: 98, a: -38, len: 28 },
  { x: 122, y: 84, a: -84, len: 22 },
];

/** A sprouting plant inside a progress ring — "build better habits". */
export function GrowthIllustration({ size = 240, accessibilityLabel }: { size?: number; accessibilityLabel?: string }) {
  const r = 76;
  const c = 2 * Math.PI * r;
  const progress = 0.7;
  const endAngle = -Math.PI / 2 + progress * 2 * Math.PI;
  const endX = 120 + r * Math.cos(endAngle);
  const endY = 116 + r * Math.sin(endAngle);

  return (
    <ArtFrame
      size={size}
      accessibilityLabel={accessibilityLabel}
      defs={(id, p) => (
        <>
          <LinearGradient id={id('leaf')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#7BDDBB" />
            <Stop offset="1" stopColor={p.mintDeep} />
          </LinearGradient>
          <LinearGradient id={id('pot')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.coral} />
            <Stop offset="1" stopColor={p.coralDeep} />
          </LinearGradient>
          <LinearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.primaryLight} />
            <Stop offset="1" stopColor={p.primary} />
          </LinearGradient>
        </>
      )}
    >
      {({ url }, p) => (
        <>
          {/* Progress ring */}
          <Circle cx="120" cy="116" r={r} fill="none" stroke={p.line} strokeWidth="8" opacity={0.6} />
          <Circle
            cx="120"
            cy="116"
            r={r}
            fill="none"
            stroke={url('ring')}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - progress)}
            transform="rotate(-90 120 116)"
          />
          <Circle cx={endX} cy={endY} r="11" fill={p.primary} />
          <Path
            d={`M ${endX - 4.5} ${endY} L ${endX - 1.2} ${endY + 3.4} L ${endX + 4.8} ${endY - 3.6}`}
            stroke={p.white}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          <GroundShadow cx={120} cy={196} rx={44} ry={7} url={url} />

          {/* Stem + leaves */}
          <Path d="M 120 150 C 120 128 118 108 122 82" stroke={p.mintDeep} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          {LEAVES.map((l, i) => (
            <G key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.a})`}>
              <Path d={leaf(l.len)} fill={url('leaf')} />
              <Path d={`M 3 0 L ${l.len * 0.78} 0`} stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round" />
            </G>
          ))}

          {/* Pot */}
          <Path d="M 92 156 L 148 156 L 141 192 Q 140 197 135 197 L 105 197 Q 100 197 99 192 Z" fill={url('pot')} />
          <Rect x="86" y="146" width="68" height="15" rx="7.5" fill={p.coral} />
          <Rect x="92" y="149" width="40" height="4" rx="2" fill="rgba(255,255,255,0.35)" />

          {/* Sparkles */}
          <Path d={sparklePath(184, 70, 9)} fill={p.amber} />
          <Path d={sparklePath(58, 62, 6)} fill={p.primaryLight} />
          <Circle cx="186" cy="176" r="4" fill={p.sky} />
        </>
      )}
    </ArtFrame>
  );
}
