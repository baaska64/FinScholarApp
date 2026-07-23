# Handoff Report — Milestone 4

## 1. Observation

- **Component Shifting Sync Bug**: 
  - File: `app/(tabs)/requirements.tsx` (lines 203–244) and `c:\Projects\FinScholarApp\.agents\challenger_m3\sync_bug_test.js` (lines 30–71).
  - Executing `node c:\Projects\FinScholarApp\.agents\challenger_m3\sync_bug_test.js` resulted in:
    ```
    ❌ Component Shift: FAIL
    Stale item was NOT removed from comp1!
    1 !== 0
    ```
  - We observed that `syncGradeItem` skipped running the cleanup pass to remove stale items if `task.status === 'graded'` and `task.linkedComponentId` is truthy, leading to duplicate entries when shifting components.

- **Positive Timezone Date Shift Bug**:
  - Files: `app/(tabs)/calendar.tsx` (line 142) and `app/(tabs)/requirements.tsx` (line 264) using `toISOString().split('T')[0]`.
  - Executing `node c:\Projects\FinScholarApp\.agents\challenger_m3\timezone_test.js` resulted in:
    ```
    --- Testing Timezone: Australia/Melbourne ---
    Current process timezone: Australia/Melbourne
    Selected Date (local): Mon Jul 20 2026 00:00:00 GMT+1000 (Australian Eastern Standard Time)
    Selected Date (ISO): 2026-07-19T14:00:00.000Z
    Saved Date String: 2026-07-19
    Result: FAIL (Expected 2026-07-20, got 2026-07-19)
    ```

- **Verification Output (Successes)**:
  - Type-checking with `npx tsc --noEmit` completed successfully with 0 errors.
  - Bundling with `npx expo export --platform web` completed successfully with output:
    ```
    Exported: dist
    ```
  - Running challenge tests suite:
    ```
    PASSED: 5
    FAILED: 0
    ```

## 2. Logic Chain

- **Component Shifting Sync Bug Resolution**:
  - In `syncGradeItem` (in `requirements.tsx` and the inline test scripts), the stale item filter checks `if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId))`.
  - If a task's component was shifted while remaining graded, the cleanup step was bypassed because `task.status === 'graded'` and `task.linkedComponentId` were still truthy.
  - By modifying `syncGradeItem` to always run a cleanup pass filtering out any items with `it.id === task.gradeItemId` across all components first, any stale entries are removed BEFORE the new entry is inserted or updated in the target component.
  - Verified by running the sync bug test script which now outputted:
    ```
    ✅ Component Shift: PASS
    ```

- **Positive Timezone Date Shift Bug Resolution**:
  - Calling `.toISOString()` converts the local midnight Date object to UTC. In timezone offsets ahead of UTC (positive offsets), local midnight shifts back by the offset duration, crossing into the previous UTC day. E.g., `2026-07-20T00:00:00` in GMT+10 becomes `2026-07-19T14:00:00Z` in UTC, resulting in `2026-07-19` when split.
  - To prevent this shift, we replaced `.toISOString().split('T')[0]` with local Date formatting:
    ```typescript
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    ```
  - This ensures that local day, month, and year values are formatted directly without timezone conversions.
  - Verified by running the timezone test script which now outputted PASS for all tested offsets (negative, positive, and UTC).

## 3. Caveats

- No caveats. The changes were scoped precisely to the two specified bugs, preserving logic styles and following the minimal changes principle.

## 4. Conclusion

- The component shifting bug causing duplicate grade ledger entries when shifting tasks has been successfully resolved.
- The timezone-shifting bug in positive timezones has been resolved by formatting the selected date from forms directly into local ISO format.
- All three test suites (`challenge_tests.js`, `sync_bug_test.js`, `timezone_test.js`) compile and pass successfully. 
- TypeScript typecheck and Web bundling compile with zero issues.

## 5. Verification Method

To verify these changes independently, run the following commands from the project root directory:

1. **Basic Challenger Tests**:
   ```bash
   node c:\Projects\FinScholarApp\.agents\challenger_m3\challenge_tests.js
   ```
2. **Component Shifting Grade Sync Test**:
   ```bash
   node c:\Projects\FinScholarApp\.agents\challenger_m3\sync_bug_test.js
   ```
3. **Timezone Safety Test**:
   ```bash
   node c:\Projects\FinScholarApp\.agents\challenger_m3\timezone_test.js
   ```
4. **TypeScript Verification**:
   ```bash
   npx tsc --noEmit
   ```
5. **Expo Bundling Verification**:
   ```bash
   npx expo export --platform web
   ```
