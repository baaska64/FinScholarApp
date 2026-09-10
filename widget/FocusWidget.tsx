/**
 * "Next Class" — the compact strip.
 *
 * One row, sized for a 4x1 slot, for students who keep a dense home screen and
 * only ever want the one answer: what is next, where, and how long have I got.
 * `focusStrip` is exported because the Up Next widget falls back to it when the
 * user resizes that widget down to a single row.
 */

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { emptySnapshot, type WidgetClassData, type WidgetSnapshot } from './widgetData';
import { getMetrics, type WidgetMetrics } from './widgetLayout';
import { getWidgetAccent, getWidgetPalette, WidgetFont, type WidgetPalette } from './widgetTheme';
import { chip, emptyState, openUri, surfaceStyle, WidgetLinks } from './widgetUi';

export interface WidgetComponentProps {
  snapshot?: WidgetSnapshot;
  isDark?: boolean;
  widgetInfo?: { width?: unknown; height?: unknown } | null;
}

/**
 * A single class rendered as a horizontal strip: accent rail, stacked
 * status/name/meta, and the countdown pinned right. Lines drop from the bottom
 * up as the available height shrinks, so the name is the last thing to go.
 */
export function focusStrip(opts: {
  metrics: WidgetMetrics;
  palette: WidgetPalette;
  item: WidgetClassData;
  availableHeight: number;
}) {
  const { metrics, palette, item } = opts;
  const accent = getWidgetAccent(item.colorIdx, palette.isDark, item.courseName);

  const lineStatus = Math.round(metrics.microSize * 1.4);
  const lineTitle = Math.round(metrics.titleSize * 1.45);
  const lineMeta = Math.round(metrics.microSize * 1.4);

  const showStatus = opts.availableHeight >= lineStatus + lineTitle;
  const showMeta = opts.availableHeight >= lineStatus + lineTitle + lineMeta;
  const meta = metrics.showRoom ? `${item.room} · ${item.rangeStr}` : item.rangeStr;

  return (
    <FlexWidget
      style={{
        flex: 1,
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <FlexWidget
        style={{
          width: metrics.railWidth + 1,
          height: Math.max(0, Math.round(opts.availableHeight * 0.72)),
          borderRadius: metrics.railWidth,
          backgroundColor: accent.solid,
        }}
      />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
        {showStatus ? (
          <TextWidget
            text={item.isOngoing ? 'IN CLASS NOW' : 'NEXT CLASS'}
            maxLines={1}
            allowFontScaling={false}
            style={{
              height: lineStatus,
              fontSize: metrics.microSize,
              fontFamily: WidgetFont.black,
              fontWeight: 'bold',
              letterSpacing: metrics.microSize * 0.09,
              color: accent.solid,
            }}
          />
        ) : null}
        <TextWidget
          text={item.courseName}
          maxLines={1}
          truncate="END"
          allowFontScaling={false}
          style={{
            height: lineTitle,
            fontSize: metrics.titleSize,
            fontFamily: WidgetFont.black,
            fontWeight: 'bold',
            color: palette.text,
          }}
        />
        {showMeta ? (
          <TextWidget
            text={meta}
            maxLines={1}
            truncate="END"
            allowFontScaling={false}
            style={{
              height: lineMeta,
              fontSize: metrics.microSize,
              fontFamily: WidgetFont.regular,
              color: palette.textDim,
            }}
          />
        ) : null}
      </FlexWidget>
      {chip({
        text: item.isOngoing ? item.shortRemainingStr : item.shortRemainingStr.replace(/^in /, ''),
        fg: accent.on,
        bg: accent.solid,
        fontSize: metrics.microSize,
        marginLeft: 8,
      })}
    </FlexWidget>
  );
}

export function FocusWidget({ snapshot, isDark, widgetInfo }: WidgetComponentProps) {
  const data = snapshot ?? emptySnapshot();
  const palette = getWidgetPalette(isDark);
  const metrics = getMetrics(widgetInfo);
  const item = data.upcoming[0];

  return (
    <FlexWidget
      {...openUri(WidgetLinks.timetable(new Date(data.generatedAt)))}
      accessibilityLabel={item ? `Next class ${item.courseName} at ${item.timeStr}` : 'No upcoming classes'}
      style={surfaceStyle(metrics, palette)}
    >
      {item
        ? focusStrip({
            metrics,
            palette,
            item,
            availableHeight: metrics.height - metrics.gutter * 2,
          })
        : emptyState({
            metrics,
            palette,
            title: 'No classes coming up',
            subtitle: 'Your schedule is clear',
          })}
    </FlexWidget>
  );
}
