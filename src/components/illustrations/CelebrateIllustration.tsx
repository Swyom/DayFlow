import React from 'react';
import { Circle, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ArtFrame, GroundShadow, sparklePath } from './shared';

const CONFETTI = [
  { x: 56, y: 76, a: -20, c: 'coral' },
  { x: 178, y: 64, a: 30, c: 'amber' },
  { x: 190, y: 138, a: -40, c: 'primaryLight' },
  { x: 50, y: 148, a: 50, c: 'sky' },
  { x: 92, y: 46, a: 70, c: 'mint' },
  { x: 160, y: 182, a: 15, c: 'coral' },
] as const;

/** Big check with confetti — "all clear". */
export function CelebrateIllustration({ size = 240, accessibilityLabel }: { size?: number; accessibilityLabel?: string }) {
  return (
    <ArtFrame
      size={size}
      accessibilityLabel={accessibilityLabel}
      defs={(id, p) => (
        <LinearGradient id={id('badge')} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7BDDBB" />
          <Stop offset="1" stopColor={p.mintDeep} />
        </LinearGradient>
      )}
    >
      {({ url }, p) => (
        <>
          <GroundShadow cx={120} cy={186} rx={50} ry={8} url={url} />
          <Circle cx="120" cy="114" r="58" fill={url('badge')} />
          <Circle cx="120" cy="114" r="50" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <Path
            d="M 94 116 L 112 134 L 148 97"
            stroke={p.white}
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {CONFETTI.map((c, i) => (
            <Rect
              key={i}
              x={c.x - 7}
              y={c.y - 3}
              width="14"
              height="6"
              rx="3"
              fill={p[c.c]}
              transform={`rotate(${c.a} ${c.x} ${c.y})`}
            />
          ))}
          <Path d={sparklePath(186, 98, 8)} fill={p.amber} />
          <Path d={sparklePath(62, 112, 6)} fill={p.primaryLight} />
          <Circle cx="76" cy="186" r="3.5" fill={p.amber} />
        </>
      )}
    </ArtFrame>
  );
}
