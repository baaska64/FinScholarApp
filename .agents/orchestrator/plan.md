# Project Plan: FinScholar Schedule Tab Redesign

## Architecture & Visual Strategy
- **Target Screen**: `app/(tabs)/schedule.tsx`
- **Subcomponents**: `components/schedule/TimetableGrid.tsx`, `components/schedule/ScheduleListView.tsx`, `components/schedule/AttendanceTracker.tsx`, `components/schedule/ScheduleScannerModal.tsx`, `components/schedule/ClassModals.tsx`, `components/ledger/Tabs.tsx`
- **Design Tokens**:
  - Theme colors from `constants/Theme.ts` (`light.bg`: `#f8fafc`, `dark.bg`: `#0f172a`, `surface`: `#ffffff` / `#1e293b`, `primary`: `#4f46e5` / `#6366f1`).
  - Radius: Hero Card (`Radius['4xl']` / 32px), Cards (`Radius['2xl']` / 24px), Buttons/Pills (`Radius.full` / 9999px).
  - Shadows: Platform shadow presets (`Shadows.md`, `Shadows.lg`).
  - Hero Structure: 2-layer vibrant indigo gradient banner with Fin mascot graphic (`finanimated.gif` or `FinSights.png`), speech bubble quote, and overlapping stats card (`marginTop: -28`).
  - Typography: Nunito font scale (`Typography.title`, `subtitle`, `body`, `caption`).

## Pre-Redesign Feature Inventory & Checklist (35 Items)

| Feature ID | Feature Name | Component / File | State / Props | Expected Behavior | Verification Status |
|------------|--------------|------------------|---------------|-------------------|---------------------|
| SCH-HDR-01 | Schedule Tab Header & Navigation | `schedule.tsx` | View Mode State (`grid` \| `list` \| `attendance`) | Header displays title, active term indicator, and view mode switcher | Verified Pass |
| SCH-HDR-02 | Term Switcher Modal Trigger | `schedule.tsx`, `Tabs.tsx` | `activeYear`, `activeSem` | Opens Academic Term modal to filter schedule by year & sem | Verified Pass |
| SCH-HDR-03 | Scan AI Schedule Button | `schedule.tsx`, `ScheduleScannerModal.tsx` | `isScannerOpen` | Opens Supabase AI schedule image parser modal | Verified Pass |
| SCH-HDR-04 | Add Class / Subject Button | `schedule.tsx`, `ClassModals.tsx` | `isAddModalOpen` | Opens ClassEditModal to add new schedule block / class | Verified Pass |
| SCH-HDR-05 | Export Schedule Image Button | `schedule.tsx` | `isExporting`, ViewShot ref | Captures schedule image with theme options (light/dark) for saving/sharing | Verified Pass |
| SCH-HDR-06 | Quick Edit Toggle Button | `schedule.tsx`, `TimetableGrid.tsx` | `isQuickEdit` | Toggles bulk schedule edit controls in TimetableGrid view | Verified Pass |
| SCH-VIE-01 | Timetable Grid View Tab | `schedule.tsx`, `TimetableGrid.tsx` | Active Tab (`grid`) | Displays multi-column weekly timetable grid with colored class cards | Verified Pass |
| SCH-VIE-02 | Weekly Glass List View Tab | `schedule.tsx`, `ScheduleListView.tsx` | Active Tab (`list`) | Displays weekly schedule list with glass cards and Fin mascot watermark | Verified Pass |
| SCH-VIE-03 | Attendance Tracker View Tab | `schedule.tsx`, `AttendanceTracker.tsx` | Active Tab (`attendance`) | Displays attendance statistics, class checklist, and session logger | Verified Pass |
| SCH-GRD-01 | Weekly Timetable Layout | `TimetableGrid.tsx` | Schedule items, days, time slots | Renders day columns (Mon-Sat) and hour slots with clean grid alignment | Verified Pass |
| SCH-GRD-02 | Class Block Cards in Grid | `TimetableGrid.tsx` | Class item, color index | Renders class card with subject code, room, time, and custom accent color | Verified Pass |
| SCH-GRD-03 | Class Block Click Action | `TimetableGrid.tsx`, `ClassModals.tsx` | Selected class item | Clicking a class card opens ClassDetailsModal | Verified Pass |
| SCH-GRD-04 | Quick Edit Day Shift | `TimetableGrid.tsx` | Bulk edit actions | Shifts selected class time blocks across days | Verified Pass |
| SCH-GRD-05 | Quick Edit Time Shift | `TimetableGrid.tsx` | Bulk edit actions | Shifts class time blocks forward/backward by time increment | Verified Pass |
| SCH-GRD-06 | Quick Edit Duration Change | `TimetableGrid.tsx` | Bulk edit actions | Adjusts duration of class time blocks | Verified Pass |
| SCH-GRD-07 | Quick Edit Bulk Delete | `TimetableGrid.tsx` | Selected blocks | Deletes selected schedule time blocks | Verified Pass |
| SCH-LST-01 | Glass List Weekly Cards | `ScheduleListView.tsx` | Schedule items grouped by day | Displays day-by-day class cards with clean typography and time ranges | Verified Pass |
| SCH-LST-02 | Fin Mascot Watermark | `ScheduleListView.tsx` | `FinSights.png` / watermark | Subtle mascot graphic integration in list view background | Verified Pass |
| SCH-ATT-01 | Overall Attendance Summary Card | `AttendanceTracker.tsx` | Attendance log data | Displays overall attendance percentage progress bar and status | Verified Pass |
| SCH-ATT-02 | Past 7 Days & 30 Days Stats | `AttendanceTracker.tsx` | Attendance log data | Displays attendance percentages for recent timeframes | Verified Pass |
| SCH-ATT-03 | Class Attendance Checklist | `AttendanceTracker.tsx` | Today's / weekly classes | Interactive list of classes to mark attendance (Present, Absent, No Class) | Verified Pass |
| SCH-ATT-04 | Attendance Logger Buttons | `AttendanceTracker.tsx` | Logger handlers (P, A, NC) | Logs attendance status for a class session with instant state update | Verified Pass |
| SCH-ATT-05 | Class Session Takeaways Input | `AttendanceTracker.tsx` | Session notes state | Allows entering custom takeaway notes per class session | Verified Pass |
| SCH-ATT-06 | Week Details Modal Trigger | `AttendanceTracker.tsx` | Selected week state | Opens modal showing detailed weekly attendance history | Verified Pass |
| SCH-MOD-01 | Class Details Modal View | `ClassModals.tsx` | Selected class item | Displays full class info (Subject, Instructor, Room, Time blocks, Color) | Verified Pass |
| SCH-MOD-02 | Class Edit Modal Form | `ClassModals.tsx` | Form state | Form to edit subject code, title, room, instructor, color, schedule blocks | Verified Pass |
| SCH-MOD-03 | Multi-Schedule Block Support | `ClassModals.tsx` | Time block array | Supports adding multiple day/time blocks for a single subject | Verified Pass |
| SCH-MOD-04 | Delete Subject / Schedule Block | `ClassModals.tsx` | Subject ID / Block ID | Deletes class or schedule block with confirmation | Verified Pass |
| SCH-SCN-01 | AI Schedule Scanner Image Picker | `ScheduleScannerModal.tsx` | Image picker hook | Allows selecting/taking a photo of a class schedule | Verified Pass |
| SCH-SCN-02 | Supabase AI Parser Integration | `ScheduleScannerModal.tsx` | Supabase edge function handler | Sends image to AI parser and extracts schedule JSON | Verified Pass |
| SCH-SCN-03 | Parsed Schedule Preview & Import | `ScheduleScannerModal.tsx` | Parsed schedule state | Displays extracted classes for user confirmation before importing | Verified Pass |
| SCH-EXP-01 | ViewShot Image Capture | `schedule.tsx` | ViewShot ref | Captures schedule screen as high-resolution image | Verified Pass |
| SCH-EXP-02 | Light/Dark Theme Export Toggle | `schedule.tsx` | Export theme state | Toggles schedule export image background theme | Verified Pass |
| SCH-REG-01 | Subject Registry Integration | `subjectRegistry.ts`, `schedule.tsx` | Global subject store | Synchronizes schedule status (`refreshHasSchedule`) with Grade Ledger | Verified Pass |
| SCH-EMP-01 | Empty Schedule State | `schedule.tsx`, `TimetableGrid.tsx` | Empty schedule condition | Displays friendly empty state with mascot illustration and "Add Class" CTA | Verified Pass |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Pre-Redesign Feature Inventory | Audit features, extract design tokens, check test setup | None | DONE |
| M1 | UI/UX Redesign Implementation | Refactor `schedule.tsx` to 2-layer Hero + Overlapping Stats Card layout, apply design tokens, improve cards/pills, fix layout bugs & TS errors | M0 | DONE |
| M2 | Verification & Audit Gate | Run Reviewer, Challenger, TypeScript check (`npx tsc --noEmit`), test runner (`npm test`), and Forensic Auditor | M1 | DONE |

## Code Layout & File Assignment
- Target Files Modified:
  - `app/(tabs)/schedule.tsx`: Redesigned top header with SVG 2-layer Hero Banner (`#4f46e5` / `#3730a3` Light, `#312e81` / `#1e1b4b` Dark), speech bubble quote, animated Fin mascot, overlapping stats card (`marginTop: -28`, `Radius['3xl']`), segmented pill controls (`Radius.full`), view mode switching, and timezone date key alignment (`new Date(startDateStr)`).
  - `components/schedule/TimetableGrid.tsx`: Modernized grid cards, rounded corners (`Radius['2xl']`), spacing, design token alignment, overlapping block placement algorithm.
  - `components/schedule/ScheduleListView.tsx`: Refactored card styling and typography to match Grades/Dashboard cards, 1080x1920 layout feel.
  - `components/schedule/AttendanceTracker.tsx`: Refactored card containers and pill stats to match design tokens.
  - `components/schedule/ClassModals.tsx`: Updated modal dialog styling, header gradient, rounded card styling.
