/**
 * Everything the calendar tab knows how to compute, with no React in it.
 *
 * The screen used to derive dates inline, and two of those derivations were
 * wrong in ways a student would only notice at the wrong moment: event dates
 * were compared through `new Date(str).toISOString()`, which shifts a date to
 * the previous day for anyone west of UTC, and the month grid measured itself
 * from `Dimensions.get('window')` read once at module scope. Date maths lives
 * here now so it can be tested (`__tests__/calendar.test.js`), and layout maths
 * lives in the component that can measure itself.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventTypeKey =
    | 'enrollment'
    | 'drop_deadline'
    | 'finals'
    | 'holiday'
    | 'org_event'
    | 'custom';

export type CalendarItemKind = 'event' | 'task';

export interface CalendarItem {
    id: string;
    kind: CalendarItemKind;
    title: string;
    /** Local `YYYY-MM-DD`. The only date format the calendar compares on. */
    dateKey: string;
    /** Minutes past local midnight, or null for an all-day item. */
    minutes: number | null;
    type?: EventTypeKey;
    note?: string;
    /** Task fields. */
    status?: string;
    priority?: string;
    subjectId?: string;
    subjectName?: string;
    subjectCode?: string;
    colorIdx?: number;
    /** Which term the item was found in — items are collected across all of them. */
    yearId?: string;
    semId?: string;
    yearName?: string;
    semName?: string;
    isCurrentTerm?: boolean;
}

export interface ClassOccurrence {
    id: string;
    name: string;
    room?: string;
    /** Float hour: 13.5 is 1:30 PM. */
    startHour: number;
    duration: number;
    colorIdx?: number;
    subjectId?: string;
}

export interface MonthCell {
    /** Local `YYYY-MM-DD`. */
    key: string;
    day: number;
    month: number;
    year: number;
    /** False for the leading/trailing days borrowed from the adjacent month. */
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
}

export type TermState = 'unset' | 'upcoming' | 'active' | 'ended';

export interface TermProgress {
    state: TermState;
    startKey: string | null;
    endKey: string | null;
    /** 0–1, clamped. 0 when the range is unknown. */
    percent: number;
    dayNumber: number;
    totalDays: number;
    weekNumber: number;
    totalWeeks: number;
    daysLeft: number;
    daysUntilStart: number;
}

// ─── Event type registry ──────────────────────────────────────────────────────

/**
 * The canonical list, in the order the picker shows it. `calendar.tsx` and
 * `VisualCalendar.tsx` each carried their own copy with *different* hexes, so
 * one event was cyan in the grid and teal in the list below it. Colour now
 * comes from `getEventTint` in `components/calendar/calendarTheme.ts`; this
 * file owns only the identity, which is what the pure logic needs.
 */
export const EVENT_TYPE_ORDER: EventTypeKey[] = [
    'finals',
    'drop_deadline',
    'enrollment',
    'holiday',
    'org_event',
    'custom',
];

export const EVENT_TYPE_LABELS: Record<EventTypeKey, string> = {
    enrollment: 'Enrollment',
    drop_deadline: 'Deadline',
    finals: 'Exams',
    holiday: 'Holiday',
    org_event: 'Event',
    custom: 'Other',
};

/** Anything unrecognised (older imports, hand-edited ledgers) reads as custom. */
export function normalizeEventType(type: unknown): EventTypeKey {
    return EVENT_TYPE_ORDER.includes(type as EventTypeKey) ? (type as EventTypeKey) : 'custom';
}

// ─── Date primitives ──────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local `YYYY-MM-DD`. Never `toISOString`, which is UTC and shifts the day. */
export function toDateKey(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local midnight for a `YYYY-MM-DD`, or null if it is not one. */
export function parseDateKey(key: string): Date | null {
    if (typeof key !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.slice(0, 10));
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const date = new Date(y, mo, d);
    // Rejects 2025-02-31, which Date would roll forward into March.
    if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
    return date;
}

/**
 * Any stored date shape → a local date key.
 *
 * The ledger holds three: milestones write `YYYY-MM-DD`, tasks write a full
 * ISO timestamp, and imported events can arrive as either. A bare
 * `YYYY-MM-DD` must be read as local, so it is sliced rather than parsed.
 */
export function toDateKeyLoose(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : toDateKey(value);
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return parseDateKey(trimmed) ? trimmed : null;
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : toDateKey(parsed);
}

/** Minutes past local midnight, or null when the value carries no clock time. */
export function toMinutesOfDay(value: unknown): number | null {
    if (typeof value !== 'string' || !value.includes('T')) return null;
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return null;
    return parsed.getHours() * 60 + parsed.getMinutes();
}

export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, n: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function addMonths(date: Date, n: number): Date {
    // Anchored on the 1st so stepping from Jan 31 lands on Feb 1, not Mar 3.
    return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

/** Whole days between two date keys, b - a. Null if either is unparseable. */
export function daysBetweenKeys(a: string, b: string): number | null {
    const da = parseDateKey(a);
    const db = parseDateKey(b);
    if (!da || !db) return null;
    // Round rather than floor: a DST boundary makes the span 23 or 25 hours.
    return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/**
 * The app's day index: 0 = Monday … 6 = Sunday.
 *
 * `class.day` is stored this way throughout the ledger, so every screen that
 * touches the timetable has to convert. This is that conversion.
 */
export function appDayIndex(date: Date): number {
    const js = date.getDay();
    return js === 0 ? 6 : js - 1;
}

/** Monday-first weekday initials, matching the timetable's column order. */
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Month grid ───────────────────────────────────────────────────────────────

/**
 * Six rows of seven, Monday first.
 *
 * Six is the maximum a Gregorian month can span, so building six and trimming
 * is simpler than counting. Pass the result through `trimTrailingWeeks` for a
 * grid that only shows the weeks the month actually touches.
 */
export function buildMonthMatrix(year: number, month: number, today: Date = new Date()): MonthCell[] {
    const first = new Date(year, month, 1);
    const lead = appDayIndex(first);
    const todayKey = toDateKey(today);
    const cells: MonthCell[] = [];

    for (let i = 0; i < 42; i++) {
        const date = new Date(year, month, 1 - lead + i);
        const key = toDateKey(date);
        const weekday = appDayIndex(date);
        cells.push({
            key,
            day: date.getDate(),
            month: date.getMonth(),
            year: date.getFullYear(),
            inMonth: date.getMonth() === month && date.getFullYear() === year,
            isToday: key === todayKey,
            isWeekend: weekday >= 5,
        });
    }

    return cells;
}

/**
 * Drops any trailing week made entirely of the next month's days.
 *
 * September 2026 runs Aug 31 – Oct 4, so its sixth row is Oct 5–11: a whole
 * row of greyed-out numbers that belong to a month you are not looking at,
 * costing ~50pt on a phone. A fixed six rows only earns its keep when the panel
 * underneath must not move; once the month view scrolls as one page, it is pure
 * waste. Leading weeks are never trimmed — the first row always holds day 1.
 */
export function trimTrailingWeeks(cells: MonthCell[]): MonthCell[] {
    let end = cells.length;
    while (end >= 7 && cells.slice(end - 7, end).every(c => !c.inMonth)) {
        end -= 7;
    }
    return cells.slice(0, end);
}

/**
 * Cuts a flat cell list into rows of seven.
 *
 * The grid renders one `View` per week with seven `flex: 1` children rather
 * than a single `flexWrap` container. That is not a style preference: a wrapped
 * container needs each cell to carry a width, and the percentage `flexBasis`
 * fallback used while the container was still being measured did not resolve in
 * Yoga — cells collapsed to their content and **eleven** landed on a row that
 * had seven weekday headers above it. Seven flexed children in an explicit row
 * cannot be wrong, and need no measurement.
 */
export function chunkWeeks(cells: MonthCell[]): MonthCell[][] {
    const weeks: MonthCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
}

// ─── Reading the ledger ───────────────────────────────────────────────────────

export interface CollectOptions {
    activeYearId?: string | null;
    activeSemId?: string | null;
    /** Task deadlines are opt-in so a heavy task load cannot bury the events. */
    includeTasks?: boolean;
}

/**
 * Flattens the whole ledger into one dated stream.
 *
 * Events come from every term, not just the active one — a drop deadline in
 * next semester still belongs on October's grid. Each item carries the term it
 * was found in so the UI can say so, and can offer to switch.
 */
export function collectCalendarItems(data: any, options: CollectOptions = {}): CalendarItem[] {
    const { activeYearId = null, activeSemId = null, includeTasks = true } = options;
    const items: CalendarItem[] = [];
    const years = Array.isArray(data?.years) ? data.years : [];

    years.forEach((year: any) => {
        const semesters = Array.isArray(year?.semesters) ? year.semesters : [];
        semesters.forEach((sem: any) => {
            const isCurrentTerm = year?.id === activeYearId && sem?.id === activeSemId;
            const termMeta = {
                yearId: year?.id,
                semId: sem?.id,
                yearName: year?.name,
                semName: sem?.name,
                isCurrentTerm,
            };

            (Array.isArray(sem?.milestones) ? sem.milestones : []).forEach((m: any) => {
                const dateKey = toDateKeyLoose(m?.date);
                if (!dateKey || !m?.id) return;
                items.push({
                    id: String(m.id),
                    kind: 'event',
                    title: String(m.title || 'Untitled event'),
                    dateKey,
                    minutes: toMinutesOfDay(m?.date),
                    type: normalizeEventType(m?.type),
                    note: m?.note ? String(m.note) : undefined,
                    ...termMeta,
                });
            });

            if (!includeTasks) return;

            (Array.isArray(sem?.subjects) ? sem.subjects : []).forEach((subject: any) => {
                (Array.isArray(subject?.requirements) ? subject.requirements : []).forEach((req: any) => {
                    const dateKey = toDateKeyLoose(req?.dueDate);
                    if (!dateKey || !req?.id) return;
                    items.push({
                        id: String(req.id),
                        kind: 'task',
                        title: String(req.title || 'Untitled task'),
                        dateKey,
                        minutes: toMinutesOfDay(req?.dueDate),
                        note: req?.description ? String(req.description) : undefined,
                        status: req?.status || 'pending',
                        priority: req?.priority || 'medium',
                        subjectId: subject?.id,
                        subjectName: subject?.name,
                        subjectCode: subject?.code,
                        colorIdx: subject?.colorIdx,
                        ...termMeta,
                    });
                });
            });
        });
    });

    return sortItems(items);
}

/** Chronological, all-day items first within a date, then by title. */
export function sortItems(items: CalendarItem[]): CalendarItem[] {
    return [...items].sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
        const am = a.minutes ?? -1;
        const bm = b.minutes ?? -1;
        if (am !== bm) return am - bm;
        return a.title.localeCompare(b.title);
    });
}

export function groupByDateKey(items: CalendarItem[]): Record<string, CalendarItem[]> {
    const map: Record<string, CalendarItem[]> = {};
    items.forEach(item => {
        if (!map[item.dateKey]) map[item.dateKey] = [];
        map[item.dateKey].push(item);
    });
    return map;
}

/**
 * The classes that actually meet on a given date.
 *
 * Recurring classes are not stored as dated items, so they are derived. When
 * the term has both dates set, dates outside it return nothing — otherwise
 * every Monday of a student's life would show a full timetable, including the
 * summer, which is what made the old month grid useless as an answer to "what
 * is happening that day".
 */
export function getClassesForDate(sem: any, date: Date): ClassOccurrence[] {
    const classes = Array.isArray(sem?.classes) ? sem.classes : [];
    if (classes.length === 0) return [];

    const key = toDateKey(date);
    const startKey = toDateKeyLoose(sem?.startDate);
    const endKey = toDateKeyLoose(sem?.endDate);
    if (startKey && key < startKey) return [];
    if (endKey && key > endKey) return [];

    const weekday = appDayIndex(date);

    return classes
        .filter((c: any) => Number(c?.day) === weekday)
        .map((c: any) => ({
            id: String(c?.id != null ? c.id : `${c?.name}-${c?.startHour}`),
            name: String(c?.name || 'Class'),
            room: c?.room ? String(c.room) : undefined,
            startHour: Number(c?.startHour) || 0,
            duration: Number(c?.duration) || 1,
            colorIdx: c?.colorIdx,
            subjectId: c?.subjectId,
        }))
        .sort((a: ClassOccurrence, b: ClassOccurrence) => a.startHour - b.startHour);
}

// ─── Term progress ────────────────────────────────────────────────────────────

/**
 * Where today sits inside the term, as a week number and a percentage.
 *
 * The old screen showed the two dates and nothing else, so a student had to do
 * this arithmetic in their head to answer "how much term is left".
 */
export function getTermProgress(sem: any, today: Date = new Date()): TermProgress {
    const startKey = toDateKeyLoose(sem?.startDate);
    const endKey = toDateKeyLoose(sem?.endDate);
    const todayKey = toDateKey(today);

    const base: TermProgress = {
        state: 'unset',
        startKey,
        endKey,
        percent: 0,
        dayNumber: 0,
        totalDays: 0,
        weekNumber: 0,
        totalWeeks: 0,
        daysLeft: 0,
        daysUntilStart: 0,
    };

    if (!startKey || !endKey) return base;

    const span = daysBetweenKeys(startKey, endKey);
    if (span === null || span < 0) return base;

    const totalDays = span + 1;
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    const elapsed = daysBetweenKeys(startKey, todayKey);
    if (elapsed === null) return base;

    if (elapsed < 0) {
        return {
            ...base,
            state: 'upcoming',
            totalDays,
            totalWeeks,
            daysUntilStart: -elapsed,
            daysLeft: totalDays,
        };
    }

    if (elapsed >= totalDays) {
        return {
            ...base,
            state: 'ended',
            percent: 1,
            dayNumber: totalDays,
            totalDays,
            weekNumber: totalWeeks,
            totalWeeks,
        };
    }

    return {
        state: 'active',
        startKey,
        endKey,
        percent: totalDays > 1 ? elapsed / (totalDays - 1) : 1,
        dayNumber: elapsed + 1,
        totalDays,
        weekNumber: Math.floor(elapsed / 7) + 1,
        totalWeeks,
        daysLeft: totalDays - elapsed - 1,
        daysUntilStart: 0,
    };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

/** "Today" / "Tomorrow" / "In 5 days" / "3 days ago". */
export function relativeDayLabel(dateKey: string, today: Date = new Date()): string {
    const diff = daysBetweenKeys(toDateKey(today), dateKey);
    if (diff === null) return '';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 0) return diff < 7 ? `In ${diff} days` : `In ${Math.round(diff / 7)} wk`;
    const past = Math.abs(diff);
    return past < 7 ? `${past} days ago` : `${Math.round(past / 7)} wk ago`;
}

/** 13.5 → "1:30 PM". Shared by class rows and timed items. */
export function formatHour(hour: number): string {
    const whole = Math.floor(hour);
    const mins = Math.round((hour - whole) * 60);
    const suffix = whole >= 12 && whole < 24 ? 'PM' : 'AM';
    let display = whole % 12;
    if (display === 0) display = 12;
    return `${display}:${pad2(mins)} ${suffix}`;
}

export function formatMinutes(minutes: number): string {
    return formatHour(minutes / 60);
}

export function formatDateKeyLong(dateKey: string): string {
    const date = parseDateKey(dateKey);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDateKeyShort(dateKey: string): string {
    const date = parseDateKey(dateKey);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Filtering ────────────────────────────────────────────────────────────────

export interface ItemFilter {
    /** Case-insensitive substring over title, note and subject. */
    query?: string;
    /** Empty or omitted means every type. Only applies to events. */
    types?: EventTypeKey[];
    /** 'term' keeps only the active term's items. */
    scope?: 'term' | 'all';
    kinds?: CalendarItemKind[];
}

export function filterItems(items: CalendarItem[], filter: ItemFilter = {}): CalendarItem[] {
    const { query = '', types, scope = 'all', kinds } = filter;
    const needle = query.trim().toLowerCase();
    const typeSet = types && types.length > 0 ? new Set(types) : null;
    const kindSet = kinds && kinds.length > 0 ? new Set(kinds) : null;

    return items.filter(item => {
        if (scope === 'term' && !item.isCurrentTerm) return false;
        if (kindSet && !kindSet.has(item.kind)) return false;
        if (typeSet && item.kind === 'event' && !typeSet.has(item.type || 'custom')) return false;
        if (!needle) return true;
        const haystack = `${item.title} ${item.note || ''} ${item.subjectName || ''} ${item.subjectCode || ''}`.toLowerCase();
        return haystack.includes(needle);
    });
}

/** Items dated today or later, soonest first. */
export function upcomingItems(items: CalendarItem[], today: Date = new Date(), limit?: number): CalendarItem[] {
    const todayKey = toDateKey(today);
    const future = sortItems(items).filter(i => i.dateKey >= todayKey);
    return typeof limit === 'number' ? future.slice(0, limit) : future;
}

/** Items dated before today, most recent first. */
export function pastItems(items: CalendarItem[], today: Date = new Date()): CalendarItem[] {
    const todayKey = toDateKey(today);
    return sortItems(items).filter(i => i.dateKey < todayKey).reverse();
}

/**
 * What a month cell shows: named chips, plus the count that did not fit.
 *
 * The grid used to draw coloured dots. A dot says "something happens here" and
 * nothing else, so answering "what is on the 14th?" always cost a tap. Chips
 * carry the title — truncated hard in a 48pt cell, but "Midte…" is still an
 * answer where a dot is only a question.
 *
 * When the day overflows, the **last slot is spent on the count** rather than
 * on another chip, which is the rule every calendar grid uses: two items show
 * two chips, three items show one chip and "+2".
 */
export interface DayChips {
    chips: CalendarItem[];
    overflow: number;
}

export function buildDayChips(items: CalendarItem[], limit = 2): DayChips {
    if (items.length === 0 || limit < 1) return { chips: [], overflow: items.length };
    if (items.length <= limit) return { chips: [...items], overflow: 0 };

    const shown = limit - 1;
    return { chips: items.slice(0, shown), overflow: items.length - shown };
}
