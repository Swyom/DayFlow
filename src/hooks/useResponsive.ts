import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { MAX_CONTENT_WIDTH, SCREEN_GUTTER } from '../theme/tokens';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Layout metrics derived from the window in density-independent pixels, so the
 * same code adapts from small 320dp phones (e.g. budget Redmi/Vivo) through
 * 412dp+ flagships to tablets and unfolded foldables.
 */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  return useMemo(() => {
    const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - SCREEN_GUTTER * 2;
    const compact = width < 360;
    const short = height < 700;
    const tablet = width >= 600;
    /** Large system font: stack side-by-side layouts vertically. */
    const largeText = fontScale >= 1.3;
    return {
      width,
      height,
      fontScale,
      compact,
      short,
      tablet,
      largeText,
      contentWidth,
      /** Hero illustration size for empty states / onboarding. */
      illustration: Math.round(clamp(contentWidth * 0.55, 140, short ? 170 : 220)),
      /** Daily progress ring diameter. */
      ring: Math.round(clamp(contentWidth * 0.36, 96, 140)),
      /** Columns for badge grids. */
      gridColumns: tablet ? 3 : 2,
      /** Columns for the habit icon picker. */
      iconColumns: tablet ? 10 : compact ? 5 : 6, // divisors of 30 icons → no ragged last row
    };
  }, [width, height, fontScale]);
}
