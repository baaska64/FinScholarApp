# Handoff Report — Milestone 2 Challenge

## 1. Observation

During our empirical investigation and stress-testing of the Milestone 2 and 3 implementations, we directly observed the following:

1. **Saturday Column Wrapping Math Regression**:
   - In `components/calendar/VisualCalendar.tsx` (lines 66-69):
     ```typescript
     const screenWidth = Dimensions.get('window').width;
     const padding = 48 + 32; // parent screen horizontal padding (48px) + calendar card's internal padding (32px)
     const gap = 8;
     const cellWidth = (screenWidth - padding - (gap * 6)) / 7;
     ```
   - In `components/calendar/VisualCalendar.tsx` (line 72):
     ```typescript
     className={`rounded-[32px] p-5 mb-6 shadow-md border-2 ${isDark ? 'bg-slate-900 border-indigo-500/10 shadow-slate-950' : 'bg-white border-indigo-100/70 shadow-indigo-100/30'}`}
     ```
   - In `app/(tabs)/calendar.tsx` (lines 288-296), the screen parent is wrapped with `px-6` (24px left + 24px right = 48px total padding).
   - In the grid layout (lines 104-108), the container is styled with:
     ```typescript
     <View className="flex-row flex-wrap" style={{ gap: gap }}>
     ```

2. **Timezone Offset Bug in Calendar Rendering and Day Details Modal**:
   - In `components/calendar/VisualCalendar.tsx` (lines 48-57, `getEventsForDay`):
     ```typescript
     const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
     const targetDateString = targetDate.toLocaleDateString();
     
     return events.filter(e => {
         if (!e.date) return false;
         const eventDate = new Date(e.date);
         return eventDate.toLocaleDateString() === targetDateString;
     });
     ```
   - In `app/(tabs)/calendar.tsx` (lines 236-242, `getEventsForDate`):
     ```typescript
     const getEventsForDate = (dateStr: string) => {
         const targetDateString = new Date(dateStr).toLocaleDateString();
         return sortedAllMilestones.filter(m => {
             if (!m.date) return false;
             return new Date(m.date).toLocaleDateString() === targetDateString;
         });
     };
     ```
   - In `app/(tabs)/calendar.tsx` (lines 493-495, Modal date display):
     ```typescript
     <Text className={`font-nunito text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
         {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
     </Text>
     ```

3. **Incomplete Requirements/Tasks Tab**:
   - In `app/(tabs)/requirements.tsx` (lines 10-17):
     ```typescript
     return (
         <SafeAreaView className={`flex-1 justify-center items-center ${isDark ? 'bg-[#0f172a]' : 'bg-[#f8fafc]'}`}>
             <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Requirements Tracker</Text>
             <Text className={`mt-2 text-center px-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                 Requirements tracker is currently under construction.
             </Text>
         </SafeAreaView>
     );
     ```

4. **Navigability, Tab Bar Safe Areas, and Type Safety**:
   - `npx tsc --noEmit` runs and finishes with **0 errors**.
   - `npx expo export --platform web` bundles successfully, creating the `dist` directory with all assets.
   - All 5 tabs wrap content in `SafeAreaView` from `react-native-safe-area-context` and include bottom padding (e.g., `pb-[100px]` or `paddingBottom: 100`) to avoid overlapping the tab bar.

5. **Edge Case Safety**:
   - Zero Academic Years: In `index.tsx`, `academic-manager.tsx`, `calendar.tsx`, `schedule.tsx`, and `grades.tsx`, the application safely shows descriptive empty placeholders rather than throwing undefined crashes.
   - Timetable empty check: In `schedule.tsx` and `TimetableGrid.tsx`, empty classes arrays are handled gracefully using `classes?.length > 0` condition.

---

## 2. Logic Chain

From these observations, we trace the following reasoning:

1. **Saturday Column Wrapping Math Regression**:
   - The actual horizontal padding is `48px` (parent `px-6`) + `40px` (card `p-5` padding, i.e., 20px on each side) + `4px` (card `border-2`, i.e., 2px on each side) = `92px`.
   - However, the `cellWidth` math in `VisualCalendar.tsx` assumes a hardcoded padding of `48 + 32 = 80px`.
   - As a result, the calculated space required for 7 days + 6 gaps is `screenWidth - 80px`.
   - Since `screenWidth - 80px` exceeds the actual container width `screenWidth - 92px` by exactly `12px`, the 7th column (Saturday) cannot fit on the first row and wraps to the next line. This breaks the grid layout on all mobile devices.

2. **Timezone Offset Bug in Calendar and Day Details Modal**:
   - Dates in the format `"YYYY-MM-DD"` (e.g., `"2026-07-17"`) are parsed by `new Date("YYYY-MM-DD")` as UTC midnight.
   - However, dates constructed via numbers (e.g., `new Date(year, month, day)`) are parsed in the device's local timezone.
   - In timezone offsets that are negative (e.g., GMT-0500 New York), `new Date("2026-07-17")` represents July 16 at 19:00:00 local time. Therefore, `toLocaleDateString()` returns `"7/16/2026"`.
   - Conversely, local midnight constructed via `new Date(2026, 6, 17)` returns `"7/17/2026"`.
   - Since `"7/16/2026"` !== `"7/17/2026"`, calendar events stored in the database for July 17 will NOT show up in the calendar grid cell for Day 17.
   - Furthermore, clicking on Day 17 passes `"2026-07-17"` to the Day Details modal. When parsed, the header will show "Thursday, July 16, 2026" instead of "Friday, July 17, 2026".

3. **Incomplete Requirements Tracker**:
   - Though the requirements state that the "Tasks/Requirements" feature must be ported from the web application utilizing the existing Supabase schemas, the screen `requirements.tsx` only contains placeholder "under construction" text.

---

## 3. Caveats

- We did not mock native device touch events or pan gestures directly in an emulator; our analysis of the draggable class schedule block is based on inspection of `TimetableGrid.tsx`.
- The Supabase database tables sync parity was verified statically via the schema models in the code but not against a live staging server.

---

## 4. Conclusion

- **Calendar Grid Saturday wrapping is NOT preserved and is broken** on all device widths due to the hardcoded `padding = 80` math regression mismatching the `p-5` (40px) + `border-2` (4px) styling on the calendar container card.
- **Interceptive Day Details modal works correctly** and opens the Add Event modal with a pre-filled date when clicking the "Add New Event" button. *However*, a critical timezone bug shifts dates and renders events on the wrong day in negative timezones.
- **Tabs navigability and safe areas are correctly implemented** using `SafeAreaView` and bottom padding.
- **Requirements/Tasks screen is not implemented** (is a placeholder page).
- **Edge cases are robustly handled** with safe guards on empty academic terms, zero-semester conditions, and empty timetables.

---

## Challenge Report / Adversarial Review

**Overall risk assessment**: HIGH

### Challenges

#### [High] Challenge 1: Saturday Column Wrapping Regression
- **Assumption challenged**: The layout grid assumed container padding of `80px` (48px screen + 32px card padding).
- **Attack scenario**: A user with any phone width opens the calendar tab. Because the container is `p-5` with `border-2` (actual padding = 92px), the 7th column (Saturday) wraps to the next row, producing a visually broken calendar grid.
- **Blast radius**: Visually broken UI for all users.
- **Mitigation**: Update `padding` variable in `VisualCalendar.tsx` to `48 + 40 + 4` (or `92`) to match the container's actual classes (`p-5`, `border-2` and parent `px-6`).

#### [Critical] Challenge 2: Timezone Shift Bug on Negative Offset Devices
- **Assumption challenged**: Comparing `.toLocaleDateString()` from local midnight (numerical construction) and UTC midnight (string parsing) assumes the system is in a positive or zero timezone offset.
- **Attack scenario**: A user in North America (negative offset) adds an event for July 17. The calendar grid fails to show the event label on Day 17. Clicking Day 17 opens a details modal displaying "Thursday, July 16, 2026".
- **Blast radius**: Misleading event dates and missing calendar items for users in negative timezones.
- **Mitigation**: Normalize dates using ISO strings (`YYYY-MM-DD`) directly without using `toLocaleDateString()` or instantiating intermediate local timezone `Date` objects.

#### [Medium] Challenge 3: Missing Tasks/Requirements Feature
- **Assumption challenged**: The web-to-mobile port of Tasks/Requirements was assumed to be complete.
- **Attack scenario**: The user opens the Tasks tab and is presented with a static placeholder text saying "Requirements tracker is currently under construction."
- **Blast radius**: Incomplete product feature.
- **Mitigation**: Implement the UI and integrate the Supabase endpoints for the Tasks/Requirements table.

---

## 5. Verification Method

To verify these findings:

1. **Verify saturday wrapping regression mathematically**:
   - Run a node calculation: `node -e "const w=390; const cellWidth=(w-80-48)/7; console.log((cellWidth*7)+48 > w-92)"`. If `true` is outputted, Saturday will wrap since the grid width exceeds the available container width.
2. **Verify timezone date shifting**:
   - Run a node command with `TZ=America/New_York` to simulate negative timezone offset:
     `node -e "console.log(new Date('2026-07-17').toLocaleDateString())"`
     Observe that it prints `"7/16/2026"`, demonstrating that YYYY-MM-DD parses as UTC and shifts back by one day in America/New_York.
3. **Verify type safety and web bundling**:
   - Run `npx tsc --noEmit` (Should output nothing / complete successfully).
   - Run `npx expo export --platform web` (Should finish successfully and generate a `dist` folder).
