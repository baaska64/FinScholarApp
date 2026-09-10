/**
 * "Deadlines" — what is due, soonest first.
 *
 * Urgency is carried by colour on the rail and the due label, not by an icon or
 * a word buried in a sentence: overdue reads red before you have read anything.
 * Anything already submitted or graded is gone from this list — the widget is
 * about what is left, not what happened.
 */

import React from 'react';
import { FlexWidget } from 'react-native-android-widget';
import type { WidgetComponentProps } from './FocusWidget';
import { emptySnapshot, type TaskUrgency } from './widgetData';
import { distributeRowHeight, fitCount, getMetrics, listSpace } from './widgetLayout';
import { getToneColors, getWidgetPalette, type WidgetPalette, type WidgetTone } from './widgetTheme';
import { chip, emptyState, header, openUri, scheduleRow, surfaceStyle, WidgetLinks } from './widgetUi';

export function urgencyTone(urgency: TaskUrgency): WidgetTone {
  switch (urgency) {
    case 'overdue':
      return 'danger';
    case 'today':
      return 'warning';
    case 'soon':
      return 'brand';
    default:
      return 'neutral';
  }
}

/** Past due and due today get a filled chip; anything further out stays quiet. */
function isLoud(urgency: TaskUrgency): boolean {
  return urgency === 'overdue' || urgency === 'today';
}

function railColor(palette: WidgetPalette, urgency: TaskUrgency) {
  const tone = getToneColors(palette, urgencyTone(urgency));
  return urgency === 'later' || urgency === 'none' ? palette.line : tone.fg;
}

export function DeadlinesWidget({ snapshot, isDark, widgetInfo }: WidgetComponentProps) {
  const data = snapshot ?? emptySnapshot();
  const palette = getWidgetPalette(isDark);
  const metrics = getMetrics(widgetInfo);
  const link = openUri(WidgetLinks.tasks(new Date(data.generatedAt)));

  if (data.tasks.length === 0) {
    const success = getToneColors(palette, 'success');
    return (
      <FlexWidget {...link} accessibilityLabel="No tasks due" style={surfaceStyle(metrics, palette)}>
        {emptyState({
          metrics,
          palette,
          title: 'All caught up',
          subtitle: 'Nothing is waiting on you',
          accent: success.fg,
        })}
      </FlexWidget>
    );
  }

  const headerHeight = metrics.showHeader ? metrics.headerHeight : 0;
  const space = listSpace(metrics, [headerHeight]);
  const capacity = fitCount(space, metrics.rowHeight, metrics.gap, data.tasks.length);
  const visible = data.tasks.slice(0, capacity);
  const rowHeight = distributeRowHeight(space, visible.length, metrics.gap, metrics.rowHeight);

  const overdue = data.stats.overdueCount;
  const dangerTone = getToneColors(palette, 'danger');
  const brandTone = getToneColors(palette, 'brand');

  return (
    <FlexWidget
      {...link}
      accessibilityLabel={`${data.stats.pendingCount} open tasks, ${overdue} overdue`}
      style={surfaceStyle(metrics, palette)}
    >
      {metrics.showHeader
        ? header({
            metrics,
            palette,
            label: 'DEADLINES',
            trailing:
              overdue > 0
                ? chip({ text: `${overdue} overdue`, fg: dangerTone.fg, bg: dangerTone.bg, fontSize: metrics.microSize })
                : chip({
                    text: `${data.stats.pendingCount} open`,
                    fg: brandTone.fg,
                    bg: brandTone.bg,
                    fontSize: metrics.microSize,
                  }),
          })
        : null}

      <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'column', overflow: 'hidden' }}>
        {visible.map((task, idx) => {
          const tone = getToneColors(palette, urgencyTone(task.urgency));
          return scheduleRow({
            rowKey: task.id || idx,
            metrics,
            palette,
            rowHeight,
            accent: railColor(palette, task.urgency),
            // The subject code takes the slot a start time holds on the
            // schedule widgets, so the whole family shares one rhythm. It needs
            // more width than a time does, though — a task title carries more
            // meaning than the subject it belongs to, so it wins the space.
            time: metrics.width >= 280 ? task.subjectName : '',
            title: task.title,
            trailingChip: isLoud(task.urgency)
              ? chip({ text: task.dueLabel, fg: tone.fg, bg: tone.bg, fontSize: metrics.microSize, marginLeft: 6 })
              : null,
            trailing: isLoud(task.urgency) ? undefined : task.dueLabel,
            marginBottom: idx === visible.length - 1 ? 0 : metrics.gap,
          });
        })}
      </FlexWidget>
    </FlexWidget>
  );
}
