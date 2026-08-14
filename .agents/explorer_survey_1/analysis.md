# Schedule Tab Pre-Redesign Feature Audit & Technical Analysis

**Target File**: `c:/Projects/FinScholarApp/app/(tabs)/schedule.tsx`  
**Related Components**:
- `c:/Projects/FinScholarApp/components/schedule/TimetableGrid.tsx`
- `c:/Projects/FinScholarApp/components/schedule/ScheduleListView.tsx`
- `c:/Projects/FinScholarApp/components/schedule/AttendanceTracker.tsx`
- `c:/Projects/FinScholarApp/components/schedule/ScheduleScannerModal.tsx`
- `c:/Projects/FinScholarApp/components/schedule/ClassModals.tsx` (`ClassDetailsModal`, `ClassEditModal`)
- `c:/Projects/FinScholarApp/components/ledger/Tabs.tsx`
- `c:/Projects/FinScholarApp/utils/subjectRegistry.ts`
- `c:/Projects/FinScholarApp/services/SyncService.ts`
- `c:/Projects/FinScholarApp/components/PremiumPaywallModal.tsx`
- `c:/Projects/FinScholarApp/components/DevMenuModal.tsx`
- `c:/Projects/FinScholarApp/components/CustomAlert.tsx` (`AlertService`)

---

## 1. Executive Summary & Architecture Overview

The Schedule tab is a core feature of FinScholar that allows students to view, create, edit, scan, and manage their academic schedule across three distinct view modes: **Grid View** (interactive timetable grid with quick edit mode), **Glass View** (styled weekly schedule list preview), and **Attendance View** (session logger with stats and takeaways).

### Data Flow & Storage
1. **Primary Persistence**: Local data is stored in `AsyncStorage` under the key `grade_ledger_v2_data`.
2. **Global Academic Term Context**: `SemesterContext` manages `selectedYear` and `selectedSemester`.
3. **Cloud Sync**: `SyncService.subscribeDataChange` & `SyncService.subscribe` handle real-time sync status (`offline`, `syncing`, `saved`). Changes pushed via `SyncService.pushLocalChanges(newData)`.
4. **Global Subject Registry**: `subjectRegistry.ts` coordinates subjects between Schedule, Grade Ledger, and Tasks. Creating/editing classes links `subjectId` and sets `hasSchedule = true`.
5. **AI Schedule OCR Scanner**: Uses Supabase Edge Function `parse-schedule` with Base64 image payload. Requires user authentication and Pro/Premium status (`SyncService.getIsPremium()`).

---

## 2. Pre-Redesign Feature Checklist

| Feature ID | Feature Name | Location / Component | State / Props Used | User Interactions & Behaviors | Expected Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SCH-HDR-01** | Header Title & Date | `schedule.tsx:588-609` | `theme`, `isDark` | View static text header. | Displays icon, "My Schedule", and formatted current date (e.g. "Sunday, August 9, 2026"). |
| **SCH-HDR-02** | Cloud Sync Status Indicator | `schedule.tsx:612-614` | `syncStatus` (`'offline'`, `'syncing'`, `'saved'`) | Automatic icon updates on data sync change. | Shows `cloud-upload` (syncing), `cloud-done` (green/saved), or `cloud-offline` (offline). |
| **SCH-HDR-03** | Settings Navigation Button | `schedule.tsx:616-621` | `isDark`, `theme`, `router` | Tap settings icon button. | Navigates to `/(tabs)/profile`. |
| **SCH-VIE-01** | View Mode Switcher Segmented Control | `schedule.tsx:626-661` | `viewMode` (`'grid'`, `'list'`, `'attendance'`), `params.viewMode` | Tap "Grid", "Glass", or "Attendance" tab buttons. | Switches active view mode seamlessly; retains parameters if opened via router params. |
| **SCH-TRM-01** | Year & Semester Selector Dropdown Button | `Tabs.tsx`, `schedule.tsx:667-678` | `years`, `activeYearId`, `activeSemId`, `selectedYear`, `selectedSemester` | Tap term selector pill button. | Opens full-screen bottom modal listing all academic years and semesters. |
| **SCH-TRM-02** | Term Selector Modal & Selection | `Tabs.tsx:130-245` | `modalVisible`, `setYearAndSemester` | Tap a semester in modal; tap close button or backdrop. | Updates active year/semester globally across app, closes modal, refreshes schedule view. |
| **SCH-TRM-03** | Term Selector Empty State & Manager Button | `Tabs.tsx:164-186` | `years.length === 0` | Tap "Setup Academic Term" button in modal. | Navigates to `/(tabs)/academic-manager`. |
| **SCH-ACT-01** | AI Scan Image Action Button | `schedule.tsx:702-718` | `SyncService.getIsPremium()`, `showScanner`, `showPaywall` | Tap "Scan Image" purple action button. | Opens `ScheduleScannerModal` if Pro user; opens `PremiumPaywallModal` if non-Pro user. |
| **SCH-ACT-02** | Manual Add Class Action Button | `schedule.tsx:719-729` | `showEditModal`, `setEditingClass(null)` | Tap "Add Class" outline action button. | Opens `ClassEditModal` with clean blank inputs. |
| **SCH-EMP-01** | No Academic Term Configured Empty State | `schedule.tsx:681-693` | `data?.years?.length === 0` | Tap "Setup Academic Term" button. | Displays empty calendar icon, notice text, and button to navigate to `/(tabs)/academic-manager`. |
| **SCH-EMP-02** | No Semester Selected Empty State | `schedule.tsx:694-696` | `currentYear && !currentSem` | View notification prompt. | Displays empty calendar icon and instruction to select a semester above. |
| **SCH-EMP-03** | "Fin is Confused" No Classes Banner | `schedule.tsx:731-741` | `currentSem.classes.length === 0` | View banner notice. | Displays confused Fin mascot graphic with prompt to scan image or add classes manually. |
| **SCH-UNS-01** | Unscheduled Subjects Alert Banner | `schedule.tsx:743-763`, `getUnscheduledSubjects` | `currentSem.subjects`, `router` | Tap banner with list of unscheduled subjects. | Navigates to `/(tabs)/grades` to manage grade ledger. |
| **SCH-UPC-01** | Upcoming Milestones / Requirements Carousel Strip | `schedule.tsx:765-787` | `upcomingMilestones`, `parseLocalDate` | Horizontal scroll of requirement & milestone pills. | Displays title and remaining days badge ("Today", "Tomorrow", "X days") sorted by date. |
| **SCH-STR-01** | Today's Classes Horizontal Strip | `schedule.tsx:790-817` | `currentSemClasses`, current day index (0=Mon...6=Sun) | Horizontal scroll of today's class chips. | Shows subject name & start time pill for today's classes, or "No classes today 🎉" if empty. |
| **SCH-NXT-01** | Next / Ongoing Class Dynamic Strip | `schedule.tsx:819-831` | `nextClassInfo`, `nextClassWaitStr`, `isOngoing` | View dynamic status banner. | Displays "Ongoing" (green badge + class name) OR "Next" (yellow badge + class name + countdown string e.g. "2 hrs 15 min"). |
| **SCH-QKE-01** | Toggle Quick Edit Mode Button | `schedule.tsx:834-845` | `isQuickEditMode`, `viewMode === 'grid'` | Tap "Quick Edit Schedule" / "Exit Quick Edit Mode" button. | Toggles bulk editing control bar at bottom of Timetable Grid. |
| **SCH-GRD-01** | Timetable Grid Display | `TimetableGrid.tsx`, `schedule.tsx:859-869` | `currentSem.classes`, `isDark`, `isQuickEditMode` | Vertical & horizontal scroll grid; tap class block. | Renders multi-column timetable grid with color-coded blocks, overlapping support, room, and teacher text. |
| **SCH-GRD-02** | Quick Edit Select Block Gesture | `TimetableGrid.tsx:140-169` | `selectedClassIds`, `isQuickEditMode` | Tap class block while in Quick Edit mode. | Toggles checkmark selection on block and updates selected count in bottom bar. |
| **SCH-GRD-03** | Quick Edit Bulk Select/Deselect All | `TimetableGrid.tsx:441-501` | `selectedClassIds`, `classes.length` | Tap "Select All" / "Deselect All" button. | Selects or deselects all class blocks in current semester. |
| **SCH-GRD-04** | Quick Edit Bulk Shift Day | `TimetableGrid.tsx:505-509` | `selectedClassIds`, `onUpdateClasses` | Tap Day left/right arrow buttons. | Moves selected class blocks to previous/next day. |
| **SCH-GRD-05** | Quick Edit Bulk Shift Time | `TimetableGrid.tsx:513-517` | `selectedClassIds`, `onUpdateClasses` | Tap Time up/down arrow buttons. | Shifts start time of selected class blocks by ±5 minutes. |
| **SCH-GRD-06** | Quick Edit Bulk Duration Adjustment | `TimetableGrid.tsx:521-525` | `selectedClassIds`, `onUpdateClasses` | Tap Dur +/- buttons. | Adjusts duration of selected class blocks by ±5 minutes. |
| **SCH-GRD-07** | Quick Edit Bulk Delete | `TimetableGrid.tsx:527-545` | `selectedClassIds`, `onDeleteClasses` | Tap trash icon in Quick Edit bar; confirm in alert. | Deletes selected class blocks and auto-cleans orphaned subjects if empty. |
| **SCH-LST-01** | Weekly Schedule Glass List View | `ScheduleListView.tsx`, `schedule.tsx:970-976` | `currentSem.classes`, `currentSem`, `currentYear` | View scaled weekly schedule graphic card. | Displays 1080x1920 scaled card with day pills, 2-column class cards, room badges, and studying Fin watermark. |
| **SCH-ATT-01** | Attendance Tracker Overview & Stats | `AttendanceTracker.tsx`, `schedule.tsx:979-986` | `data`, `activeYearId`, `activeSemId`, `attendanceLog` | View attendance percentage stat boxes & Fin feedback message. | Displays Past 7 Days, Past 30 Days, Overall Semester attended vs total hours with color progress bars. |
| **SCH-ATT-02** | Attendance Class Checklist Weeks List | `AttendanceTracker.tsx:340-437` | `groupedWeeks`, `sortedWeeksArray` | Tap active or completed week card. | Shows week range, session count, present/absent/unlogged counts; opens Week Details Modal. |
| **SCH-ATT-03** | Attendance Week Details Day Picker | `AttendanceTracker.tsx:442-524` | `expandedWeek`, `selectedDayDateStr` | Horizontal scroll of day pills; tap day pill. | Highlights selected day, shows session status dots, and lists class sessions for that day. |
| **SCH-ATT-04** | Attendance Log Status Toggle (Present/Absent/No Class) | `AttendanceTracker.tsx:271-308, 542-557` | `attendanceLog`, `handleUpdateStatus` | Tap "Present", "Absent", or "No Class" button on session card. | Toggles session attendance status, saves to `AsyncStorage`, pushes to SyncService, updates stats. |
| **SCH-ATT-05** | Attendance Session Takeaway Note Input | `AttendanceTracker.tsx:558-598` | `editingTakeaway`, `takeawayInputs` | Tap takeaway button; enter text; tap checkmark. | Saves custom notes/takeaways for class session in `attendanceLog`. |
| **SCH-EXP-01** | Export Schedule as Image Button | `schedule.tsx:849-857, 959-967` | `viewShotRef`, `viewShotDarkRef`, `viewShotListRef` | Tap "Export as Image" button. | Captures high-res off-screen ViewShot image and opens preview modal. |
| **SCH-EXP-02** | Export Preview Modal & Theme Toggle | `schedule.tsx:1073-1120` | `showPreviewModal`, `exportDark`, `previewUri` | Toggle Light/Dark preview mode button. | Re-captures schedule graphic in chosen theme and displays preview image. |
| **SCH-EXP-03** | Save Export Image to Photo Gallery | `schedule.tsx:121-135, 1112-1117` | `MediaLibrary`, `previewUri` | Tap "Save" button in preview modal. | Requests media library permission and saves schedule image to device gallery. |
| **SCH-SCN-01** | AI Schedule Scanner Modal Image Picker | `ScheduleScannerModal.tsx:27-47` | `ImagePicker`, `selectedImage` | Tap "Select Image from Gallery" box. | Launches system image picker to select schedule image (base64 encoded). |
| **SCH-SCN-02** | AI Schedule Scanner Custom Instructions Input | `ScheduleScannerModal.tsx:137-147` | `customInstructions` | Enter optional instructions text. | Passes instructions to OCR parse request (e.g. "Use course codes as subject names"). |
| **SCH-SCN-03** | AI Schedule Scanner OCR Process ("Scan Now") | `ScheduleScannerModal.tsx:49-92` | `supabase.functions.invoke('parse-schedule')` | Tap "Scan Now" button. | Calls Supabase function, parses time slots/days/rooms/instructors, creates classes & subjects, opens AI warning modal. |
| **SCH-DET-01** | Class Details Modal View | `ClassModals.tsx:25-75` | `selectedClass`, `showEditModal` | Tap class block in Timetable Grid (outside Quick Edit mode). | Displays popup with subject name, color badge, day, time, room, instructor, and action buttons. |
| **SCH-DET-02** | Class Details Delete Action | `ClassModals.tsx:63-66`, `schedule.tsx:365-392` | `handleDeleteClasses` | Tap "Remove" button in details modal; confirm alert. | Deletes class block, updates subject registry `hasSchedule`, auto-deletes empty subjects. |
| **SCH-DET-03** | Class Details Edit Action | `ClassModals.tsx:67-69`, `schedule.tsx:1021-1032` | `setEditingClass` | Tap "Edit" button in details modal. | Closes details modal and opens `ClassEditModal` pre-filled with class and schedule blocks. |
| **SCH-EDT-01** | Class Edit Modal Inputs & Color Picker | `ClassModals.tsx:94-161` | `editingClass`, `colorIdx` | Edit Name, Instructor, or tap color circle. | Updates modal state with new class info and color index. |
| **SCH-EDT-02** | Class Edit Modal Time Block Management | `ClassModals.tsx:165-320` | `schedules` array, `DateTimePicker` | Edit room, day dropdown, start time picker, duration (hours/mins), or tap delete block / add schedule. | Supports multiple schedule blocks per subject; handles start time and duration inputs. |
| **SCH-EDT-03** | Class Edit Save Action & Subject Registry Sync | `schedule.tsx:394-488` | `handleSaveClass`, `ensureSubjectExists` | Tap "Save Changes" button in edit modal. | Registers subject in global registry, updates semester classes array, refreshes `hasSchedule`, triggers Grade Tracking opt-in alert if new subject. |
| **SCH-OPT-01** | Post-Add Grade Tracking Opt-in Alert | `schedule.tsx:462-487` | `isNewSubject`, `AlertService` | Alert prompt: "Track Grades for [Subject]?". Tap "Yes" or "Not Now". | Enables `gradeTrackingEnabled = true` in subject registry if confirmed. |
| **SCH-AIW-01** | AI Warning / Check My Work Modal | `schedule.tsx:1049-1072` | `showAiWarning`, `setIsQuickEditMode` | Tap "Start Quick Edit" or close icon. | Displays FinSights mascot graphic warning user to double check AI schedule; button activates Quick Edit mode. |
| **SCH-RST-01** | Reset Schedule Action Button | `schedule.tsx:490-516, 989-993` | `handleResetSchedule`, `AlertService` | Tap red trash button at bottom of schedule scroll view; confirm alert. | Deletes all classes for current semester and cleans up orphaned subjects. |

---

## 3. Detailed Component & Feature Analysis

### 3.1 Top Header & Sync Status
- Displays calendar icon with indigo background (`bg-indigo-50` / `rgba(99,102,241,0.2)`).
- Header Title: "My Schedule" with `Typography.title`.
- Date Subtitle: Formatted current date e.g. `new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })`.
- Cloud Sync Indicator: Watches `syncStatus` from `SyncService.subscribe`. Renders Ionicons `cloud-upload`, `cloud-done` (green), or `cloud-offline`.
- Profile / Settings button: `TouchableOpacity` navigating to `/(tabs)/profile`.

### 3.2 View Mode Switcher
- 3 Segmented Pill buttons: **Grid**, **Glass** (List), **Attendance**.
- Grid mode renders `TimetableGrid`.
- Glass mode renders `ScheduleListView`.
- Attendance mode renders `AttendanceTracker`.
- Selected tab styling: white background in light mode (`#ffffff`) with subtle drop shadow; slate background in dark mode (`#475569`).

### 3.3 Academic Term Selector (`Tabs.tsx`)
- Displays current term as `Year • Semester` (e.g. "SY 2025-2026 • 1st Semester").
- Opens bottom sheet modal (`Modal` transparent slide animation).
- Displays list of years and nested semester lists with checkmark indicators on active selection.
- Includes setup button redirecting to `/(tabs)/academic-manager` if no terms exist.

### 3.4 Top Action Buttons: AI Scan & Manual Add
- **Scan Image**:
  - Indigo/purple rounded button with `sparkles` icon.
  - Checks `SyncService.getIsPremium()`. If false, triggers `PremiumPaywallModal`. If true, opens `ScheduleScannerModal`.
- **Add Class**:
  - Outlined rounded button with `add-circle-outline` icon.
  - Clears `editingClass` state and opens `ClassEditModal`.

### 3.5 Dynamic Status Strips
1. **Unscheduled Subjects Banner**:
   - Computes `getUnscheduledSubjects(currentSem)`.
   - If unscheduled subjects exist, displays blue warning banner listing subject names and navigation arrow to `/grades`.
2. **Upcoming Milestones Strip**:
   - Filters requirements and milestones where `date >= today`.
   - Horizontally scrollable chips with countdown badges ("Today", "Tomorrow", "X days").
3. **Today's Classes Strip**:
   - Filters `currentSemClasses` matching `c.day === todayDayIdx`.
   - Displays horizontal scroll view of styled class chips with color badge and start time, or "No classes today 🎉".
4. **Next / Ongoing Class Banner**:
   - Computes ongoing class (current day + current time within startHour & duration).
   - If no ongoing class, calculates minimum wait hours for upcoming class.
   - Displays "Ongoing" (green badge) or "Next" (yellow badge) with countdown string (e.g. "1 hr 30 min").

### 3.6 Interactive Timetable Grid (`TimetableGrid.tsx`)
- Hours range automatically dynamically spans from `minClassHour` to `maxClassHour` (or default 7 AM - 8 PM).
- Multi-column overlapping calculation algorithm (`grouping` overlapping classes and calculating `col` and `maxCol`).
- **Quick Edit Mode**:
  - Toggled by "Quick Edit Schedule" button.
  - Tapping blocks selects/deselects them with checkmarks.
  - Bottom bar displays selection count, "Select All" button, and bulk controls:
    - **DAY**: Shift day index left/right (`moveDayBulk`).
    - **TIME**: Shift start time by ±5 mins (`moveTimeBulk`).
    - **DUR**: Shift block duration by ±5 mins (`changeDurationBulk`).
    - **TRASH**: Delete selected blocks (`onDeleteClasses`).

### 3.7 Weekly Schedule Glass List (`ScheduleListView.tsx`)
- Rendered on a fixed 1080x1920 canvas scaled dynamically to screen width.
- Watermark: Studying Fin mascot image (`assets/images/studying.png`) with opacity (0.4 light / 0.15 dark).
- Header badge showing Year and Semester.
- Groups classes by day of week with day color pills (`DAY_THEMES`).
- Displays side-by-side 2-column cards for classes on each day with time, subject title, and room.

### 3.8 Attendance Tracker View (`AttendanceTracker.tsx`)
- **Statistics Dashboard**:
  - Displays attended vs total hours for Past 7 Days, Past 30 Days, and Overall Semester with progress bars.
  - Dynamic Fin message card based on attendance percentage (e.g. "Incredible job! Perfect attendance!").
- **Class Checklist Weeks List**:
  - Groups semester date range into weekly blocks (Week 1, Week 2, etc.).
  - Displays present/absent/unlogged counts per week.
- **Week Details Modal**:
  - Horizontal day picker strip with status indicators for each day.
  - Session cards for selected day with **Present**, **Absent**, and **No Class** toggle buttons.
  - Takeaway notes input box per session saved in `attendanceLog`.

### 3.9 Export Schedule as Image Workflow
- Ref targets: `viewShotRef` (light grid), `viewShotDarkRef` (dark grid), `viewShotListRef` (glass list).
- Generates high-res image via `react-native-view-shot`.
- Opens `showPreviewModal` with image preview.
- Theme Toggle: Allows toggling light/dark theme export before saving.
- Save Action: Saves to device photo gallery via `expo-media-library`.

### 3.10 AI Schedule Scanner (`ScheduleScannerModal.tsx`)
- Pick Image from Gallery via `expo-image-picker`.
- Custom instructions text area (e.g. "Ignore lab sections").
- Submits base64 payload to Supabase function `parse-schedule`.
- Returns array of classes: `name`, `room`, `instructor`, `day`, `startHour`, `duration`.
- Registers subjects in `subjectRegistry` (`ensureSubjectExists`).
- Opens `showAiWarning` modal ("Check My Work!") with option to enter Quick Edit mode.

### 3.11 Class Add/Edit Modal (`ClassModals.tsx`)
- Supports adding multiple schedule time blocks to a single subject (e.g. Mon 8-10 AM & Wed 8-10 AM).
- Color selector palette (6 accent colors).
- Start time picker using `@react-native-community/datetimepicker`.
- Duration input fields split into Hours (`durHInput`) and Minutes (`durMInput`).
- Day selection dropdown modal (`[Mon..Sun]`).
- Auto-registers subject in `subjectRegistry` and prompts user with opt-in Alert to track grades in Grade Tracker.

---

## 4. Design & Token Audit for Redesign Alignment

To align the Schedule tab with the modern, premium aesthetic of the **Dashboard** and **Grades** tabs:

| Design Element | Current Schedule Tab | Dashboard & Grades Reference Standard | Redesign Recommendation |
| :--- | :--- | :--- | :--- |
| **Card Style** | Flat cards with dark slate/white background and border (`rounded-2xl`, `border`) | Clean, rounded white cards (`rounded-[32px]`) with soft drop shadows, pastel accents, micro-animations | Standardize schedule cards, status banners, and grid containers to match 32px border radius & soft shadows. |
| **Color Palette** | Standard Indigo (`#6366f1`), Slate (`#1e293b`), and custom grid palette | Vibrant indigo/purple gradients, soft pastel indicator badges, Fin mascot banners | Incorporate Fin mascot graphics (e.g. `FinDashboard.png` / `studying.png` / `confused.png`) into header cards and empty states. |
| **Typography** | Mixed native font styles & `Typography` tokens | `Nunito_700Bold`, `Nunito_800ExtraBold`, `Nunito_900Black` | Ensure all headings, time labels, and badges consistently utilize Nunito typography tokens. |
| **Header Banner** | Standard top app bar view | Premium top header banner with mascot integration | Create a hero schedule header banner matching the GWA header style. |

---

## 5. Critical Technical Dependencies & Invariants

1. **Do Not Modify Storage Schema**: Data structures inside `data.years[].semesters[].classes` and `data.years[].semesters[].attendanceLog` MUST remain 100% backward compatible.
2. **Subject Registry Linkage**: Adding or editing classes MUST continue calling `ensureSubjectExists` and `refreshHasSchedule`.
3. **ViewShot Refs**: Hidden `ViewShot` views (`viewShotRef`, `viewShotDarkRef`, `viewShotListRef`) MUST be preserved in render tree for export feature to work.
4. **Router Parameters**: `useLocalSearchParams()` receives `viewMode`, `targetDate`, and `trigger` from push notifications or dashboard links (e.g., jump directly to Attendance tracker date).

---
*Report compiled by explorer_survey_1 agent. Ready for handoff.*
