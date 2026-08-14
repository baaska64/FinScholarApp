# Empirical Challenge Report — Milestone M1 (Schedule Tab Redesign)

## Challenge Summary

**Overall risk assessment**: MEDIUM

The Schedule tab redesign (Milestone M1) is visually exceptional, feature-complete (all 35 pre-redesign items present and working), type-safe (`npx tsc --noEmit` passes with 0 errors), and backed by a comprehensive unit test suite (67 passed tests across 19 test suites).

However, empirical stress testing revealed **1 specific logic bug** in `schedule.tsx` date string formatting that causes attendance log lookup discrepancies in timezones ahead of UTC (e.g. UTC+1 to UTC+12).

---

## Challenges

### [Medium] Challenge 1: Timezone Date String Offset Discrepancy in Hero Attendance Calculation

- **Assumption challenged**: `new Date(startDateStr + 'T00:00:00').toISOString().split('T')[0]` produces the same YYYY-MM-DD date key as `AttendanceTracker.tsx`.
- **Attack scenario**: 
  In positive UTC timezones (such as UTC+8 Philippines / Asia/Manila):
  - `AttendanceTracker.tsx` parses start dates as `new Date('2026-08-01')` (UTC midnight), generating date key `"2026-08-01_c1"`.
  - `schedule.tsx` (line 600) parses start dates as `new Date('2026-08-01T00:00:00')` (local midnight).
  - Calling `.toISOString()` on local midnight in UTC+8 yields `"2026-07-31T16:00:00.000Z"`, producing date key `"2026-07-31_c1"`.
- **Blast radius**: The `overallAttendance` calculation in `schedule.tsx` fails to match attendance log entries saved by `AttendanceTracker.tsx` in positive UTC timezones, causing the top Hero Stats Card to display unlogged / incorrect attendance percentage.
- **Empirical Proof**:
  ```bash
  $ node -e "console.log('T00:00:00:', new Date('2026-08-01T00:00:00').toISOString().split('T')[0]); console.log('without T:', new Date('2026-08-01').toISOString().split('T')[0]);"
  T00:00:00: 2026-07-31
  without T: 2026-08-01
  ```
- **Mitigation**: In `app/(tabs)/schedule.tsx` line 600, change:
  `const start = new Date(startDateStr + 'T00:00:00');`
  to:
  `const start = new Date(startDateStr);`

---

### [Low] Challenge 2: Side-Effect Execution inside React State Updater Callback

- **Assumption challenged**: React `setState` updater callbacks are pure functions.
- **Attack scenario**: In `schedule.tsx` line 266 (`onUpdateClasses`), `SyncService.pushLocalChanges(nd)` and `setTimeout` are executed inside the `setData((prevData) => ...)` functional updater.
- **Blast radius**: Low. Multiple re-renders or concurrent updates can queue duplicate timeouts.
- **Mitigation**: Move `SyncService.pushLocalChanges` call outside of `setData` state updater callback.

---

## Stress Test Results

- **TypeScript Compilation**: `npx tsc --noEmit` → PASS (0 errors)
- **Unit Test Runner**: `npm test` → PASS (67/67 tests passed, 19 test suites)
- **Pre-Redesign Feature Inventory**: 35 / 35 features verified
  - SCH-HDR-01 to 06: PASS
  - SCH-VIE-01 to 03: PASS
  - SCH-GRD-01 to 07: PASS
  - SCH-LST-01 to 02: PASS
  - SCH-ATT-01 to 06: PASS
  - SCH-MOD-01 to 04: PASS
  - SCH-SCN-01 to 03: PASS
  - SCH-EXP-01 to 02: PASS
  - SCH-REG-01 & SCH-EMP-01: PASS

---

## Verdict

**VERDICT**: `REJECT` (Pending 1-line fix for Challenge 1)

While the implementation is 99% solid and TypeScript clean, Challenge 1 represents a real bug in `schedule.tsx` date matching that invalidates the accuracy of the Hero Card Attendance metric in user environments (UTC+8). Once line 600 in `schedule.tsx` is fixed from `new Date(startDateStr + 'T00:00:00')` to `new Date(startDateStr)`, this can be immediately `APPROVED`.
