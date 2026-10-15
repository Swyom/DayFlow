import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LOGO_SOURCE } from './LogoMark';
import { useAppFonts } from '../../hooks/useAppFonts';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { APP_NAME } from '../../constants/app';
import { fonts } from '../../theme/tokens';

/**
 * Must match `expo-splash-screen` in app.json (backgroundColor / imageWidth), so the
 * first frame of this overlay is pixel-identical to the native splash it replaces.
 */
export const SPLASH_BACKGROUND = '#06123F';
const LOGO_SIZE = 132;

/** How far the logo rises to make room for the wordmark (keeps the group centred). */
const LIFT = 44;
/** Minimum time the intro plays before the app may be revealed. */
const INTRO_MS = 1050;
const TAGLINE = 'Plan your day. Grow your habits.';

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

type Props = {
  /** The app underneath has its first real frame ready. */
  ready: boolean;
  /** Overlay has fully faded out and can be unmounted. */
  onFinish: () => void;
};

let nativeSplashHidden = false;
function hideNativeSplash() {
  if (nativeSplashHidden) return;
  nativeSplashHidden = true;
  SplashScreen.hideAsync().catch(() => undefined);
}

/**
 * Branded launch screen. It takes over from the static native splash on an identical
 * frame, plays a short intro (glow, rising logo, wordmark, ripple rings echoing the
 * tile shape) while the app loads behind it, then zooms the logo and fades away.
 * Everything runs on the native driver, so JS work during startup cannot stutter it.
 */
export function AnimatedSplash({ ready, onFinish }: Props) {
  const reduceMotion = useReduceMotion();
  const fontsReady = useAppFonts();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  const glow = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const word = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  // A bundled image normally loads within a frame; never leave the native splash up
  // longer than this if the load event is lost.
  useEffect(() => {
    const t = setTimeout(() => setLogoLoaded(true), 700);
    return () => clearTimeout(t);
  }, []);

  const canStart = !!size && logoLoaded && fontsReady;

  // Intro: starts once the overlay matches the native splash, so the hand-off is invisible.
  useEffect(() => {
    if (!canStart) return;
    hideNativeSplash();

    if (reduceMotion) {
      lift.setValue(1);
      word.setValue(1);
      tagline.setValue(1);
      glow.setValue(1);
      const t = setTimeout(() => setIntroDone(true), 350);
      return () => clearTimeout(t);
    }

    const intro = Animated.parallel([
      Animated.timing(glow, { toValue: 1, duration: 900, easing: easeOut, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(lift, { toValue: 1, duration: 700, easing: easeOut, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(logoScale, { toValue: 1.07, duration: 260, easing: easeOut, useNativeDriver: true }),
            Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
          ]),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(330),
        Animated.timing(word, { toValue: 1, duration: 520, easing: easeOut, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(480),
        Animated.timing(tagline, { toValue: 1, duration: 520, easing: easeOut, useNativeDriver: true }),
      ]),
    ]);
    const ripple = (v: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      ]);
    const rings = Animated.parallel([ripple(ring1, 250), ripple(ring2, 1350)]);

    intro.start();
    rings.start();
    const t = setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => {
      clearTimeout(t);
      intro.stop();
      rings.stop();
    };
  }, [canStart, reduceMotion, glow, lift, logoScale, word, tagline, ring1, ring2]);

  // Outro: only when the app is ready AND the intro has played.
  useEffect(() => {
    if (!ready || !introDone || exiting) return;
    setExiting(true);
    const outro = reduceMotion
      ? Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true })
      : Animated.parallel([
          Animated.timing(logoScale, { toValue: 1.18, duration: 480, easing: easeIn, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(90),
            Animated.timing(fade, { toValue: 0, duration: 390, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ]);
    // Unmount even if interrupted, so the overlay can never get stuck over the app.
    outro.start(() => onFinish());
  }, [ready, introDone, exiting, reduceMotion, fade, logoScale, onFinish]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const logoY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT] });
  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.32, 0] }),
    transform: [{ translateY: logoY }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 2.1] }) }],
  });
  const rise = (v: Animated.Value, from: number) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
  });

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={exiting ? 'none' : 'auto'}
      accessible
      accessibilityLabel={`${APP_NAME} is loading`}
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}
    >
      <StatusBar style="light" />
      {size && (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]} pointerEvents="none">
            <Backdrop width={size.width} height={size.height} />
          </Animated.View>

          <View style={styles.center} pointerEvents="none">
            {!reduceMotion && (
              <>
                <Animated.View style={[styles.ring, ringStyle(ring1)]} />
                <Animated.View style={[styles.ring, ringStyle(ring2)]} />
              </>
            )}
            <Animated.View style={{ transform: [{ translateY: logoY }, { scale: logoScale }] }}>
              <Image
                source={LOGO_SOURCE}
                fadeDuration={0}
                resizeMode="contain"
                onLoadEnd={() => setLogoLoaded(true)}
                style={styles.logo}
              />
            </Animated.View>
          </View>

          {fontsReady && (
            <View style={[styles.words, { top: size.height / 2 + LOGO_SIZE / 2 - LIFT + 22 }]} pointerEvents="none">
              <Animated.Text style={[styles.wordmark, rise(word, 14)]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                {APP_NAME}
              </Animated.Text>
              <Animated.Text style={[styles.tagline, rise(tagline, 10)]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
                {TAGLINE}
              </Animated.Text>
            </View>
          )}
        </>
      )}
    </Animated.View>
  );
}

/** Sky-blue glow behind the logo and a faint sunrise warmth at the bottom edge. */
function Backdrop({ width, height }: { width: number; height: number }) {
  const r = Math.max(width, height);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="splashGlow" cx={width / 2} cy={height / 2 - LIFT} r={r * 0.55} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#2F7BFF" stopOpacity="0.55" />
          <Stop offset="0.45" stopColor="#1A4FD8" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#1A4FD8" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="splashSunrise" cx={width / 2} cy={height * 1.08} r={r * 0.6} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FF9A3D" stopOpacity="0.30" />
          <Stop offset="0.5" stopColor="#FF6A2B" stopOpacity="0.08" />
          <Stop offset="1" stopColor="#FF6A2B" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#splashGlow)" />
      <Rect width={width} height={height} fill="url(#splashSunrise)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BACKGROUND, zIndex: 1000, elevation: 1000 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  // Rounded square echoing the icon tile; sized to the tile inside the logo's padding.
  ring: {
    position: 'absolute',
    width: LOGO_SIZE * 0.86,
    height: LOGO_SIZE * 0.86,
    borderRadius: LOGO_SIZE * 0.24,
    borderWidth: 2,
    borderColor: '#7FB6FF',
  },
  words: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  tagline: {
    marginTop: 6,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: 'rgba(225, 235, 255, 0.72)',
    textAlign: 'center',
  },
});
