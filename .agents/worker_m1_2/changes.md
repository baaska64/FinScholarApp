# Summary of Changes — Remediation Iteration 2

## Files Modified

### 1. `app/(tabs)/schedule.tsx`
- **Location**: Line 600
- **Change**: Replaced `const start = new Date(startDateStr + 'T00:00:00');` with `const start = new Date(startDateStr);`.
- **Rationale**: Constructing `new Date(startDateStr + 'T00:00:00')` creates a Date object at local midnight. When `.toISOString()` is called on a local midnight date in positive UTC timezones (such as UTC+8 Asia/Manila), the resulting UTC ISO string shifts back by 1 day (e.g., `"2026-07-31"` instead of `"2026-08-01"`). This caused a date key mismatch with `AttendanceTracker.tsx` (which constructs dates using `new Date(startDateStr)`), leading to 0% / unlogged Attendance Rate metrics on the top Hero Overlapping Stats Card. Using `new Date(startDateStr)` ensures consistent UTC date string formatting across both components.

## Verification
- TypeScript type check (`npx tsc --noEmit`): PASSED with 0 errors.
- Test runner (`npm test`): PASSED with 19/19 test suites passed, 67/67 tests passed.
