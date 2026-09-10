/**
 * The bridge between the ledger and the home screen.
 *
 * Reads `grade_ledger_v2_data` once, builds a single snapshot, then hands it to
 * every widget the student has placed. Two things worth knowing:
 *
 *  - Each widget is rendered twice, as `{ light, dark }`. The library draws both
 *    bitmaps and Android picks by system theme, which is the only way to get the
 *    right one: this task runs headless, where `Appearance.getColorScheme()` is
 *    unreliable and never fires again when the theme changes with the app shut.
 *  - The handler is called both by the native provider (with props) and by the
 *    app itself on launch and after every sync (with none), so `props` is
 *    optional and the no-argument path refreshes everything.
 */

import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgendaWidget } from './AgendaWidget';
import { DeadlinesWidget } from './DeadlinesWidget';
import { FinScholarWidget } from './FinScholarWidget';
import { FocusWidget, type WidgetComponentProps } from './FocusWidget';
import { StatsWidget } from './StatsWidget';
import { buildWidgetSnapshot, emptySnapshot, type WidgetSnapshot } from './widgetData';

// Re-exported so callers (and the test suite) have one import for the widget
// layer's formatting rules.
export { formatCountdown, formatTimeStr, isValidClass } from './widgetData';

type WidgetComponent = (props: WidgetComponentProps) => React.JSX.Element;

/**
 * Widget name → component. The keys must match the `name` of each entry in the
 * react-native-android-widget plugin block in app.json; a widget missing from
 * one of the two is either never drawn or never offered in the picker.
 */
export const WIDGET_REGISTRY: Record<string, WidgetComponent> = {
  FinScholarWidget,
  FinScholarAgendaWidget: AgendaWidget,
  FinScholarDeadlinesWidget: DeadlinesWidget,
  FinScholarFocusWidget: FocusWidget,
  FinScholarStatsWidget: StatsWidget,
};

export const WIDGET_NAMES = Object.keys(WIDGET_REGISTRY);

/**
 * What the in-app gallery shows, in the order a student meets them. Preview
 * sizes are the dp a typical home-screen cell gives each widget, so the preview
 * is the layout they will actually get rather than a stretched approximation.
 */
export const WIDGET_GALLERY: {
  name: string;
  title: string;
  description: string;
  previewWidth: number;
  previewHeight: number;
}[] = [
  {
    name: 'FinScholarWidget',
    title: 'Up Next',
    description: 'The class you are in or heading to, plus what follows.',
    previewWidth: 280,
    previewHeight: 200,
  },
  {
    name: 'FinScholarAgendaWidget',
    title: 'Today',
    description: "Every class on today's timetable, with what is left to go.",
    previewWidth: 280,
    previewHeight: 240,
  },
  {
    name: 'FinScholarDeadlinesWidget',
    title: 'Deadlines',
    description: 'Unfinished tasks, soonest due first, overdue in red.',
    previewWidth: 280,
    previewHeight: 200,
  },
  {
    name: 'FinScholarFocusWidget',
    title: 'Next Class',
    description: 'A single strip: what is next, where, and how long you have.',
    previewWidth: 280,
    previewHeight: 84,
  },
  {
    name: 'FinScholarStatsWidget',
    title: 'Semester Pulse',
    description: 'Grade, attendance, open tasks and term progress.',
    previewWidth: 280,
    previewHeight: 190,
  },
];

export async function loadWidgetSnapshot(now: Date = new Date()): Promise<WidgetSnapshot> {
  try {
    const [dataStr, yearId, semId] = await Promise.all([
      AsyncStorage.getItem('grade_ledger_v2_data'),
      AsyncStorage.getItem('@selectedYear'),
      AsyncStorage.getItem('@selectedSemester'),
    ]);
    if (!dataStr) return emptySnapshot(now);
    return buildWidgetSnapshot(JSON.parse(dataStr), { yearId, semId, now });
  } catch (error) {
    // A corrupt ledger must still leave a drawable widget behind, or the home
    // screen keeps whatever stale bitmap it had until the next reboot.
    console.error('Failed to build widget snapshot:', error);
    return emptySnapshot(now);
  }
}

/** One themed instance — used by the in-app gallery, which renders a single preview. */
export function renderWidgetPreview(
  widgetName: string,
  snapshot: WidgetSnapshot,
  widgetInfo: { width?: unknown; height?: unknown } | null | undefined,
  isDark: boolean
) {
  const Component = WIDGET_REGISTRY[widgetName] ?? FinScholarWidget;
  return <Component snapshot={snapshot} isDark={isDark} widgetInfo={widgetInfo} />;
}

export function renderWidgetByName(
  widgetName: string,
  snapshot: WidgetSnapshot,
  widgetInfo?: { width?: unknown; height?: unknown } | null
) {
  return {
    light: renderWidgetPreview(widgetName, snapshot, widgetInfo, false),
    dark: renderWidgetPreview(widgetName, snapshot, widgetInfo, true),
  };
}

export interface WidgetTaskProps {
  widgetInfo?: { widgetName?: string; width?: unknown; height?: unknown };
  widgetAction?: 'WIDGET_ADDED' | 'WIDGET_UPDATE' | 'WIDGET_RESIZED' | 'WIDGET_DELETED' | 'WIDGET_CLICK';
  clickAction?: string;
  clickActionData?: Record<string, unknown>;
  renderWidget?: (component: unknown) => void;
}

export async function widgetTaskHandler(props?: WidgetTaskProps) {
  if (props?.widgetAction === 'WIDGET_DELETED') return;

  const snapshot = await loadWidgetSnapshot();

  // Native path: the provider already told us which widget it is drawing, so
  // render that one and skip the round-trip through getWidgetInfo.
  const targetName = props?.widgetInfo?.widgetName;
  if (props?.renderWidget && targetName) {
    props.renderWidget(renderWidgetByName(targetName, snapshot, props.widgetInfo));
    return;
  }

  await Promise.all(
    WIDGET_NAMES.map((widgetName) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: (widgetInfo) => renderWidgetByName(widgetName, snapshot, widgetInfo),
      })
    )
  );
}
