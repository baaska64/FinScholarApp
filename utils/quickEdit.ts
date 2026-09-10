/**
 * The arithmetic behind dragging a class block around the timetable.
 *
 * It lives here rather than inside `TimetableGrid` because a gesture cannot be
 * exercised by the test runner — nothing in this project renders — but the
 * snapping and the clamping at the edges of the grid are exactly the parts that
 * quietly corrupt a schedule when they are wrong. A block that lands on hour
 * 25, or whose duration goes negative, is a data bug, not a visual one.
 */

/** Quick Edit snaps to five-minute rows — the same step the nudge buttons use. */
export const SNAP_MINUTES = 5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Rounds an hour-float to the nearest snap step. 8.13 → 8.1666… (8:10). */
export function snapToGrid(hour: number): number {
    if (!Number.isFinite(hour)) return 0;
    return (Math.round((hour * 60) / SNAP_MINUTES) * SNAP_MINUTES) / 60;
}

export interface GridMetrics {
    /** Pixel width of one day column. */
    dayWidth: number;
    /** Pixel height of one hour row. */
    hourHeight: number;
    /** How many day columns are on screen. */
    dayCount: number;
    /** First and last hour the grid draws. */
    startHour: number;
    endHour: number;
}

export interface BlockMove {
    /** Index into the displayed day columns, not the ledger's day number. */
    dayIndex: number;
    startHour: number;
}

/**
 * Where a block lands for a finger delta, snapped to the day column and the
 * five-minute row, and kept inside the grid at both ends.
 */
export function resolveBlockMove(
    block: { dayIndex: number; startHour: number; duration: number },
    dx: number,
    dy: number,
    grid: GridMetrics,
): BlockMove {
    const columns = grid.dayWidth > 0 ? Math.round(dx / grid.dayWidth) : 0;
    const dayIndex = clamp(block.dayIndex + columns, 0, Math.max(0, grid.dayCount - 1));

    const rawHour = block.startHour + (grid.hourHeight > 0 ? dy / grid.hourHeight : 0);
    // The block must fit end-to-end, so the last valid start is `endHour - duration`.
    const latestStart = Math.max(grid.startHour, grid.endHour - block.duration);
    const startHour = clamp(snapToGrid(rawHour), grid.startHour, latestStart);

    return { dayIndex, startHour };
}

/**
 * New duration for a block whose bottom edge was dragged by `dy`. Never shorter
 * than one snap step, never running past the bottom of the grid.
 */
export function resolveBlockResize(
    block: { startHour: number; duration: number },
    dy: number,
    grid: Pick<GridMetrics, 'hourHeight' | 'endHour'>,
): number {
    const raw = block.duration + (grid.hourHeight > 0 ? dy / grid.hourHeight : 0);
    const maxDuration = Math.max(SNAP_MINUTES / 60, grid.endHour - block.startHour);
    return clamp(snapToGrid(raw), SNAP_MINUTES / 60, maxDuration);
}
