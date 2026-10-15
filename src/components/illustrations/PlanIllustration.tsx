import React from 'react';
import { Circle, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ArtFrame, GroundShadow, sparklePath } from './shared';

const check = (cx: number, cy: number) => `M ${cx - 4.5} ${cy} L ${cx - 1.2} ${cy + 3.4} L ${cx + 4.8} ${cy - 3.6}`;

/** Clipboard checklist with a floating calendar — "plan your day". */
export function PlanIllustration({ size = 240, accessibilityLabel }: { size?: number; accessibilityLabel?: string }) {
  return (
    <ArtFrame
      size={size}
      accessibilityLabel={accessibilityLabel}
      defs={(id, p) => (
        <>
          <LinearGradient id={id('board')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.primaryLight} />
            <Stop offset="1" stopColor={p.primary} />
          </LinearGradient>
          <LinearGradient id={id('paper')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.paper} />
            <Stop offset="1" stopColor={p.paperShade} />
          </LinearGradient>
          <LinearGradient id={id('mint')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.mint} />
            <Stop offset="1" stopColor={p.mintDeep} />
          </LinearGradient>
        </>
      )}
    >
      {({ url }, p) => (
        <>
          <GroundShadow cx={120} cy={198} rx={58} ry={8} url={url} />
          {/* Board + paper */}
          <Rect x="66" y="52" width="108" height="142" rx="20" fill={url('board')} />
          <Rect x="76" y="66" width="88" height="118" rx="12" fill={url('paper')} />
          {/* Clip */}
          <Rect x="98" y="43" width="44" height="20" rx="10" fill={p.primaryDeep} />
          <Circle cx="120" cy="53" r="4" fill={p.primaryLight} />

          {/* Checklist rows */}
          {[90, 120, 150].map((y, i) => {
            const done = i < 2;
            return (
              <G key={y}>
                {done ? (
                  <>
                    <Circle cx="95" cy={y} r="9" fill={url('mint')} />
                    <Path d={check(95, y)} stroke={p.white} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </>
                ) : (
                  <Circle cx="95" cy={y} r="8" fill="none" stroke={p.lineStrong} strokeWidth="2.4" />
                )}
                <Rect x="111" y={y - 6} width={i === 1 ? 34 : 42} height="6" rx="3" fill={done ? p.line : p.lineStrong} />
                <Rect x="111" y={y + 4} width={i === 2 ? 30 : 22} height="4.5" rx="2.25" fill={p.line} opacity={0.7} />
              </G>
            );
          })}

          {/* Floating calendar */}
          <Rect x="153" y="40" width="50" height="50" rx="14" fill={p.groundShadow} />
          <Rect x="149" y="35" width="50" height="50" rx="14" fill={p.coral} />
          <Rect x="149" y="49" width="50" height="36" rx="14" fill={p.paper} />
          <Rect x="149" y="49" width="50" height="12" fill={p.paper} />
          <Rect x="159" y="29" width="5" height="12" rx="2.5" fill={p.coralDeep} />
          <Rect x="184" y="29" width="5" height="12" rx="2.5" fill={p.coralDeep} />
          {[0, 1, 2].map((c) =>
            [0, 1].map((r) => (
              <Circle
                key={`${c}-${r}`}
                cx={162 + c * 12}
                cy={62 + r * 11}
                r="3.4"
                fill={c === 1 && r === 1 ? p.primary : p.line}
              />
            )),
          )}

          {/* Sparkles */}
          <Path d={sparklePath(50, 74, 9)} fill={p.amber} />
          <Path d={sparklePath(188, 156, 6)} fill={p.primaryLight} />
          <Circle cx="54" cy="160" r="4" fill={p.coral} />
          <Circle cx="190" cy="112" r="3" fill={p.mint} />
        </>
      )}
    </ArtFrame>
  );
}
