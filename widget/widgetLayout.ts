/**
 * Responsive metrics for the widget family.
 *
 * A home-screen widget is resized by the user, and `widgetInfo` can arrive with
 * anything in it (0, NaN, a string, nothing at all) depending on launcher and
 * Android version. Every widget therefore derives its geometry here rather than
 * hard-coding heights: `getMetrics` gives the type scale and spacing for a box,
 * and `fitCount` answers how many rows actually fit in the space that is left.
 *
 * These are pure functions on purpose — `__tests__/widget.test.js` sweeps a
 * matrix of sizes and asserts the composed height never exceeds the widget, so
 * a clipped row or a squashed padding fails the suite instead of the phone.
 */

export interface WidgetBox {
  width: number;
  height: number;
}

/** Used when the launcher tells us nothing — roughly a 3x2 cell widget. */
export const DEFAULT_BOX: WidgetBox = { width: 250, height: 200 };

const MAX_DIMENSION = 2000;

function normalizeDimension(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(num, MAX_DIMENSION);
}

export function normalizeBox(info?: { width?: unknown; height?: unknown } | null): WidgetBox {
  return {
    width: normalizeDimension(info?.width, DEFAULT_BOX.width),
    height: normalizeDimension(info?.height, DEFAULT_BOX.height),
  };
}

export type WidgetScale = 'xs' | 'sm' | 'md' | 'lg';

export function resolveScale(box: WidgetBox): WidgetScale {
  if (box.height < 96 || box.width < 110) return 'xs';
  if (box.height < 150) return 'sm';
  if (box.height < 230) return 'md';
  return 'lg';
}

export interface WidgetMetrics {
  scale: WidgetScale;
  width: number;
  height: number;
  /** Padding between the card edge and its content, on every side. */
  gutter: number;
  radius: number;
  /** Vertical rhythm between stacked blocks and between list rows. */
  gap: number;
  headerHeight: number;
  rowHeight: number;
  heroHeight: number;
  railWidth: number;
  timeColWidth: number;
  showHeader: boolean;
  /** The room column is the first thing dropped when the widget is narrow. */
  showRoom: boolean;
  showHeroMeta: boolean;
  microSize: number;
  bodySize: number;
  titleSize: number;
  heroSize: number;
  metricSize: number;
}

const SCALES: Record<WidgetScale, Omit<WidgetMetrics, 'scale' | 'width' | 'height' | 'showRoom' | 'timeColWidth'>> = {
  xs: {
    gutter: 10,
    radius: 18,
    gap: 4,
    headerHeight: 0,
    rowHeight: 24,
    heroHeight: 44,
    railWidth: 3,
    showHeader: false,
    showHeroMeta: false,
    microSize: 8.5,
    bodySize: 10,
    titleSize: 11.5,
    heroSize: 14,
    metricSize: 16,
  },
  sm: {
    gutter: 11,
    radius: 20,
    gap: 5,
    headerHeight: 15,
    rowHeight: 27,
    heroHeight: 56,
    railWidth: 3,
    showHeader: false,
    showHeroMeta: true,
    microSize: 9,
    bodySize: 10.5,
    titleSize: 12,
    heroSize: 15.5,
    metricSize: 18,
  },
  md: {
    gutter: 12,
    radius: 24,
    gap: 6,
    headerHeight: 17,
    rowHeight: 30,
    heroHeight: 64,
    railWidth: 3,
    showHeader: true,
    showHeroMeta: true,
    microSize: 9.5,
    bodySize: 11,
    titleSize: 12.5,
    heroSize: 17,
    metricSize: 21,
  },
  lg: {
    gutter: 14,
    radius: 26,
    gap: 7,
    headerHeight: 19,
    rowHeight: 32,
    heroHeight: 72,
    railWidth: 4,
    showHeader: true,
    showHeroMeta: true,
    microSize: 10,
    bodySize: 11.5,
    titleSize: 13.5,
    heroSize: 19,
    metricSize: 24,
  },
};

export function getMetrics(info?: { width?: unknown; height?: unknown } | null): WidgetMetrics {
  const box = normalizeBox(info);
  const scale = resolveScale(box);
  const base = SCALES[scale];
  const wide = box.width >= 200;
  return {
    ...base,
    scale,
    width: box.width,
    height: box.height,
    showRoom: box.width >= 240,
    // "12:00 AM" in Nunito bold is ~0.52em per glyph, so 8 glyphs need ~42dp at
    // 10dp and ~46dp at 11dp. The column is sized off that, not guessed.
    timeColWidth: wide ? 56 : 48,
  };
}

/**
 * How many rows of `rowHeight` (separated by `gap`) fit in `available` dp.
 * Returns 0 rather than a negative or fractional count so a caller can render
 * a summary line instead of a clipped row.
 */
export function fitCount(available: number, rowHeight: number, gap: number, max: number): number {
  if (!Number.isFinite(available) || available < rowHeight || rowHeight <= 0 || max <= 0) return 0;
  const count = Math.floor((available + gap) / (rowHeight + gap));
  return Math.max(0, Math.min(max, count));
}

/**
 * Height left for a list after the card padding and any fixed blocks above it.
 * `blocks` are block heights; the gaps between them and the list are added here
 * so callers cannot forget one and overflow the card.
 */
export function listSpace(metrics: WidgetMetrics, blocks: number[]): number {
  const used = blocks.reduce((sum, h) => sum + (h > 0 ? h + metrics.gap : 0), 0);
  return metrics.height - metrics.gutter * 2 - used;
}

/**
 * Grows rows to share out whatever space is left over.
 *
 * `fitCount` answers how many rows fit at the base height, which on a tall
 * widget leaves a band of dead space under the last one. Spreading the surplus
 * across the rows — up to a ceiling, so three rows never become three banners —
 * makes the card look composed at every size the user can drag it to.
 */
export function distributeRowHeight(
  space: number,
  count: number,
  gap: number,
  base: number,
  ceiling?: number
): number {
  if (count <= 0 || !Number.isFinite(space)) return base;
  const per = Math.floor((space - gap * (count - 1)) / count);
  const max = ceiling ?? Math.round(base * 1.45);
  return Math.max(base, Math.min(max, per));
}
