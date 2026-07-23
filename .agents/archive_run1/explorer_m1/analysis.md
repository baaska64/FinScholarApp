# Implementation Plan: FinScholarApp Calendar Enhancements

This document outlines the detailed implementation plan for the calendar layout, day details modal, and syncing improvements required for Milestone 2 and Milestone 3.

---

## M2: Grid Layout & Cell Content (Milestone 2)

### R1: Fix `cellWidth` Calculation in `VisualCalendar.tsx`
* **Observation**:
  - The calendar is placed inside a container with `px-6` (`48px` horizontal padding).
  - The `VisualCalendar` card wrapper uses `p-4` (`32px` horizontal padding).
  - The current `cellWidth` calculation is `(screenWidth - padding - (gap * 6)) / 7`, where `padding = 24 * 2` (`48px`). It fails to account for the card's internal padding of `32px`.
  - This results in cell widths that are too wide for the container, causing layout wrapping glitches (the last day of the week wraps onto a new row).
* **Proposed Diff Patch**:
  ```diff
  <<<<
      const screenWidth = Dimensions.get('window').width;
      const padding = 24 * 2; // px-6 is 24px on each side
      const gap = 8;
      const cellWidth = (screenWidth - padding - (gap * 6)) / 7;
  ====
      const screenWidth = Dimensions.get('window').width;
      const parentPadding = 24 * 2; // px-6 is 24px on each side (48px total)
      const componentPadding = 16 * 2; // p-4 is 16px on each side (32px total)
      const padding = parentPadding + componentPadding; // 80px total padding
      const gap = 8;
      const cellWidth = (screenWidth - padding - (gap * 6)) / 7;
  >>>>
  ```

### R2: Replace Day Cell Dots with 1-Word Truncated Event Titles in `VisualCalendar.tsx`
* **Observation**:
  - Events are currently drawn as circular indicator dots inside the grid cells.
  - The cells have small heights and widths (approx. `35-40px`), which means text must be small and truncated to avoid overlapping.
* **Proposed Change**:
  - Extract the first word of the event title (`event.title.split(' ')[0]`).
  - Render up to 3 events vertically.
  - Set the font size to `8px` (`text-[8px]`), styling it with the category color from `activeTypes`.
  - Display `+N` for remaining events if count > 3.
* **Proposed Diff Patch**:
  ```diff
  <<<<
                              <View className="flex-1 flex-row flex-wrap px-0.5" style={{ gap: 2, alignContent: 'flex-start' }}>
                                  {dayEvents.slice(0, 4).map((event, idx) => {
                                      const typeConfig = activeTypes[event.type as keyof typeof activeTypes] || activeTypes.custom;
                                      return (
                                          <View 
                                              key={idx}
                                              style={{ backgroundColor: typeConfig.color }}
                                              className="w-1.5 h-1.5 rounded-full"
                                          />
                                      );
                                  })}
                                  {dayEvents.length > 4 && (
                                      <Text className={`text-[8px] font-nunito-bold ml-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                          +{dayEvents.length - 4}
                                      </Text>
                                  )}
                              </View>
  ====
                              <View className="flex-1 flex-col px-0.5" style={{ gap: 2, alignContent: 'flex-start' }}>
                                  {dayEvents.slice(0, 3).map((event, idx) => {
                                      const typeConfig = activeTypes[event.type as keyof typeof activeTypes] || activeTypes.custom;
                                      const firstWord = event.title ? event.title.split(' ')[0] : '';
                                      return (
                                          <Text 
                                              key={idx}
                                              numberOfLines={1}
                                              ellipsizeMode="tail"
                                              style={{ color: typeConfig.color, fontSize: 8 }}
                                              className="font-nunito-bold text-[8px]"
                                          >
                                              {firstWord}
                                          </Text>
                                      );
                                  })}
                                  {dayEvents.length > 3 && (
                                      <Text className={`text-[8px] font-nunito-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                          +{dayEvents.length - 3}
                                      </Text>
                                  )}
                              </View>
  >>>>
  ```

---

## M3: Day Details Modal & Sync Parity (Milestone 3)

### R3: Day Details Bottom-Sheet Modal in `app/(tabs)/calendar.tsx`
* **Observation**:
  - `onDateClick` currently triggers the `showAddModal` directly.
  - Instead, we must introduce a bottom-sheet styled interceptor modal to show the list of events for the pressed day, with the option to launch the add modal from there.
* **Proposed Implementation**:
  1. Add states:
     ```typescript
     const [showDetailsModal, setShowDetailsModal] = useState(false);
     const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
     const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
     ```
  2. Implement interceptor logic in `VisualCalendar.onDateClick`:
     ```typescript
     onDateClick={(dateStr) => {
         const dateEvents = sortedAllMilestones.filter((m: any) => m.date === dateStr);
         setSelectedDateStr(dateStr);
         setSelectedDayEvents(dateEvents);
         setShowDetailsModal(true);
     }}
     ```
  3. Render Day Details Modal in `app/(tabs)/calendar.tsx` (placed right below the `Add/Edit Modal`):
     ```typescript
     {/* Day Details Modal */}
     <Modal visible={showDetailsModal} transparent animationType="slide">
         <View className="flex-1 justify-end bg-black/60">
             <View className={`rounded-t-3xl p-6 h-[50%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                 <View className="flex-row justify-between items-center mb-4">
                     <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>
                         Events for {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
                     </Text>
                     <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                         <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                     </TouchableOpacity>
                 </View>
                 
                 <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
                     {selectedDayEvents.length === 0 ? (
                         <View className="py-8 items-center justify-center">
                             <Text className={`font-nunito ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No events scheduled for this day.</Text>
                         </View>
                     ) : (
                         selectedDayEvents.map((m: any) => {
                             const typeConfig = activeTypes[m.type as keyof typeof activeTypes] || activeTypes.custom;
                             return (
                                 <View key={m.id} className={`p-4 rounded-2xl mb-3 border flex-row justify-between items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                     <View className="flex-1 mr-4">
                                         <Text className={`font-nunito-bold text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.title}</Text>
                                         <View className="flex-row items-center mt-1">
                                             <View style={{ backgroundColor: typeConfig.bg, borderColor: `${typeConfig.color}40`, borderWidth: 1 }} className="px-2 py-0.5 rounded-md mr-2">
                                                 <Text style={{ color: typeConfig.color }} className="font-nunito-bold text-[10px]">{typeConfig.label}</Text>
                                             </View>
                                             {m.note && <Text className={`font-nunito text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>{m.note}</Text>}
                                         </View>
                                     </View>
                                     <View className="flex-row space-x-3">
                                         <TouchableOpacity onPress={() => {
                                             setShowDetailsModal(false);
                                             setForm({ title: m.title, date: new Date(m.date), type: m.type, note: m.note || '' });
                                             setEditingMilestone(m);
                                             setShowAddModal(true);
                                         }}>
                                             <Ionicons name="pencil" size={16} color={isDark ? '#cbd5e1' : '#64748b'} />
                                         </TouchableOpacity>
                                         <TouchableOpacity onPress={() => {
                                             handleDeleteMilestone(m.id);
                                             // Update modal internal list if item is deleted
                                             setSelectedDayEvents(prev => prev.filter((item: any) => item.id !== m.id));
                                         }}>
                                             <Ionicons name="trash" size={16} color="#ef4444" />
                                         </TouchableOpacity>
                                     </View>
                                 </View>
                             );
                         })
                     )}
                 </ScrollView>
 
                 <TouchableOpacity 
                     onPress={() => {
                         setShowDetailsModal(false);
                         setForm({ title: '', date: selectedDateStr ? new Date(selectedDateStr) : new Date(), type: 'custom', note: '' });
                         setEditingMilestone(null);
                         setShowAddModal(true);
                     }}
                     className="w-full py-4 bg-indigo-500 rounded-2xl items-center"
                 >
                     <Text className="font-nunito-black text-white text-lg">Add New Event</Text>
                 </TouchableOpacity>
             </View>
         </View>
     </Modal>
     ```

### R4: Ensure Data Sync Parity in `app/(tabs)/calendar.tsx`
* **Observation**:
  - The calendar tab does not monitor auth session changes on mount via `onAuthStateChange`.
  - It does not attempt to load data from Supabase's `user_ledgers` table when local storage is empty, creating sync parity gaps with the Dashboard, Schedule, and Grades pages.
* **Proposed Implementation**:
  1. Add a mounting `useEffect` to listen to authentication session changes:
     ```typescript
     useEffect(() => {
         supabase.auth.getSession().then(({ data: { session } }) => {
             setUser(session?.user ?? null);
         });
         const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
             setUser(session?.user ?? null);
         });
         return () => subscription.unsubscribe();
     }, []);
     ```
  2. Modify `useFocusEffect` callback dependencies to `[user]` and change `loadData` to fetch from the DB if local storage is missing:
     ```typescript
     useFocusEffect(
         useCallback(() => {
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
                         console.error("Failed to load calendar data from Supabase:", e);
                     }
                 }
 
                 if (!loaded) loaded = { settings: {}, years: [] };
 
                 // Ensure milestones arrays exist
                 loaded.years.forEach((y: any) => y.semesters.forEach((s: any) => {
                     if (!s.milestones) s.milestones = [];
                 }));
 
                 setData(loaded);
                 // ... rest of loading active year and semester keys ...
             };
             loadData();
         }, [user])
     );
     ```

---

## Additional Cleanup: Fix TypeScript Warning in `CalendarImportModal.tsx`
* **Warning**:
  - `CalendarImportModal.tsx(26,51): error TS2345: Argument of type 'string | null | undefined' is not assignable to parameter of type 'string | undefined'.`
* **Fix**:
  - Change line 26 from:
    ```typescript
    processFile(result.assets[0].uri, result.assets[0].base64);
    ```
    to:
    ```typescript
    processFile(result.assets[0].uri, result.assets[0].base64 ?? undefined);
    ```

---

## Verification Plan
1. **Compilation Check**: Run `npx tsc --noEmit` and verify that no errors exist in `components/calendar/` or `app/(tabs)/calendar.tsx`.
2. **Visual Inspection**: Start the Expo development server, open the calendar tab, and verify that:
   - The grid cells display correctly without wrapping layout breaks.
   - Day cells show truncated 1-word text lines of events instead of dots.
   - Pressing a day cell successfully opens the bottom-sheet detail modal showing day events.
   - Adding/editing/deleting a milestone works seamlessly through the bottom-sheet flow.
   - Test offline database sync and local cache preservation when reloading app.
