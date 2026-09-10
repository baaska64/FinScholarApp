/**
 * "Semester Pulse" — four numbers that decide how the term is going.
 *
 * Grade, attendance, open work and how far through the term you are. Each tile
 * is a label, a number and — where the number is a share of something — a meter,
 * so the value is legible at a glance and the trend is legible without one.
 *
 * The tile grid drops to a single row when the widget is short rather than
 * shrinking four tiles until the numbers clip.
 */

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetComponentProps } from './FocusWidget';
import { emptySnapshot } from './widgetData';
import { getMetrics, type WidgetMetrics } from './widgetLayout';
import { getToneColors, getWidgetPalette, WidgetFont, type WidgetColor, type WidgetPalette, type WidgetTone } from './widgetTheme';
import { header, meter, openUri, surfaceStyle, WidgetLinks } from './widgetUi';

interface Tile {
  key: string;
  label: string;
  value: string;
  caption?: string;
  tone: WidgetTone;
  /** 0…1 when the value is a share of something, otherwise undefined. */
  progress?: number;
}

/** Attendance is the one metric with a pass mark, so it is colour-coded against it. */
export function attendanceTone(pct: number, hasData: boolean): WidgetTone {
  if (!hasData) return 'neutral';
  if (pct >= 90) return 'success';
  if (pct >= 75) return 'warning';
  return 'danger';
}

/**
 * Shortest tile that still fits a caption above its number. The grid uses this
 * to decide between two rows and one: four unlabelled numbers say less than two
 * labelled ones.
 */
export function minTileHeight(metrics: WidgetMetrics): number {
  const pad = metrics.scale === 'lg' ? 9 : 7;
  return pad * 2 + Math.round(metrics.microSize * 1.4) + Math.round(metrics.metricSize * 1.35);
}

function tile(opts: {
  tileData: Tile;
  metrics: WidgetMetrics;
  palette: WidgetPalette;
  height: number;
  width: number;
  marginRight: number;
}) {
  const { metrics, palette, tileData } = opts;
  const pad = opts.height >= 44 ? (metrics.scale === 'lg' ? 9 : 7) : 4;
  const labelLine = Math.round(metrics.microSize * 1.4);
  const valueLine = Math.round(metrics.metricSize * 1.35);
  // On a squeezed tile the number survives and the caption goes: a label with no
  // value under it tells you nothing.
  const showLabel = opts.height >= pad * 2 + labelLine + valueLine;
  const showMeter =
    tileData.progress !== undefined && opts.height >= pad * 2 + (showLabel ? labelLine : 0) + valueLine + 8;
  const tone = getToneColors(palette, tileData.tone);
  const valueColor: WidgetColor = tileData.tone === 'neutral' ? palette.text : tone.fg;

  return (
    <FlexWidget
      key={tileData.key}
      style={{
        flex: 1,
        height: opts.height,
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: Math.max(10, metrics.radius - 8),
        padding: pad,
        marginRight: opts.marginRight,
        backgroundColor: palette.sunken,
      }}
    >
      {showLabel ? (
        <TextWidget
          text={tileData.label}
          maxLines={1}
          truncate="END"
          allowFontScaling={false}
          style={{
            height: labelLine,
            fontSize: metrics.microSize,
            fontFamily: WidgetFont.black,
            fontWeight: 'bold',
            letterSpacing: metrics.microSize * 0.08,
            color: palette.textFaint,
          }}
        />
      ) : null}
      <TextWidget
        text={tileData.value}
        maxLines={1}
        truncate="END"
        allowFontScaling={false}
        style={{
          height: valueLine,
          fontSize: metrics.metricSize,
          fontFamily: WidgetFont.black,
          fontWeight: 'bold',
          color: valueColor,
        }}
      />
      {showMeter
        ? meter({
            value: tileData.progress ?? 0,
            width: Math.max(12, opts.width - pad * 2),
            track: palette.track,
            fill: tone.fg,
            height: 4,
            marginTop: 3,
          })
        : null}
    </FlexWidget>
  );
}

export function StatsWidget({ snapshot, isDark, widgetInfo }: WidgetComponentProps) {
  const data = snapshot ?? emptySnapshot();
  const palette = getWidgetPalette(isDark);
  const metrics = getMetrics(widgetInfo);
  const stats = data.stats;

  const tiles: Tile[] = [
    {
      key: 'grade',
      label: stats.gradeCaption.toUpperCase(),
      value: stats.gradeValue,
      tone: 'neutral',
    },
    {
      key: 'attendance',
      label: 'ATTENDANCE',
      value: stats.hasAttendance ? `${stats.attendancePct}%` : '—',
      tone: attendanceTone(stats.attendancePct, stats.hasAttendance),
      progress: stats.hasAttendance ? stats.attendancePct / 100 : undefined,
    },
    {
      key: 'tasks',
      label: stats.overdueCount > 0 ? 'OVERDUE' : 'OPEN TASKS',
      value: String(stats.overdueCount > 0 ? stats.overdueCount : stats.pendingCount),
      tone: stats.overdueCount > 0 ? 'danger' : 'neutral',
    },
    {
      key: 'term',
      label: 'TERM',
      value: `${stats.termPct}%`,
      tone: 'brand',
      progress: stats.termPct / 100,
    },
  ];

  const headerBlock = metrics.showHeader ? metrics.headerHeight + metrics.gap : 0;
  const contentHeight = metrics.height - metrics.gutter * 2 - headerBlock;
  const twoRows = contentHeight >= minTileHeight(metrics) * 2 + metrics.gap;
  const tileHeight = twoRows ? Math.floor((contentHeight - metrics.gap) / 2) : Math.max(0, contentHeight);
  const tileWidth = Math.floor((metrics.width - metrics.gutter * 2 - metrics.gap) / 2);

  const rows = twoRows ? [tiles.slice(0, 2), tiles.slice(2, 4)] : [tiles.slice(0, 2)];

  return (
    <FlexWidget
      {...openUri(WidgetLinks.home())}
      accessibilityLabel={`Term ${stats.gradeValue}, attendance ${stats.attendancePct} percent, ${stats.pendingCount} open tasks`}
      style={surfaceStyle(metrics, palette)}
    >
      {metrics.showHeader
        ? header({
            metrics,
            palette,
            label: data.termLabel ? data.termLabel.toUpperCase() : 'THIS TERM',
            trailing: (
              <TextWidget
                text={stats.termCaption}
                maxLines={1}
                truncate="END"
                allowFontScaling={false}
                style={{
                  fontSize: metrics.microSize,
                  fontFamily: WidgetFont.bold,
                  fontWeight: 'bold',
                  color: palette.textFaint,
                }}
              />
            ),
          })
        : null}

      {rows.map((row, rowIdx) => (
        <FlexWidget
          key={`row-${rowIdx}`}
          style={{
            width: 'match_parent',
            height: tileHeight,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: rowIdx === rows.length - 1 ? 0 : metrics.gap,
          }}
        >
          {row.map((item, idx) =>
            tile({
              tileData: item,
              metrics,
              palette,
              height: tileHeight,
              width: tileWidth,
              marginRight: idx === row.length - 1 ? 0 : metrics.gap,
            })
          )}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
