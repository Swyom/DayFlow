import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { adsLib, homeBannerUnitId, useAdsReady } from '../../services/ads';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from '../ui';

/** Anchored adaptive banners are 50–90 dp tall depending on width; reserve the phone size up front. */
const RESERVED_HEIGHT = 60;

/**
 * Home-screen banner slot. Labelled "Advertisement", set apart from app content, and
 * placed in the scrolling content away from the tab bar and primary buttons, so it can't
 * be mistaken for a control or tapped by accident. The space is reserved while the ad
 * loads (no layout jump) and the slot disappears if no ad can be shown.
 */
export function HomeBannerAd() {
  const { colors } = useTheme();
  const { contentWidth } = useResponsive();
  const adsReady = useAdsReady();
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(RESERVED_HEIGHT);
  const unitId = homeBannerUnitId();

  if (!adsLib || !unitId || failed) return null;
  const { BannerAd, BannerAdSize } = adsLib;

  return (
    <View style={styles.root} accessibilityRole="none">
      <AppText variant="overline" tone="muted" style={styles.label}>
        Advertisement
      </AppText>
      <View style={[styles.slot, { minHeight: height, borderColor: colors.divider, backgroundColor: colors.well }]}>
        {adsReady ? (
          <BannerAd
            unitId={unitId}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            width={Math.floor(contentWidth)}
            onAdLoaded={(d) => setHeight(Math.max(RESERVED_HEIGHT, d.height))}
            onAdFailedToLoad={() => setFailed(true)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.xxxl, marginBottom: spacing.sm },
  label: { marginBottom: spacing.xs, marginLeft: spacing.xs },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
