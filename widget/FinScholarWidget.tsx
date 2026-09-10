/**
 * "Up Next" — the flagship schedule widget.
 *
 * One hero panel in the class's own colour answers "what am I in / what's
 * next", and a plain list underneath answers "and after that". The hero is the
 * only filled block on the card: at widget sizes, a stack of filled pills eats
 * the padding budget and turns into a smudge, whereas one solid panel against
 * quiet rows gives a figure/ground the eye resolves at a glance.
 *
 * Every block height is computed, not guessed, and the row count comes from
 * what is actually left over — see widgetLayout.ts.
 */

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { focusStrip, type WidgetComponentProps } from './FocusWidget';
import { emptySnapshot, type WidgetClassData } from './widgetData';
import { distributeRowHeight, fitCount, getMetrics, listSpace, type WidgetMetrics } from './widgetLayout';
import { getToneColors, getWidgetAccent, getWidgetPalette, WidgetFont, type WidgetPalette } from './widgetTheme';
import { chip, emptyState, header, meter, openUri, scheduleRow, surfaceStyle, WidgetLinks } from './widgetUi';

/** Inner padding of the hero panel, kept in one place so the height maths matches the style. */
function heroPadding(metrics: WidgetMetrics) {
  switch (metrics.scale) {
    case 'lg':
      return { horizontal: 12, vertical: 9 };
    case 'sm':
      return { horizontal: 9, vertical: 7 };
    default:
      return { horizontal: 10, vertical: 8 };
  }
}

/**
 * Exact hero height for a given item. The list below claims whatever is left,
 * so this has to be the real number rather than a fixed budget — an estimate
 * that runs short is exactly how a widget ends up with a clipped last row.
 */
export function measureHero(metrics: WidgetMetrics, isOngoing: boolean) {
  const pad = heroPadding(metrics);
  const statusLine = Math.round(metrics.microSize * 1.5);
  const titleLine = Math.round(metrics.heroSize * 1.4);
  const metaLine = metrics.showHeroMeta ? Math.round(metrics.microSize * 1.4) : 0;
  const meterLine = isOngoing && metrics.scale !== 'xs' ? 8 : 0;
  return {
    pad,
    statusLine,
    titleLine,
    metaLine,
    meterLine,
    height: pad.vertical * 2 + statusLine + titleLine + metaLine + meterLine,
  };
}

function hero(opts: { metrics: WidgetMetrics; palette: WidgetPalette; item: WidgetClassData }) {
  const { metrics, palette, item } = opts;
  const accent = getWidgetAccent(item.colorIdx, palette.isDark, item.courseName);
  const dims = measureHero(metrics, item.isOngoing);
  const innerWidth = Math.max(24, metrics.width - metrics.gutter * 2 - dims.pad.horizontal * 2);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: dims.height,
        flexDirection: 'column',
        borderRadius: Math.max(12, metrics.radius - 6),
        paddingHorizontal: dims.pad.horizontal,
        paddingVertical: dims.pad.vertical,
        marginBottom: metrics.gap,
        backgroundColor: accent.solid,
        backgroundGradient: { from: accent.solid, to: accent.edge, orientation: 'TL_BR' },
      }}
    >
      <FlexWidget style={{ width: 'match_parent', height: dims.statusLine, flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            // The countdown shares this row, so on a two-cell card the status
            // drops to one word rather than ellipsising mid-phrase.
            text={
              metrics.width >= 200
                ? item.isOngoing
                  ? 'IN CLASS NOW'
                  : 'UP NEXT'
                : item.isOngoing
                ? 'NOW'
                : 'NEXT'
            }
            maxLines={1}
            allowFontScaling={false}
            style={{
              fontSize: metrics.microSize,
              fontFamily: WidgetFont.black,
              fontWeight: 'bold',
              letterSpacing: metrics.microSize * 0.1,
              color: accent.on,
            }}
          />
        </FlexWidget>
        <TextWidget
          text={item.shortRemainingStr}
          maxLines={1}
          allowFontScaling={false}
          style={{
            fontSize: metrics.microSize,
            fontFamily: WidgetFont.bold,
            fontWeight: 'bold',
            color: palette.onBrandDim,
          }}
        />
      </FlexWidget>

      <TextWidget
        text={item.courseName}
        maxLines={1}
        truncate="END"
        allowFontScaling={false}
        style={{
          height: dims.titleLine,
          fontSize: metrics.heroSize,
          fontFamily: WidgetFont.black,
          fontWeight: 'bold',
          color: accent.on,
        }}
      />

      {dims.metaLine > 0 ? (
        <TextWidget
          text={metrics.showRoom ? `${item.rangeStr} · ${item.room}` : item.rangeStr}
          maxLines={1}
          truncate="END"
          allowFontScaling={false}
          style={{
            height: dims.metaLine,
            fontSize: metrics.microSize,
            fontFamily: WidgetFont.regular,
            color: palette.onBrandDim,
          }}
        />
      ) : null}

      {dims.meterLine > 0
        ? meter({
            value: item.progress,
            width: innerWidth,
            track: palette.onBrandTrack,
            fill: accent.on,
            height: 4,
            marginTop: 4,
          })
        : null}
    </FlexWidget>
  );
}

export function FinScholarWidget({ snapshot, isDark, widgetInfo }: WidgetComponentProps) {
  const data = snapshot ?? emptySnapshot();
  const palette = getWidgetPalette(isDark);
  const metrics = getMetrics(widgetInfo);
  const now = new Date(data.generatedAt);
  const link = openUri(WidgetLinks.timetable(now));

  const first = data.upcoming[0];

  if (!first) {
    return (
      <FlexWidget {...link} accessibilityLabel="No upcoming classes" style={surfaceStyle(metrics, palette)}>
        {emptyState({
          metrics,
          palette,
          title: 'No classes coming up',
          subtitle: data.hasSchedule ? 'Enjoy the free time' : 'Add your timetable to get started',
        })}
      </FlexWidget>
    );
  }

  // Too short for a hero plus anything else — degrade to the compact strip
  // rather than clipping a panel in half.
  if (metrics.scale === 'xs') {
    return (
      <FlexWidget
        {...link}
        accessibilityLabel={`Next class ${first.courseName} at ${first.timeStr}`}
        style={surfaceStyle(metrics, palette)}
      >
        {focusStrip({ metrics, palette, item: first, availableHeight: metrics.height - metrics.gutter * 2 })}
      </FlexWidget>
    );
  }

  const heroHeight = measureHero(metrics, first.isOngoing).height;
  const headerHeight = metrics.showHeader ? metrics.headerHeight : 0;
  const rows = data.upcoming.slice(1);
  const space = listSpace(metrics, [headerHeight, heroHeight]);
  const capacity = fitCount(space, metrics.rowHeight, metrics.gap, rows.length);
  const visible = rows.slice(0, capacity);
  const rowHeight = distributeRowHeight(space, visible.length, metrics.gap, metrics.rowHeight);

  const leftToday = data.stats.classesLeftToday;
  const tone = getToneColors(palette, 'brand');

  return (
    <FlexWidget
      {...link}
      accessibilityLabel={`${first.isOngoing ? 'In class' : 'Next class'} ${first.courseName} at ${first.timeStr}`}
      style={surfaceStyle(metrics, palette)}
    >
      {metrics.showHeader
        ? header({
            metrics,
            palette,
            // On a two-cell card the chip takes most of the row, so the date
            // and the word "today" are the first things to go.
            label:
              metrics.width >= 210
                ? `${data.dayLabel.toUpperCase()} · ${data.dateLabel.toUpperCase()}`
                : data.dayLabel.toUpperCase(),
            trailing:
              leftToday > 0
                ? chip({
                    text: metrics.width >= 250 ? `${leftToday} left today` : `${leftToday} left`,
                    fg: tone.fg,
                    bg: tone.bg,
                    fontSize: metrics.microSize,
                  })
                : null,
          })
        : null}

      {hero({ metrics, palette, item: first })}

      <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'column', overflow: 'hidden' }}>
        {visible.map((item, idx) =>
          scheduleRow({
            rowKey: item.id || idx,
            metrics,
            palette,
            rowHeight,
            accent: getWidgetAccent(item.colorIdx, palette.isDark, item.courseName).solid,
            time: item.timeStr,
            title: item.courseName,
            trailing: metrics.showRoom ? item.room : item.dayLabel,
            // Gaps live between rows only — a trailing margin on the last row is
            // how a list ends up looking bottom-heavy inside a fixed card.
            marginBottom: idx === visible.length - 1 ? 0 : metrics.gap,
          })
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
