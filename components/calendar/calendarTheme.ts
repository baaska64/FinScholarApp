import { Ionicons } from '@expo/vector-icons';
import type { EventTypeKey } from '@/utils/calendarModel';
import { EVENT_TYPE_LABELS, normalizeEventType } from '@/utils/calendarModel';

export interface EventTint {
    /** Panel wash. */
    fill: string;
    /** Inner border that matches the wash. */
    line: string;
    /** Foreground that stays legible on `fill`. */
    ink: string;
    /** Rails, dots and active states. */
    solid: string;
}

/**
 * The one event palette.
 *
 * There used to be two — `app/(tabs)/calendar.tsx` and
 * `components/calendar/VisualCalendar.tsx` each declared their own
 * `MILESTONE_TYPES` with different hexes, so the same event was cyan as a dot
 * in the grid and teal as a chip in the list eight points below it. Anything
 * that paints an event reads from here.
 *
 * Shapes match `Tints` in `constants/Theme.ts`: a wash, a line, an ink and a
 * solid, so an event chip sits next to a domain tint without clashing.
 */
const LIGHT: Record<EventTypeKey, EventTint> = {
    finals:        { fill: '#fdeae7', line: '#f8ccc5', ink: '#b23227', solid: '#dc4436' },
    drop_deadline: { fill: '#fdf0dc', line: '#f6dcb4', ink: '#9a6108', solid: '#e08b12' },
    enrollment:    { fill: '#e2f2fb', line: '#c5e4f6', ink: '#116691', solid: '#0e8ac2' },
    holiday:       { fill: '#e3f6ec', line: '#c4ead6', ink: '#12795a', solid: '#10a37a' },
    org_event:     { fill: '#efeaff', line: '#ddd2fb', ink: '#5b3fd1', solid: '#6d4aec' },
    custom:        { fill: '#eceef6', line: '#dcdfeb', ink: '#4c5570', solid: '#6b7490' },
};

const DARK: Record<EventTypeKey, EventTint> = {
    finals:        { fill: 'rgba(248,113,113,0.14)', line: 'rgba(248,113,113,0.32)', ink: '#f7a099', solid: '#f87171' },
    drop_deadline: { fill: 'rgba(232,155,42,0.14)',  line: 'rgba(232,155,42,0.30)',  ink: '#f5c37a', solid: '#e89b2a' },
    enrollment:    { fill: 'rgba(56,189,248,0.14)',  line: 'rgba(56,189,248,0.30)',  ink: '#84d3f7', solid: '#38bdf8' },
    holiday:       { fill: 'rgba(45,197,151,0.14)',  line: 'rgba(45,197,151,0.30)',  ink: '#6fe0bb', solid: '#2dc597' },
    org_event:     { fill: 'rgba(139,105,255,0.14)', line: 'rgba(139,105,255,0.30)', ink: '#b9a3ff', solid: '#8b69ff' },
    custom:        { fill: 'rgba(148,163,184,0.14)', line: 'rgba(148,163,184,0.30)', ink: '#aab2c8', solid: '#8a90b0' },
};

export function getEventTint(type: unknown, isDark: boolean): EventTint {
    const key = normalizeEventType(type);
    return (isDark ? DARK : LIGHT)[key];
}

export const EVENT_TYPE_ICONS: Record<EventTypeKey, keyof typeof Ionicons.glyphMap> = {
    finals: 'school',
    drop_deadline: 'alert-circle',
    enrollment: 'clipboard',
    holiday: 'sunny',
    org_event: 'people',
    custom: 'bookmark',
};

export function getEventIcon(type: unknown): keyof typeof Ionicons.glyphMap {
    return EVENT_TYPE_ICONS[normalizeEventType(type)];
}

export function getEventLabel(type: unknown): string {
    return EVENT_TYPE_LABELS[normalizeEventType(type)];
}
