# Comprehensive Codebase Analysis & Architecture Audit — Schedule Tab Redesign

**Agent:** explorer_survey_3 (teamwork_preview_explorer)  
**Date:** 2026-08-09  
**Target:** FinScholar App Schedule Tab Redesign (`c:/Projects/FinScholarApp/`)

---

## 1. Executive Summary

This report presents a thorough audit of the FinScholar React Native / Expo application, focusing on the Schedule tab redesign project. The analysis covers build/type-check infrastructure, automated test framework capabilities, file structure mapping, component hierarchy, theme context usage, and React Native / Expo layout constraints.

---

## 2. Build, Type-Checking & Test Infrastructure

### 2.1 TypeScript Configuration & Type-Checking Command
- **Configuration File:** `c:/Projects/FinScholarApp/tsconfig.json`
- **Base Config:** Extends `"expo/tsconfig.base"`
- **Compiler Options:**
  - `"module": "esnext"`
  - `"strict": true`
  - `"paths": { "@/*": ["./*"] }`
- **Included Glob Patterns:** `**/*.ts`, `**/*.tsx`, `.expo/types/**/*.ts`, `expo-env.d.ts`, `nativewind-env.d.ts`
- **Excluded Patterns:** `node_modules`, `supabase`
- **Exact Type-Checking Command:**
  ```bash
  npx tsc --noEmit
  ```

### 2.2 Automated Test Runner & Commands
- **Primary Test Script:** `npm test`
- **Underlying Command:**
  ```bash
  node --experimental-strip-types scripts/run-tests.js
  ```
- **Test Infrastructure Details (`TEST_INFRA.md`):**
  - Uses Node.js 24+ native ES module loader with `--experimental-strip-types` flag for zero-compilation headless test execution.
  - `scripts/test-loader.js` intercepts ES module imports, resolving `@/*` path aliases to `./*` and mapping `react-native` imports to `scripts/mocks/react-native.js`.
  - Pure calculation helpers are located at `__tests__/helpers/dashboardCalculations.js`.
- **Existing Test Suites in `__tests__/`:**
  1. `__tests__/tier1-feature-coverage.test.js` — Core functional tests
  2. `__tests__/tier2-boundary-edge-cases.test.js` — Boundary condition testing
  3. `__tests__/tier3-cross-feature-interactions.test.js` — Cross-feature integration tests
  4. `__tests__/tier4-real-world-theme.test.js` — Real-world theme and data state tests
  5. `__tests__/adversarial-stress.test.js` — Stress and edge case validation
  6. `__tests__/ledger.test.js` — Grade Ledger calculations and state management
  7. `__tests__/state-mutation-stress.test.js` — Data structure mutation resilience
  8. `__tests__/subjectProgress.test.ts` — Subject completion percentage and task tracking

---

## 3. Comprehensive File Structure & Component Hierarchy

### 3.1 Schedule Tab Core Route
- `app/(tabs)/schedule.tsx`: Primary Schedule screen containing top bar, view switcher (Grid, Glass, Attendance), Quick Edit mode toggle, Export image generator, state management (years, semesters, classes, attendance log, milestones), and scanner/paywall integration.

### 3.2 Schedule Component Hierarchy (`components/schedule/`)
- `components/schedule/TimetableGrid.tsx`: Timetable matrix grid supporting responsive column calculation (`getDayWidth`), time-slot positioning, overlap group layout computation, quick edit bulk actions (day shift, time shift, duration shift, delete), and high-resolution screenshot export mode (`isExportMode`).
- `components/schedule/ScheduleListView.tsx`: "Glass" list card layout scaling a fixed 1080x1920 canvas dynamically to fit screen width, grouping class schedules by day with custom color themes (`DAY_THEMES`), room parsing, and Fin mascot background watermark.
- `components/schedule/AttendanceTracker.tsx`: Full attendance management view featuring 7-day / 30-day / overall attendance statistics, weekly checklist breakdown, day-by-day session status toggling (Present, Absent, No Class, Pending, Future), takeaway/notes input, and custom Fin feedback messages.
- `components/schedule/ClassModals.tsx`:
  - `ClassDetailsModal`: Bottom sheet modal for inspecting class details (name, day, time, room, instructor, color) with Edit and Delete action buttons.
  - `ClassEditModal`: Modal dialog for creating or editing class subjects and time blocks, equipped with `@react-native-community/datetimepicker` for time selection, day picker dropdown, color swatch selection, and input flushing.
- `components/schedule/ScheduleScannerModal.tsx`: AI-assisted schedule scanner interface integrating `expo-image-picker`, base64 encoding, custom prompt instructions, and Supabase Edge Function (`parse-schedule`).

### 3.3 Shared Components, UI & Layout (`components/`)
- `components/ledger/Tabs.tsx`: Year and Semester tab selector used for switching academic terms.
- `components/CustomTabBar.tsx`: Custom floating bottom tab bar rendered via Expo Router `tabBar` prop, utilizing `useSafeAreaInsets` and `Animated.spring` sliding active indicator.
- `components/CustomAlert.tsx`: `AlertService` singleton for styled cross-platform alerts.
- `components/SemesterContext.tsx`: `useSemesterContext` React context provider managing global selected year and semester state.
- `components/SyncProvider.tsx`: `SyncService` state provider for offline-first data sync.
- `components/PremiumPaywallModal.tsx`: Paywall modal for locking AI features.
- `components/DevMenuModal.tsx`: Internal developer debug menu.
- `components/Themed.tsx`: Theme-aware `Text`, `View`, and `useThemeColor` primitives.
- `components/ui/LoadingSkeleton.tsx`: `ListSkeleton` placeholder loading component.
- `components/ui/` primitives: `AnimatedPressable.tsx`, `Badge.tsx`, `EmptyState.tsx`, `FinAvatar.tsx`, `GlassCard.tsx`, `SectionHeader.tsx`, `index.ts`.

### 3.4 Other App Tab Routes (`app/(tabs)/`)
- `app/(tabs)/_layout.tsx`: Tab navigator layout configuring routes (`index`, `grades`, `schedule`, `calendar`, `requirements`, `flashcards`, `profile`, `academic-manager`).
- `app/(tabs)/index.tsx`: Main Dashboard tab.
- `app/(tabs)/grades.tsx`: Grade Ledger tab.
- `app/(tabs)/calendar.tsx`: Academic Calendar tab.
- `app/(tabs)/requirements.tsx`: Tasks / Requirements tab.
- `app/(tabs)/flashcards.tsx`: Flashcards / Study tab.
- `app/(tabs)/profile.tsx`: User Profile & Settings.
- `app/(tabs)/academic-manager.tsx`: Academic Term configuration setup.

### 3.5 Design System & Theme Constants (`constants/`)
- `constants/Colors.ts`: Light (`#1e293b` text, `#f8fafc` bg, `#6366f1` primary) and Dark (`#f1f5f9` text, `#0f172a` bg, `#818cf8` primary) color palettes.
- `constants/Theme.ts`: Tokenized design values:
  - `Colors`: Light and dark color mappings for surfaces, cards, text levels, tabs, and status badges.
  - `Spacing`: `xs` (4), `sm` (8), `md` (12), `lg` (16), `xl` (20), `2xl` (24), `3xl` (32), `4xl` (40), `5xl` (48).
  - `Radius`: `sm` (8), `md` (12), `lg` (16), `xl` (20), `2xl` (24), `3xl` (28), `4xl` (32), `full` (9999).
  - `Shadows`: Platform-specific shadow objects (`sm`, `md`, `lg`, `xl`).
  - `Typography`: Scale covering `display`, `heading`, `title`, `subtitle`, `body`, `caption`, `label` using font family `Nunito`.
  - `getTheme(isDark)`: Helper function returning active design tokens.

### 3.6 Services & Utilities (`services/` & `utils/`)
- `services/SyncService.ts`: Core data engine handling `AsyncStorage` key `grade_ledger_v2_data`, Supabase cloud sync, premium entitlement checks, and data change events.
- `services/supabaseClient.js`: Supabase auth and API client setup.
- `utils/subjectRegistry.ts`: Functions `ensureSubjectExists`, `refreshHasSchedule`, `getUnscheduledSubjects` maintaining bidirectional linking between schedule class blocks and Grade Tracker subjects.
- `utils/calculator.js`: GWA calculation algorithms.
- `utils/quotes.ts`: Fin mascot quote dictionary.

### 3.7 Assets (`assets/`)
- Key Mascot Images: `assets/images/FinDashboard.png`, `assets/images/FinSights.png`, `assets/images/confused.png`, `assets/images/happy.png`, `assets/images/sleeping.png`, `assets/images/studying.png`, `assets/images/studying_small.png`, `assets/images/ExportBg.png`.
- Custom Fonts: `assets/fonts/SpaceMono-Regular.ttf`, Nunito Google fonts package (`@expo-google-fonts/nunito`).

---

## 4. React Native & Expo Layout Constraints Audit

### 4.1 SafeArea & Bottom Tab Bar Spacing
1. **Absolute Floating Custom Tab Bar (`CustomTabBar.tsx`):**
   - Renders with `position: 'absolute'`, `bottom: 0`, `left: 0`, `right: 0`.
   - Bottom padding incorporates safe area insets via `useSafeAreaInsets()`:
     - iOS: `Math.max(28, insets.bottom)`
     - Android: `Math.max(12, insets.bottom + 8)`
   - **Impact on Content Screens:** Content containers in `app/(tabs)/schedule.tsx` MUST use bottom content padding (e.g., `contentContainerClassName="pb-[100px]"` or `paddingBottom: 120`) to prevent low-positioned content and action buttons (like "Reset Schedule" or bottom modals) from being obscured or clipped behind the floating tab bar.

### 4.2 ScrollView vs FlatList Performance & Hierarchy
1. **Primary Screen Scroll:** `schedule.tsx` wraps main content in a single root `<ScrollView className="flex-1 px-4 py-4" contentContainerClassName="pb-[100px]" removeClippedSubviews={true}>`.
2. **Nested Horizontal Scrolls:**
   - Term Selector `Tabs` (`components/ledger/Tabs.tsx`)
   - Upcoming Milestones strip
   - Today's Classes preview strip
   - Day selection inside `AttendanceTracker` modal
3. **Timetable Grid Scroll Handling:**
   - Non-export `TimetableGrid` uses a vertical `<ScrollView>` combined with a horizontal `<ScrollView>` for day columns.
   - Requires `nestedScrollEnabled={true}` to work inside parent scroll containers without locking scroll gestures.
   - Header row scroll is programmatically synchronized with grid scroll via `onScroll` listener and `headerScrollRef.current.scrollTo(...)`.

### 4.3 NativeWind & Theme Context Integration
- Color schemes are dynamically queried using NativeWind's `useColorScheme()` (`const isDark = colorScheme === 'dark'`).
- `getTheme(isDark)` provides tokenized background, surface, text, and border values.
- Tailwind class names (`className="..."`) are heavily combined with inline style objects (`style={{ ... }}`). When refactoring UI:
  - Care must be taken not to create conflicting background/text color specs between Tailwind `bg-slate-900` / `text-white` and inline `style={{ backgroundColor: theme.surface, color: theme.text }}`.
  - Border radii and elevation shadows specified inline override Tailwind shadow classes on Android.

### 4.4 Potential Layout Clipping, Overflow & Rendering Risks
1. **Off-screen Screenshot Export Views (`ViewShot`):**
   - In `app/(tabs)/schedule.tsx` (lines 873–956), hidden views for screenshot export are rendered at `position: 'absolute', top: 0, left: 0, zIndex: -1, opacity: 0` with explicit widths of `3084px`.
   - While invisible to the user, these views are actively mounted in the render tree and calculated during layout passes. Care must be taken not to alter their layout structure during UI redesigns so export image quality remains high.
2. **Responsive Day Column Sizing (`TimetableGrid.tsx`):**
   - `getDayWidth(numDays, isExport)` calculates column width relative to screen width (`Dimensions.get('window').width`).
   - On small phone screens, showing 7 days (Monday through Sunday) creates narrow cells if not scrolled horizontally.
3. **Quick Edit Mode Overlay Position:**
   - In `TimetableGrid.tsx`, the bulk editing action bar uses `position: 'absolute', bottom: 10`. If the parent container height is constricted, this overlay can obscure bottom hour rows.
4. **Modal Keyboard Constraints (`ClassEditModal.tsx` & `AttendanceTracker.tsx`):**
   - TextInputs for class name, room, instructor, start/duration times, and takeaways trigger the software keyboard.
   - Using `KeyboardAvoidingView` with proper `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` is required to keep input fields accessible when editing.

---

## 5. Summary & Handoff Readiness

All project build configurations, TypeScript setups, test infrastructure, directory maps, component hierarchies, and layout constraints have been verified and documented. The codebase is fully ready for the pre-redesign feature checklist creation and schedule tab redesign phase.
