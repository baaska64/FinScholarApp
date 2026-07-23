# Handoff Report — Milestone 3 Implementation Challenges

## 1. Observation

- **TypeScript compilation check**: Command `npx tsc --noEmit` completed successfully with zero stdout/stderr output (passed compilation).
- **Web bundling check**: Command `npx expo export --platform web` completed successfully in 2168ms.
- **Calendar cellWidth padding**: In `components/calendar/VisualCalendar.tsx` at line 69:
  ```typescript
  const padding = 48 + 40 + 4;
  const gap = 8;
  const cellWidth = (screenWidth - padding - (gap * 6)) / 7;
  ```
- **Calendar Day Details header formatting**: In `app/(tabs)/calendar.tsx` at lines 498-506:
  ```typescript
                                      {selectedDateStr ? (() => {
                                          const parts = selectedDateStr.split('-');
                                          if (parts.length === 3) {
                                              const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                                              return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                          }
                                          return '';
                                      })() : ''}
  ```
- **Mascot state representation**: In `app/(tabs)/requirements.tsx` at lines 558-564:
  ```typescript
                          Image 
                              source={
                                  isRunning 
                                      ? require('../../assets/images/studying.png') 
                                      : (timeLeft === 0 
                                          ? require('../../assets/images/happy.png') 
                                          : require('../../assets/images/sleeping.png')
                                        )
                              }
  ```
- **Grade item sync logic**: In `app/(tabs)/requirements.tsx` at lines 203-244:
  ```typescript
      const syncGradeItem = (subject: any, task: any) => {
          // First, if task has an old gradeItemId but is no longer graded or no longer linked, remove it
          if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId)) {
              subject.periods.forEach((p: any) => {
                  p.components.forEach((c: any) => {
                      c.items = c.items.filter((it: any) => it.id !== task.gradeItemId);
                  });
              });
              task.gradeItemId = undefined;
          }
  ```
- **Timezone Date conversion**: In `app/(tabs)/calendar.tsx` at line 142 and `app/(tabs)/requirements.tsx` at line 259:
  ```typescript
  const dateStr = form.date.toISOString().split('T')[0];
  ```
- **Positive Timezone offset execution result**: Under `Australia/Melbourne` (GMT+10), running `timezone_test.js` produced:
  ```
  --- Testing Timezone: Australia/Melbourne ---
  Current process timezone: Australia/Melbourne
  Selected Date (local): Mon Jul 20 2026 00:00:00 GMT+1000 (Australian Eastern Standard Time)
  Selected Date (ISO): 2026-07-19T14:00:00.000Z
  Saved Date String: 2026-07-19
  Result: FAIL (Expected 2026-07-20, got 2026-07-19)
  ```
- **Component Shifting sync execution result**: Running `sync_bug_test.js` produced:
  ```
  After shifting component:
  Comp1 items count: 1
  Comp2 items count: 1
  Comp1 has grade item: true
  Comp2 has grade item: true
  ❌ Component Shift: FAIL
  Stale item was NOT removed from comp1!
  ```

## 2. Logic Chain

- **Saturday Grid Wrapping**:
  - The padding calculation `const padding = 48 + 40 + 4;` yields `92px`. 
  - The outer scrollview padding is `px-6` (`48px` total for left/right). The visual calendar card itself has padding `p-5` (`40px` total for left/right) and `border-2` (`4px` total for left/right).
  - This perfectly accounts for all non-grid space.
  - As verified by `challenge_tests.js`, `(cellWidth * 7) + (gap * 6)` matches the available container width exactly, preventing grid cell wrapping across different screen resolutions.
- **Negative Timezone Offsets & Date Parsing**:
  - For negative timezone offsets (e.g. `America/New_York`), a local midnight Date object when converted to UTC remains on the same calendar day (e.g. `2026-07-20T00:00:00-04:00` = `2026-07-20T04:00:00.000Z`).
  - Thus, `.toISOString().split('T')[0]` preserves the date on the correct day for negative timezones.
  - In `calendar.tsx`'s Day Details header, date string `selectedDateStr` (e.g. `"2026-07-20"`) is parsed using `new Date(year, month, day)` which yields local midnight. Formatted with `.toLocaleDateString`, this correctly outputs the day header independent of UTC conversions.
- **Tasks CRUD & Filter Chips**:
  - `challenge_tests.js` verified that adding, updating, and deleting tasks correctly updates the local semester state.
  - Subject filtering correctly isolates tasks belonging to the active subject ID or returns all tasks when `ALL` is selected.
- **Pomodoro Timer & Mascot transitions**:
  - `challenge_tests.js` verified that `formatTime` returns proper `MM:SS` padded strings.
  - Image state changes accurately transition between `studying.png` (running), `sleeping.png` (idle/paused), and `happy.png` (completed session).
- **Grade Ledger sync bug**:
  - The `syncGradeItem` function only filters out items with the matching `task.gradeItemId` if the task is no longer graded or no longer linked (`task.status !== 'graded' || !task.linkedComponentId`).
  - If a task is shifted to a different grading component within the same subject (e.g., from `comp1` to `comp2`), `task.status` is still `'graded'` and `task.linkedComponentId` is still truthy.
  - Thus, the first cleanup check is skipped, leaving the stale grade item inside the original component (`comp1.items`).
  - The insertion logic runs on the new component (`comp2`), creating a duplicate grade item. This is verified by `sync_bug_test.js`.
- **Positive Timezone offsets date shift bug**:
  - When in a timezone ahead of UTC (e.g. `Australia/Melbourne` UTC+10), local midnight (e.g. `2026-07-20T00:00:00.000`) converts to UTC on the *previous* calendar day (e.g. `2026-07-19T14:00:00.000Z`).
  - Using `.toISOString().split('T')[0]` results in `"2026-07-19"` instead of `"2026-07-20"`, shifting the event/task due date one day backward. This is verified by `timezone_test.js`.

## 3. Caveats

- Testing of timezone offset shifts was performed programmatically in Node.js environment by altering `process.env.TZ`.
- The Pomodoro timer relies on a React Native `setInterval` loop. If the OS suspends JavaScript execution when the app moves to the background, the timer countdown will halt. This was not tested via automation, but is a known platform limitation.

## 4. Conclusion

The Milestone 3 implementation satisfies the basic validation conditions under negative timezone offsets, calendar grid alignment, tasks CRUD operations, and Pomodoro timer mascot transitions. However, two critical logic bugs were uncovered:
1. **Auto-grading duplicate items**: Changing the linked grading component of a task within the same subject duplicates the grade item and leaves an orphaned item in the old component.
2. **Positive timezone date shifts**: Users in positive timezones (e.g. GMT+1 to GMT+14) will experience date picker offsets shifting event dates to the previous day due to UTC conversions.

**Suggested Mitigations:**
1. In `syncGradeItem`, always run a full cleanup pass to remove `task.gradeItemId` from ALL periods/components of the subject before inserting/updating it in the target component.
2. Replace all instances of `date.toISOString().split('T')[0]` with local formatting, such as:
   ```typescript
   const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
   ```

## 5. Verification Method

- To run the test suite verifying all basic operations:
  ```powershell
  node c:\Projects\FinScholarApp\.agents\challenger_m3\challenge_tests.js
  ```
- To run the test suite demonstrating the component-shifting sync duplication bug:
  ```powershell
  node c:\Projects\FinScholarApp\.agents\challenger_m3\sync_bug_test.js
  ```
- To run the timezone date shift bug test under positive timezones:
  ```powershell
  node c:\Projects\FinScholarApp\.agents\challenger_m3\timezone_test.js
  ```
