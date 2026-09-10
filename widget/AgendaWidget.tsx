/**
 * "Today" — the full day, in order.
 *
 * Where Up Next answers "what now", this answers "what does today look like".
 * Sessions already finished are dimmed rather than hidden so the day still
 * reads as a shape, and a meter across the top shows how much of it is behind
 * you. When the list cannot fit the whole day it windows onto the first class
 * that has not happened yet — the morning is the part you no longer need.
 */

import React from 'react';
import { FlexWidget } from 'react-native-android-widget';
import type { WidgetComponentProps } from './FocusWidget';
import { emptySnapshot, type WidgetTodayClass } from './widgetData';
import { distributeRowHeight, fitCount, getMetrics, listSpace } from './widgetLayout';
import { getToneColors, getWidgetAccent, getWidgetPalette } from './widgetTheme';
import { chip, emptyState, header, meter, openUri, scheduleRow, surfaceStyle, WidgetLinks } from './widgetUi';

/**
 * Picks which slice of the day to show when it does not all fit: anchored on
 * the first class still to come, falling back to the tail of the day once
 * everything is over.
 */
export function windowAgenda(today: WidgetTodayClass[], capacity: number): WidgetTodayClass[] {
  if (capacity <= 0) return [];
  if (capacity >= today.length) return today;

  const firstActive = today.findIndex((cls) => cls.state !== 'past');
  const start = firstActive === -1 ? today.length - capacity : Math.min(firstActive, today.length - capacity);
  return today.slice(Math.max(0, start), Math.max(0, start) + capacity);
}

export function AgendaWidget({ snapshot, isDark, widgetInfo }: WidgetComponentProps) {
  const data = snapshot ?? emptySnapshot();
  const palette = getWidgetPalette(isDark);
  const metrics = getMetrics(widgetInfo);
  const link = openUri(WidgetLinks.attendance(new Date(data.generatedAt)));

  if (data.today.length === 0) {
    return (
      <FlexWidget {...link} accessibilityLabel="Nothing scheduled today" style={surfaceStyle(metrics, palette)}>
        {emptyState({
          metrics,
          palette,
          title: 'Nothing scheduled today',
          subtitle: data.hasSchedule ? 'A clear day — use it well' : 'Add your timetable to get started',
        })}
      </FlexWidget>
    );
  }

  const total = data.today.length;
  const done = total - data.stats.classesLeftToday;
  const showMeter = metrics.scale === 'md' || metrics.scale === 'lg';
  const meterBlock = showMeter ? 4 : 0;
  const headerHeight = metrics.showHeader ? metrics.headerHeight : 0;

  const space = listSpace(metrics, [headerHeight, meterBlock]);
  const capacity = fitCount(space, metrics.rowHeight, metrics.gap, total);
  const visible = windowAgenda(data.today, capacity);
  const rowHeight = distributeRowHeight(space, visible.length, metrics.gap, metrics.rowHeight);

  const successTone = getToneColors(palette, 'success');
  const brandTone = getToneColors(palette, 'brand');
  const remaining = data.stats.classesLeftToday;

  return (
    <FlexWidget
      {...link}
      accessibilityLabel={`Today: ${total} classes, ${remaining} remaining`}
      style={surfaceStyle(metrics, palette)}
    >
      {metrics.showHeader
        ? header({
            metrics,
            palette,
            label:
              metrics.width >= 210
                ? `${data.dayLabel.toUpperCase()}, ${data.dateLabel.toUpperCase()}`
                : data.dayLabel.toUpperCase(),
            trailing:
              remaining > 0
                ? chip({ text: `${remaining} to go`, fg: brandTone.fg, bg: brandTone.bg, fontSize: metrics.microSize })
                : chip({ text: 'Day done', fg: successTone.fg, bg: successTone.bg, fontSize: metrics.microSize }),
          })
        : null}

      {showMeter
        ? meter({
            value: total > 0 ? done / total : 0,
            width: metrics.width - metrics.gutter * 2,
            track: palette.track,
            fill: palette.success,
            height: 4,
            marginTop: 0,
          })
        : null}

      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          flexDirection: 'column',
          overflow: 'hidden',
          marginTop: showMeter ? metrics.gap : 0,
        }}
      >
        {visible.map((item, idx) => {
          const accent = getWidgetAccent(item.colorIdx, palette.isDark, item.courseName);
          const isPast = item.state === 'past';
          const isNow = item.state === 'now';
          return scheduleRow({
            rowKey: item.id || idx,
            metrics,
            palette,
            rowHeight,
            // A finished class keeps its slot but loses its colour, so the eye
            // lands on what is still ahead.
            accent: isPast ? palette.line : accent.solid,
            time: item.timeStr,
            title: item.courseName,
            dimmed: isPast,
            trailingChip: isNow
              ? chip({ text: 'NOW', fg: accent.on, bg: accent.solid, fontSize: metrics.microSize, marginLeft: 6 })
              : null,
            trailing: !isNow && metrics.showRoom ? item.room : undefined,
            marginBottom: idx === visible.length - 1 ? 0 : metrics.gap,
          });
        })}
      </FlexWidget>
    </FlexWidget>
  );
}
