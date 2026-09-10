/**
 * Shared building blocks for the widget family.
 *
 * These are plain functions returning elements rather than components, so the
 * tree handed to the renderer contains only the library's own widgets — that
 * keeps `buildWidgetTree` shallow and lets the tests walk a real layout instead
 * of a chain of wrappers. Falsy children are dropped by the tree builder, so a
 * conditional block can return `null` instead of an empty spacer view.
 *
 * Two rules every caller depends on:
 *  - text is always `allowFontScaling={false}`. The library maps a scaling font
 *    to SP, so a phone set to "largest" text silently pushes rows out of the
 *    card; DP keeps the layout the size the metrics said it would be.
 *  - deep links use `OPEN_URI`, never `OPEN_APP`. `OPEN_APP` ignores
 *    `clickActionData` in the native provider and just relaunches the app on
 *    whatever screen it was left on.
 */

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetMetrics } from './widgetLayout';
import { WidgetFont, type WidgetColor, type WidgetPalette } from './widgetTheme';

// ── Deep links ────────────────────────────────────────────────────────────────

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * `trigger` is what makes a second tap navigate again: the schedule screen
 * re-applies its params only when they change.
 */
export const WidgetLinks = {
  attendance: (now: Date): string =>
    `finscholarapp://schedule?viewMode=attendance&targetDate=${localDateString(now)}&trigger=${now.getTime()}`,
  timetable: (now: Date): string => `finscholarapp://schedule?viewMode=grid&trigger=${now.getTime()}`,
  tasks: (now: Date): string => `finscholarapp://requirements?trigger=${now.getTime()}`,
  home: (): string => 'finscholarapp://',
};

export function openUri(uri: string) {
  return { clickAction: 'OPEN_URI', clickActionData: { uri } };
}

// ── Surfaces ──────────────────────────────────────────────────────────────────

/**
 * The card every widget sits in: one padded, rounded surface with a barely
 * perceptible gradient so it reads as a raised sheet on any wallpaper.
 */
export function surfaceStyle(metrics: WidgetMetrics, palette: WidgetPalette) {
  return {
    flex: 1,
    width: 'match_parent' as const,
    height: 'match_parent' as const,
    flexDirection: 'column' as const,
    borderRadius: metrics.radius,
    overflow: 'hidden' as const,
    padding: metrics.gutter,
    backgroundColor: palette.surface,
    backgroundGradient: {
      from: palette.surface,
      to: palette.surfaceTo,
      orientation: 'TOP_BOTTOM' as const,
    },
  };
}

// ── Pieces ────────────────────────────────────────────────────────────────────

export function chip(opts: {
  text: string;
  fg: WidgetColor;
  bg: WidgetColor;
  fontSize: number;
  marginLeft?: number;
}) {
  const height = Math.round(opts.fontSize * 2);
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height,
        borderRadius: Math.round(height / 2),
        paddingHorizontal: Math.round(opts.fontSize * 0.75),
        backgroundColor: opts.bg,
        marginLeft: opts.marginLeft ?? 0,
      }}
    >
      <TextWidget
        text={opts.text}
        maxLines={1}
        allowFontScaling={false}
        style={{
          fontSize: opts.fontSize,
          fontFamily: WidgetFont.bold,
          fontWeight: 'bold',
          color: opts.fg,
        }}
      />
    </FlexWidget>
  );
}

/**
 * A thin meter. Two stacked boxes rather than a percentage width, because
 * RemoteViews has no percentage sizing — the filled box is measured in dp
 * against the width the caller already knows.
 */
export function meter(opts: {
  value: number;
  width: number;
  track: WidgetColor;
  fill: WidgetColor;
  height?: number;
  marginTop?: number;
}) {
  const height = opts.height ?? 4;
  const safeWidth = Math.max(0, Math.round(opts.width));
  const ratio = Number.isFinite(opts.value) ? Math.min(1, Math.max(0, opts.value)) : 0;
  // Never let a non-zero value round away to an invisible sliver.
  const filled = ratio > 0 ? Math.min(safeWidth, Math.max(height, Math.round(safeWidth * ratio))) : 0;

  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: safeWidth,
        height,
        borderRadius: Math.round(height / 2),
        backgroundColor: opts.track,
        marginTop: opts.marginTop ?? 0,
      }}
    >
      {filled > 0 ? (
        <FlexWidget
          style={{
            width: filled,
            height,
            borderRadius: Math.round(height / 2),
            backgroundColor: opts.fill,
          }}
        />
      ) : null}
    </FlexWidget>
  );
}

/** Section label + optional trailing chip, the top line of every widget. */
export function header(opts: {
  metrics: WidgetMetrics;
  palette: WidgetPalette;
  label: string;
  trailing?: React.JSX.Element | null;
}) {
  const { metrics, palette } = opts;
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: metrics.headerHeight,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: metrics.gap,
      }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget
          text={opts.label}
          maxLines={1}
          truncate="END"
          allowFontScaling={false}
          style={{
            fontSize: metrics.microSize,
            fontFamily: WidgetFont.black,
            fontWeight: 'bold',
            letterSpacing: metrics.microSize * 0.09,
            color: palette.textFaint,
          }}
        />
      </FlexWidget>
      {opts.trailing ?? null}
    </FlexWidget>
  );
}

/** The one-line schedule row shared by the Up Next and Agenda widgets. */
export function scheduleRow(opts: {
  rowKey?: string | number;
  metrics: WidgetMetrics;
  palette: WidgetPalette;
  accent: WidgetColor;
  /** Left-hand column — a start time, or a subject code. Empty hides the column. */
  time: string;
  /** Overrides the base row height so a list can fill a tall card evenly. */
  rowHeight?: number;
  title: string;
  trailing?: string;
  trailingChip?: React.JSX.Element | null;
  dimmed?: boolean;
  marginBottom?: number;
}) {
  const { metrics, palette } = opts;
  const rowHeight = opts.rowHeight ?? metrics.rowHeight;
  const titleColor = opts.dimmed ? palette.textFaint : palette.text;
  const timeColor = opts.dimmed ? palette.textFaint : palette.textDim;

  return (
    <FlexWidget
      key={opts.rowKey}
      style={{
        width: 'match_parent',
        height: rowHeight,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: opts.marginBottom ?? 0,
      }}
    >
      <FlexWidget
        style={{
          width: metrics.railWidth,
          height: Math.max(10, rowHeight - 10),
          borderRadius: metrics.railWidth,
          backgroundColor: opts.accent,
        }}
      />
      {opts.time ? (
        <FlexWidget style={{ width: metrics.timeColWidth, marginLeft: 9 }}>
          <TextWidget
            text={opts.time}
            maxLines={1}
            truncate="END"
            allowFontScaling={false}
            style={{
              fontSize: metrics.bodySize,
              fontFamily: WidgetFont.bold,
              fontWeight: 'bold',
              color: timeColor,
            }}
          />
        </FlexWidget>
      ) : null}
      <FlexWidget style={{ flex: 1, marginLeft: opts.time ? 4 : 9 }}>
        <TextWidget
          text={opts.title}
          maxLines={1}
          truncate="END"
          allowFontScaling={false}
          style={{
            fontSize: metrics.titleSize,
            fontFamily: WidgetFont.bold,
            fontWeight: 'bold',
            color: titleColor,
          }}
        />
      </FlexWidget>
      {opts.trailingChip ??
        (opts.trailing ? (
          // Fixed width, right aligned: wrap_content here would let a long room
          // name take the space the title needs instead of ellipsising itself.
          <FlexWidget style={{ width: metrics.timeColWidth, alignItems: 'flex-end', marginLeft: 6 }}>
            <TextWidget
              text={opts.trailing}
              maxLines={1}
              truncate="END"
              allowFontScaling={false}
              style={{
                fontSize: metrics.microSize,
                fontFamily: WidgetFont.regular,
                color: palette.textFaint,
                textAlign: 'right',
              }}
            />
          </FlexWidget>
        ) : null)}
    </FlexWidget>
  );
}

/** Centred fallback used whenever a widget has nothing to show. */
export function emptyState(opts: {
  metrics: WidgetMetrics;
  palette: WidgetPalette;
  title: string;
  subtitle?: string;
  /** Colour of the small rule above the title; defaults to the quiet line colour. */
  accent?: WidgetColor;
}) {
  const { metrics, palette } = opts;
  // Deliberately typographic: a rule and two lines, no glyph. The widget font is
  // loaded as a custom typeface, and Android does not fall back glyph by glyph —
  // a symbol Nunito lacks would draw as a tofu box.
  const showRule = metrics.height - metrics.gutter * 2 >= metrics.titleSize * 3;

  return (
    <FlexWidget
      style={{
        flex: 1,
        width: 'match_parent',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showRule ? (
        <FlexWidget
          style={{
            width: 22,
            height: 4,
            borderRadius: 2,
            backgroundColor: opts.accent ?? palette.line,
            marginBottom: 9,
          }}
        />
      ) : null}
      <TextWidget
        text={opts.title}
        maxLines={1}
        truncate="END"
        allowFontScaling={false}
        style={{
          fontSize: metrics.titleSize,
          fontFamily: WidgetFont.black,
          fontWeight: 'bold',
          color: palette.text,
          textAlign: 'center',
        }}
      />
      {opts.subtitle && metrics.showHeroMeta ? (
        <TextWidget
          text={opts.subtitle}
          maxLines={1}
          truncate="END"
          allowFontScaling={false}
          style={{
            fontSize: metrics.microSize,
            fontFamily: WidgetFont.regular,
            color: palette.textFaint,
            marginTop: 3,
            textAlign: 'center',
          }}
        />
      ) : null}
    </FlexWidget>
  );
}
