import assert from 'node:assert';
import { SNAP_MINUTES, snapToGrid, resolveBlockMove, resolveBlockResize } from '../utils/quickEdit.ts';

// A grid roughly matching the real one at 100% zoom.
const GRID = { dayWidth: 200, hourHeight: 90, dayCount: 6, startHour: 7, endHour: 20 };

export function runQuickEditTests(describe, test) {
  describe('Quick Edit Suite 1: Snapping', () => {
    test('QE1.1 Rounds to the nearest five minutes', () => {
      assert.strictEqual(snapToGrid(8), 8);
      assert.strictEqual(snapToGrid(8.5), 8.5);
      // 8.13h = 7.8 min past 8 → snaps to 8:10.
      assert.ok(Math.abs(snapToGrid(8.13) - 8 - 10 / 60) < 1e-9);
      // 8.04h = 2.4 min → snaps back to 8:00.
      assert.strictEqual(snapToGrid(8.04), 8);
    });

    test('QE1.2 Every snapped value lands on a whole step', () => {
      for (let i = 0; i < 200; i++) {
        const mins = Math.round(snapToGrid(7 + i * 0.037) * 60);
        assert.strictEqual(mins % SNAP_MINUTES, 0, `${mins} is not on the grid`);
      }
    });

    test('QE1.3 Non-numeric input cannot poison a start time', () => {
      assert.strictEqual(snapToGrid(NaN), 0);
      assert.strictEqual(snapToGrid(Infinity), 0);
    });
  });

  describe('Quick Edit Suite 2: Moving a block', () => {
    const block = { dayIndex: 0, startHour: 8, duration: 2 };

    test('QE2.1 A drag shorter than half a column keeps the day', () => {
      assert.strictEqual(resolveBlockMove(block, 99, 0, GRID).dayIndex, 0);
      assert.strictEqual(resolveBlockMove(block, 101, 0, GRID).dayIndex, 1);
    });

    test('QE2.2 Horizontal drags move whole columns', () => {
      assert.strictEqual(resolveBlockMove(block, 400, 0, GRID).dayIndex, 2);
      assert.strictEqual(resolveBlockMove({ ...block, dayIndex: 3 }, -400, 0, GRID).dayIndex, 1);
    });

    test('QE2.3 Days clamp at both ends of the week', () => {
      assert.strictEqual(resolveBlockMove(block, -5000, 0, GRID).dayIndex, 0);
      assert.strictEqual(resolveBlockMove(block, 5000, 0, GRID).dayIndex, GRID.dayCount - 1);
    });

    test('QE2.4 Vertical drags convert pixels to snapped hours', () => {
      // One hour row down.
      assert.strictEqual(resolveBlockMove(block, 0, 90, GRID).startHour, 9);
      // Half a row up.
      assert.strictEqual(resolveBlockMove(block, 0, -45, GRID).startHour, 7.5);
    });

    test('QE2.5 A block can never start before the grid does', () => {
      assert.strictEqual(resolveBlockMove(block, 0, -9999, GRID).startHour, GRID.startHour);
    });

    test('QE2.6 A block can never be dragged past the end of the day', () => {
      // duration 2 → the latest legal start is 18:00 on a grid ending at 20:00.
      assert.strictEqual(resolveBlockMove(block, 0, 9999, GRID).startHour, 18);
    });

    test('QE2.7 A block longer than the grid still gets a legal start', () => {
      const huge = { dayIndex: 0, startHour: 8, duration: 40 };
      const moved = resolveBlockMove(huge, 0, 9999, GRID);
      assert.strictEqual(moved.startHour, GRID.startHour);
      assert.ok(moved.startHour >= GRID.startHour);
    });

    test('QE2.8 Day and time resolve independently in one gesture', () => {
      const moved = resolveBlockMove(block, 400, 180, GRID);
      assert.strictEqual(moved.dayIndex, 2);
      assert.strictEqual(moved.startHour, 10);
    });
  });

  describe('Quick Edit Suite 3: Resizing a block', () => {
    const block = { startHour: 8, duration: 2 };

    test('QE3.1 Dragging the bottom edge down lengthens the block', () => {
      assert.strictEqual(resolveBlockResize(block, 90, { hourHeight: 90, endHour: 20 }), 3);
    });

    test('QE3.2 Dragging up shortens it, snapped', () => {
      assert.strictEqual(resolveBlockResize(block, -45, { hourHeight: 90, endHour: 20 }), 1.5);
    });

    test('QE3.3 Duration never goes to zero or negative', () => {
      const d = resolveBlockResize(block, -9999, { hourHeight: 90, endHour: 20 });
      assert.strictEqual(d, SNAP_MINUTES / 60);
      assert.ok(d > 0);
    });

    test('QE3.4 A block cannot be stretched past the end of the grid', () => {
      // Starts at 18:00 on a grid ending at 20:00 → at most two hours.
      assert.strictEqual(resolveBlockResize({ startHour: 18, duration: 1 }, 9999, { hourHeight: 90, endHour: 20 }), 2);
    });

    test('QE3.5 A block already at the bottom keeps a usable minimum', () => {
      const d = resolveBlockResize({ startHour: 20, duration: 1 }, 9999, { hourHeight: 90, endHour: 20 });
      assert.ok(d >= SNAP_MINUTES / 60);
    });
  });

  describe('Quick Edit Suite 4: Degenerate metrics', () => {
    test('QE4.1 A zero-width or zero-height grid does not divide by zero', () => {
      const moved = resolveBlockMove(
        { dayIndex: 1, startHour: 9, duration: 1 },
        250, 250,
        { dayWidth: 0, hourHeight: 0, dayCount: 6, startHour: 7, endHour: 20 },
      );
      assert.strictEqual(moved.dayIndex, 1);
      assert.strictEqual(moved.startHour, 9);
      assert.ok(Number.isFinite(moved.startHour));
    });

    test('QE4.2 A single-column grid pins every horizontal drag', () => {
      const moved = resolveBlockMove({ dayIndex: 0, startHour: 9, duration: 1 }, 999, 0, { ...GRID, dayCount: 1 });
      assert.strictEqual(moved.dayIndex, 0);
    });
  });
}
