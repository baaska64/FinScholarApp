# FinScholar Dashboard Bento Box Redesign - Reviewer Round 1 Handoff

## Summary of Review Findings & Defect Resolutions

### 1. Date Timezone Shift & Key Mismatch Defect
- **Input**: Local date string construction using UTC-based `d.toISOString().split('T')[0]` on midnight `Date` instances (`new Date(startDateStr + 'T00:00:00')`).
- **Expected**: Attendance logs and attendance calculations should generate keys using the device's local calendar date (`YYYY-MM-DD`).
- **Actual**: In positive UTC offsets (e.g. UTC+8 Asia/Manila, UTC+5:30, UTC+2), `d.toISOString().split('T')[0]` shifted the date back by 1 day (`2026-08-23` instead of `2026-08-24`), causing attendance lookups to fail and attendance metrics to compute incorrect attendance rates.
- **Root Cause**: Reliance on `.toISOString()` which converts local midnight timestamps to UTC before extracting the date string.
- **Fix**: Implemented timezone-safe `getLocalDateString(d: Date = new Date()): string` utilizing local `getFullYear()`, `getMonth() + 1`, and `getDate()` with zero-padding across all date key generation and attendance aggregation loops in `app/(tabs)/index.tsx`.

### 2. Disappearing Class Card on Attendance Action Defect
- **Input**: User tapping `[ P ]`, `[ A ]`, or `[ NC ]` directly on a class card in the Bento "Today's Classes" widget.
- **Expected**: The class card should remain visible in the widget with the active attendance status pill highlighted, allowing the user to view their logged status or switch/toggle the state.
- **Actual**: `rawTodayClasses.filter` discarded any class whose attendance log status was not `'pending'`. Consequently, tapping any attendance button caused the card to instantly disappear from the screen, and if all classes were logged, showed the empty state "Free Time - No classes today".
- **Root Cause**: Overly aggressive filtering intended for a pending-only list carried over into an interactive toggle card.
- **Fix**: Kept all today's scheduled classes displayed in the widget (`todayClasses = (currentSem?.classes || []).filter((c: any) => c.day === todayIdx)`), allowing reactive toggling and active button highlighting.

### 3. Schedule Scanner Time Parsing Minutes Truncation
- **Input**: Scanned class strings with minutes (e.g. `"8:30 AM"`, `"1:45 PM"`, `"14:30"`, `"12:30 AM"`).
- **Expected**: Decimal hours (`8.5`, `13.75`, `14.5`, `0.5`).
- **Actual**: Regular expression `match(/(\d+)/)` only captured the hour, discarding minutes completely (`"8:30 AM"` -> `8.0`).
- **Root Cause**: Incomplete regex matching hour digits only without capturing optional minute components.
- **Fix**: Upgraded regex to `match(/(\d+)(?::(\d+))?/)` with hour AM/PM offset adjustment and `m = parseInt(match[2], 10) / 60`.

### 4. Null-Safety & Edge Case Date Parsing Robustness
- **Input**: Missing, null, undefined, or empty `dueDate`, `date`, `startDate`, or `data.years`.
- **Expected**: Graceful fallback values and zero-state rendering without runtime `TypeError` or `NaN` outputs.
- **Actual**: `dueDateIso.includes('T')` threw `TypeError` when `dueDateIso` was null/undefined, and `data.years.length` threw if `years` was undefined.
- **Root Cause**: Insufficient input validation and optional chaining.
- **Fix**: Added safe guard functions `parseLocalDate`, `parseSemDate`, `getTimeLeftText`, and optional chaining `!data?.years || data.years.length === 0` and `years={data?.years || []}`.

### 5. Layout & Text Adaptability on Small Screens (<320px)
- **Input**: Narrow screen widths (<320px) and long subject codes or GWA strings.
- **Expected**: Text should scale, clip or ellipsize gracefully without breaking grid containers.
- **Actual**: Metric texts lacked `adjustsFontSizeToFit={true}` and `numberOfLines={1}`, and subject code pills in My Subjects carousel lacked `flexShrink: 1`.
- **Fix**: Added `numberOfLines={1}`, `adjustsFontSizeToFit={true}` on metric titles and Quick Hub items, and `flexShrink: 1` on subject code badges.

## Verification Record
- **TypeScript Compiler**: `npx tsc --noEmit` -> Exited 0 (0 errors).
- **Automated Test Suite**: `npm test` -> 103 test suites passed, 366 tests passed, 0 failures (1.84s).
- **Files Modified**:
  - `app/(tabs)/index.tsx`: Fixed timezone date formatting, today classes persistence, time parser with minutes, null-safety, and responsive layout tokens.
  - `__tests__/helpers/dashboardCalculations.js`: Added date & schedule time helper functions.
  - `__tests__/bento-dashboard-redesign.test.js`: Added Suites 4 & 5 covering timezone safety, date parsing, minutes parsing, and attendance persistence.
