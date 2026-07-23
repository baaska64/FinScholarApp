# Handoff Report: Milestone 4 Review & Adversarial Audit

This handoff contains the quality and adversarial review findings for the Milestone 4 calendar implementation changes in components/calendar/VisualCalendar.tsx, components/calendar/CalendarImportModal.tsx, and app/(tabs)/calendar.tsx.

---

## 1. Observation

### R1: cellWidth Calculation & Responsiveness
- **`components/calendar/VisualCalendar.tsx` (Lines 66-70)**:
  ```typescript
  const screenWidth = Dimensions.get('window').width;
  const padding = 48 + 32; // parent screen horizontal padding (48px) + calendar card's internal padding (32px)
  const gap = 8;
  const cellWidth = (screenWidth - padding - (gap * 6)) / 7;
  ```
- **`components/calendar/VisualCalendar.tsx` (Line 72)**:
  ```typescript
  return (
      <View className={`rounded-3xl p-4 mb-6 shadow-sm border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
  ```
- **`components/calendar/VisualCalendar.tsx` (Line 104)**:
  ```typescript
  <View className="flex-row flex-wrap" style={{ gap: gap }}>
  ```

### R2: Text Truncation & Vertical Layout
- **`components/calendar/VisualCalendar.tsx` (Lines 123-126)**:
  ```typescript
  style={{ 
      width: cellWidth, 
      height: cellWidth * 1.3,
  }}
  ```
- **`components/calendar/VisualCalendar.tsx` (Lines 143-164)**:
  ```typescript
  <View className="flex-1 flex-col px-0.5" style={{ gap: 2, alignContent: 'flex-start' }}>
      {dayEvents.slice(0, 3).map((event, idx) => {
          const typeConfig = activeTypes[event.type as keyof typeof activeTypes] || activeTypes.custom;
          const firstWord = event.title ? event.title.trim().split(/\s+/)[0] : '';
          return (
              <Text 
                  key={idx}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{ color: typeConfig.color }}
                  className="text-[8px] font-nunito-bold"
              >
                  {firstWord}
              </Text>
          );
      })}
      {dayEvents.length > 3 && (
          <Text className={`text-[8px] font-nunito-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              +{dayEvents.length - 3}
          </Text>
      )}
  </View>
  ```

### R3: Day Details Modal, Actions, & Date Serialization
- **`app/(tabs)/calendar.tsx` (Line 120)**:
  ```typescript
  const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 12).toISOString().split('T')[0];
  ```
- **`app/(tabs)/calendar.tsx` (Lines 191-204)**:
  ```typescript
  importedMilestones.forEach(event => {
      const semIndex = event.target_semester_index || 1;
      while (yr.semesters.length < semIndex) {
          yr.semesters.push({ 
              id: generateId(), 
              name: `Semester ${yr.semesters.length + 1}`, 
              subjects: [], 
              milestones: [] 
          });
      }
      const targetSem = yr.semesters[semIndex - 1];
      if (!targetSem.milestones) targetSem.milestones = [];
      targetSem.milestones.push(event);
  });
  ```
- **`app/(tabs)/calendar.tsx` (Lines 525-542)**:
  Pencil button sets form inputs and opens Edit Modal; Trash button triggers `handleDeleteMilestone(m.id, m.yearId, m.semId)`.

### R4: Auth Sync Fallback Parity
- **`app/(tabs)/calendar.tsx` (Lines 67-84)**:
  ```typescript
  const loadData = async () => {
      let loaded = null;
      try {
          const local = await AsyncStorage.getItem('grade_ledger_v2_data');
          if (local) loaded = JSON.parse(local);
      } catch (e) {}

      if (user && !loaded) {
          try {
              const { data: dbData } = await supabase.from('user_ledgers').select('ledger_data').eq('id', user.id).single();
              if (dbData?.ledger_data) {
                  loaded = dbData.ledger_data;
                  await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(loaded));
              }
          } catch (e) {
              console.error("Failed to load from DB in calendar", e);
          }
      }
  ```
- **`app/(tabs)/profile.tsx` (Lines 27-35)**:
  ```typescript
  async function handleLogout() {
      await AsyncStorage.removeItem('grade_ledger_v2_data');
      const { error } = await supabase.auth.signOut();
      ...
  ```

---

## 2. Logic Chain

### R1 Layout and Border Wrapping
1. The functional component renders a card with `className="border"`, which Nativewind compiles to a `borderWidth` of `1px`.
2. This introduces `2px` of total border inset (left and right) on the card.
3. The available inner width for content is `screenWidth - 48 (parent margin) - 32 (card padding) - 2 (card borders) = screenWidth - 82`.
4. However, the calculation for the cells uses `cellWidth = (screenWidth - 80 - 48) / 7`, meaning the total width required by the grid cells and gaps is `cellWidth * 7 + gap * 6 = screenWidth - 80`.
5. Because `screenWidth - 80 > screenWidth - 82`, the cells will exceed the layout boundaries of the inner container by `2px`.
6. Since the container utilizes `flex-row flex-wrap`, the last day cell (Saturday) of each row will wrap to the next line on width-constrained screen sizes, breaking the calendar grid.
7. Additionally, `Dimensions.get('window').width` is evaluated once inside render and does not dynamically update when the screen orientation changes, causing layout failures on rotation.

### R2 Vertical Height Overflow
1. A standard smartphone width of `375px` yields a `cellWidth` of `35.3px` and cell height of `45.9px`.
2. Subtracting `p-1` (4px top/bottom padding) leaves `37.9px` of inner height.
3. The day number row (`text-xs` + `mb-1`) requires at least `16px`, leaving only `21.9px` for events.
4. If a day has 3 events, rendering 3 lines of `text-[8px]` (with a line height of ~10px) plus two `2px` gaps requires `34px`.
5. If 4 events are present (3 events + 1 overflow label), they require `46px`.
6. Since the required heights (`34px` / `46px`) exceed the available height (`21.9px`), text lines will overflow the day cell and overlap with the row below it.

### R3 Scanned Events Missing ID
1. `CalendarImportModal` retrieves scanned events from `ocr-scanner` and passes them directly to `handleImport`.
2. `handleImport` pushes the event objects directly into the semester's milestones array without generating or assigning a unique `id` (e.g. `generateId()`).
3. Consequently, imported events are saved in `AsyncStorage`/Supabase with `id: undefined`.
4. In `calendar.tsx`, the edit and delete actions rely on strict ID match: `m.id === editingMilestone.id` or `m.id !== id`.
5. If multiple imported events exist with `id: undefined`, deleting one event will delete all imported events with undefined IDs, and editing one will corrupt or fail to match the correct record.

### R3 Timezone Shift Bug
1. `new Date(year, month, day, 12).toISOString().split('T')[0]` constructs a local Date at noon (12:00 PM) and serializes it to UTC via `.toISOString()`.
2. For users in timezones with offsets >= +12 (e.g., Samoa UTC+13, New Zealand UTC+13 in DST), local noon corresponds to 11:00 PM the previous day in UTC.
3. For users in timezones with offsets <= -12 (e.g. Baker Island UTC-12), local noon corresponds to 12:00 AM the next day.
4. As a result, dates split from the ISO string will shift by +/- 1 day, causing events to be saved on the incorrect calendar day.

### R4 Database Sync Lockout
1. In `loadData`, if local cache `grade_ledger_v2_data` exists, `loaded` is set to the parsed JSON.
2. The check `if (user && !loaded)` is bypassed since `loaded` is truthy.
3. The remote database is never queried. Any updates made on other devices or directly on the database will never sync to the local device.

### R4 Cross-User Cache Leakage and Data Corruption (INTEGRITY VIOLATION)
1. If a session expires or a login occurs directly without executing `handleLogout` (which is common in OAuth flows or token expiry), the local cache `grade_ledger_v2_data` remains populated with the previous user's data.
2. When the new user logs in, the `user` state updates, but `loadData` finds the cached local data.
3. It bypasses the DB query and displays User A's data to User B.
4. When User B edits any data, `saveAndSync` is executed and upserts User A's local data into User B's row on Supabase, completely corrupting User B's user record.

---

## 3. Caveats

- **No Remote Functions Audited**: The Supabase Edge function `ocr-scanner` code was not audited, as it is remote. We analyzed client-side behavior assuming that it returns structured events but does not guarantee unique client-side `id` strings.
- **Static Evaluation**: Static analysis and compilation check were executed; no emulator-based interactive verification was possible in this workspace context.

---

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

### Critical Findings (INTEGRITY VIOLATION / DATA LOSS RISK)
1. **Cross-User Cache Leakage & Corruption (R4)**: Bypassing the DB check when local cache exists leads to data corruption when switching accounts on the same device.
2. **Missing ID on Imported Milestones (R3/R4)**: Imported events from `CalendarImportModal` lack `id` assignments, breaking subsequent Edit and Delete actions.
3. **Timezone Shift on Serialization (R3)**: Serializing local dates via `.toISOString()` shifts event days for users in specific timezones (e.g. UTC+13).

### Major Findings (LAYOUT & SYNC BUGS)
1. **Visual Calendar Saturday Cell Wrapping (R1)**: The cellWidth formula fails to subtract 2px of card border width, causing grid wrapping on narrow screens.
2. **Dynamic Screen Responsiveness (R1)**: Static `Dimensions.get('window')` fails to resize the calendar when the device rotates.
3. **Cell Event Text Overflow (R2)**: Standard screen widths squeeze cell heights, causing 3-4 lines of event text to overflow day cells and overlap adjacent rows.
4. **Offline Sync Lockout (R4)**: Failed offline saves are never retried or resynced automatically when the app regains network connectivity.

---

## 5. Verification Method

To verify the findings:
1. **R1 cellWidth wrap check**: Inspect the calculation at `components/calendar/VisualCalendar.tsx:69`. Add `borderWidth` explicitly to style props and test layout in portrait vs landscape.
2. **R3 Imported ID check**: Run import in `CalendarImportModal` and inspect local state or AsyncStorage content to observe the lack of an `id` field.
3. **R3 Timezone check**: Set device timezone to UTC+13 or UTC-12 and click a calendar cell. Observe that the returned date string corresponds to the previous/next day.
4. **R4 Sync lock check**: Modify data on the database directly, refresh the calendar tab, and verify that the UI does not update to reflect remote changes because `loaded` blocks the DB call.
5. **Compilation verification**: Run:
   ```bash
   npx tsc --noEmit
   ```
   *Note: While there are compilation errors in other modules, the calendar files compile successfully.*
