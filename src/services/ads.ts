import { useEffect, useState } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * Google AdMob setup.
 *
 * - Test ads are used in development and whenever EXPO_PUBLIC_ADMOB_TEST_MODE isn't
 *   "false". Real ad unit IDs are only used once test mode is switched off for a release
 *   (after the AdMob account, app and ad units are approved).
 * - Google's consent form (UMP) is shown first where required (EEA/UK); ads are only
 *   requested once consent allows it.
 * - The library is only loaded when its native code is in the app binary. In Expo Go, or in
 *   a build made before AdMob was added, importing it throws at startup, so there the ad
 *   slot is simply left out.
 */

type AdsLib = typeof import('react-native-google-mobile-ads');

function loadAdsLib(): AdsLib | null {
  try {
    if (!TurboModuleRegistry.get('RNGoogleMobileAdsModule')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as AdsLib;
  } catch {
    return null;
  }
}

/** The AdMob library, or null when this binary doesn't include it. */
export const adsLib = loadAdsLib();

const testMode = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_TEST_MODE !== 'false';

/** Banner unit for this build, or null when no real unit is configured (no ad is shown). */
export function homeBannerUnitId(): string | null {
  if (!adsLib || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return null;
  if (testMode) return adsLib.TestIds.ADAPTIVE_BANNER;
  const id = Platform.OS === 'android' ? process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID : process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS;
  return id && /^ca-app-pub-\d+\/\d+$/.test(id) ? id : null;
}

let ready = false;
let started = false;
const listeners = new Set<(ready: boolean) => void>();

async function start() {
  if (!adsLib) return;
  const { AdsConsent, default: mobileAds } = adsLib;
  // Shows the consent form only if this user needs one and hasn't answered yet.
  const info = await AdsConsent.gatherConsent().catch(() => AdsConsent.getConsentInfo().catch(() => null));
  if (!info?.canRequestAds) return;
  await mobileAds().initialize();
  ready = true;
  listeners.forEach((l) => l(true));
}

/** Starts consent + the ads SDK once per app run. Safe to call repeatedly. */
export function initAds() {
  if (started || !homeBannerUnitId()) return;
  started = true;
  start().catch((e) => {
    started = false; // retry next launch of the Home screen
    if (__DEV__) console.warn('[ads] init failed', e);
  });
}

export function useAdsReady() {
  const [value, setValue] = useState(ready);
  useEffect(() => {
    listeners.add(setValue);
    setValue(ready);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
