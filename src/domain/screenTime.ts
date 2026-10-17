import type { AppUsage } from '../types/models';

/** Turning per-app foreground time into chart slices and readable labels. Pure for tests. */

export type UsageSlice = {
  key: string;
  name: string;
  /** Null for the grouped "Other apps" slice. */
  packageName: string | null;
  usageMs: number;
  /** Share of the total, 0–1. */
  fraction: number;
  /** Apps folded into this slice (1 for a single app). */
  appCount: number;
};

export type UsageSummary = {
  totalMs: number;
  slices: UsageSlice[];
  /** Every app, largest first (for the full list under the chart). */
  apps: AppUsage[];
};

/** Apps used for less than this are left out (accidental taps, background flickers). */
export const MIN_USAGE_MS = 60_000;
export const OTHER_KEY = 'other';

/**
 * Largest apps get their own slice; the rest are grouped as "Other apps" so the
 * chart stays readable. Fractions are of the full total and add up to 1.
 */
export function summarizeUsage(apps: AppUsage[], maxSlices = 6): UsageSummary {
  const merged = new Map<string, AppUsage>();
  for (const a of apps) {
    if (!(a.usageMs > 0)) continue;
    const prev = merged.get(a.packageName);
    merged.set(a.packageName, prev ? { ...prev, usageMs: prev.usageMs + a.usageMs } : { ...a });
  }
  const sorted = [...merged.values()]
    .filter((a) => a.usageMs >= MIN_USAGE_MS)
    .sort((a, b) => b.usageMs - a.usageMs || a.appName.localeCompare(b.appName));
  const totalMs = sorted.reduce((sum, a) => sum + a.usageMs, 0);
  if (!totalMs) return { totalMs: 0, slices: [], apps: [] };

  const ownSlices = sorted.length > maxSlices ? maxSlices - 1 : sorted.length;
  const slices: UsageSlice[] = sorted.slice(0, ownSlices).map((a) => ({
    key: a.packageName,
    name: a.appName,
    packageName: a.packageName,
    usageMs: a.usageMs,
    fraction: a.usageMs / totalMs,
    appCount: 1,
  }));
  const rest = sorted.slice(ownSlices);
  if (rest.length) {
    const ms = rest.reduce((sum, a) => sum + a.usageMs, 0);
    slices.push({ key: OTHER_KEY, name: `Other apps (${rest.length})`, packageName: null, usageMs: ms, fraction: ms / totalMs, appCount: rest.length });
  }
  return { totalMs, slices, apps: sorted };
}

/** "2h 05m", "45m", "<1m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMin < 1) return '<1m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Long form for screen readers: "2 hours 5 minutes". */
export function spokenDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const parts = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m || !h) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

/** "34%" with one decimal for small shares so tiny slices don't all read "0%". */
export function formatPercent(fraction: number): string {
  const pct = Math.max(0, fraction) * 100;
  if (pct > 0 && pct < 1) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

/** SVG path for a doughnut segment from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise). */
export function donutSegmentPath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number): string {
  // A full circle can't be drawn as one arc; stop a hair short.
  const sweep = Math.min(a1 - a0, Math.PI * 2 - 1e-4);
  const end = a0 + sweep;
  const pt = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(3)} ${(cy - r * Math.cos(a)).toFixed(3)}`;
  const large = sweep > Math.PI ? 1 : 0;
  return [
    `M ${pt(rOuter, a0)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${pt(rOuter, end)}`,
    `L ${pt(rInner, end)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${pt(rInner, a0)}`,
    'Z',
  ].join(' ');
}
