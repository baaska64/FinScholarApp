# Detailed Requirements & Design Tokens Report — Grade Ledger Redesign

**Project**: FinScholarApp  
**Target Module**: Grade Ledger (`app/(tabs)/grades.tsx`, `components/ledger/*`)  
**Reference Source**: `app/(tabs)/index.tsx`, `constants/Theme.ts`, `utils/calculator.js`, `utils/subjectRegistry.ts`, `ORIGINAL_REQUEST.md`  
**Author**: spec_miner_survey_2 (Spec Miner)  
**Date**: 2026-08-08  

---

## 1. Executive Summary & Specification Scope

This report mined the requirements for the **Grade Ledger Redesign** (Requirements R1–R4 from `ORIGINAL_REQUEST.md`) and extracted design patterns, component standards, typography, color tokens, and layout guidelines from `app/(tabs)/index.tsx` and `constants/Theme.ts`.

The redesigned Grade Ledger transforms `app/(tabs)/grades.tsx` and `components/ledger/GwaSummary.tsx` to match the modern dashboard aesthetic:
1. **R1 (Overall GWA Header)**: Top banner matching the "Celebrate Every Milestone" style with prominent Overall/Cumulative GWA, Fin mascot graphic (`FinDashboard.png`), and purple/indigo hero gradient.
2. **R2 (Condensed GWA Summary Cards)**: Removal of the 3-donut chart row; replacing it with side-by-side **Semester GWA** and **Year GWA** cards directly beneath the main banner.
3. **R3 (Subject Cards & UI Polishing)**: Refactored subject cards, year/semester selector tabs, pill buttons, soft shadows, clear typography, and well-padded cards.
4. **R4 (Feature Parity)**: 100% preservation of all existing functionality (Add subject, toggle tracking, edit mode, delete, duplicate, empty states, active subject detail view, settings modal).

---

## 2. Requirements Mining (R1–R4)

### R1. Overall GWA Header
* **Source**: `ORIGINAL_REQUEST.md` (lines 37–39) & `app/(tabs)/index.tsx` (hero banner pattern)
* **Description**: The top section of `app/(tabs)/grades.tsx` (implemented in `GwaSummary.tsx` or main view) is overhauled into a single hero banner card.
* **UI Elements**:
  * **Gradient Background**: `#4f46e5` (Light Mode) / `#312e81` (Dark Mode), with `borderRadius: Radius['4xl']` (32px), `position: 'relative'`, `overflow: 'hidden'`.
  * **Decorative Glow**: Absolute positioned semi-transparent circle (`width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255, 255, 255, 0.1)', right: -30, top: -30`).
  * **Fin Mascot**: Embedded `FinDashboard.png` asset (`width: 100, height: 100`, `resizeMode="contain"`).
  * **Cumulative/Overall GWA Display**: Prominently displays the student's Cumulative GWA in large title typography (`Typography.display` / `Typography.heading`, e.g., `1.25` or `94.5%`).
  * **Motivational / Milestone Tag**: "Celebrate Every Milestone" or "Fin says:" speech bubble (`rgba(255,255,255,0.2)` light, `rgba(15,23,42,0.6)` dark).

### R2. Condensed GWA Summary Cards
* **Source**: `ORIGINAL_REQUEST.md` (lines 40–42)
* **Description**: Replaces the previous 3-donut chart layout (`DonutChart.tsx` for SEMESTER, YEAR, CUMULATIVE). The Cumulative GWA is now part of the top R1 banner. The **Semester GWA** and **Year GWA** cards sit **side-by-side** underneath the hero banner.
* **UI & Layout**:
  * **Layout**: Horizontal row (`flexDirection: 'row'`, `gap: 12`, `flex: 1` per card).
  * **Card Styling**: Clean white rounded cards (`backgroundColor: theme.surface`, `borderRadius: Radius['2xl']` (24px) or `Radius['3xl']` (28px), `borderWidth: 1`, `borderColor: theme.cardBorder`, `...Shadows.md`).
  * **Contents**: Metric title (e.g. `SEM GWA`, `YEAR GWA`), value text (`1.50` / `88.5%`), subtle icon (`Ionicons` `ribbon-outline` / `school-outline`), and progress/indicator text (`On Track` / `Passing`).

### R3. Subject Cards & UI Polishing
* **Source**: `ORIGINAL_REQUEST.md` (lines 43–45)
* **Description**: Polish the Subject list (`SubjectCard.tsx`) and Year/Semester selector (`Tabs.tsx`) to match the inspiration design tokens.
* **UI Elements**:
  * **Year/Semester Selector**: Pill / rounded select box (`borderRadius: Radius['2xl']`), chevron indicator, modal sheet for term selection.
  * **Subject Cards**: `borderRadius: Radius['3xl']` (28px) or `Radius['2xl']` (24px), padded (`padding: 20`), clear typography hierarchy, score & GWA pill chips, color-coded score progress bar (`#22c55e` >=90%, `#3b82f6` >=75%, `#eab308` >=60%, `#ef4444` <60%), eye tracking toggle icon, duplicate icon, delete icon.
  * **Spacing & Padding**: Generous vertical and horizontal padding, consistent 12–16px gaps between cards.

### R4. Feature Parity Requirement Matrix
* **Source**: `ORIGINAL_REQUEST.md` (lines 46–48) & `app/(tabs)/grades.tsx`
* **Features Required**:
  1. **Add Subject**: Modal dialog allowing subject creation. Uses `ensureSubjectExists()` from `subjectRegistry.ts` to enforce case-insensitive duplicate prevention. Shows inline warning if duplicate exists.
  2. **Toggle Tracking**: Eye icon on subject card toggles `gradeTrackingEnabled`. Displays alert confirmation. Excludes untracked subjects from GWA calculation while preserving item data. Greys out card with "NOT TRACKED" badge.
  3. **Edit Mode (Multi-select Delete)**: Toggle Edit mode button transforms subject list. Selection radio buttons appear on cards. Top action bar shows "Delete (N)" button with confirmation dialog.
  4. **Delete Subject**: Individual delete button on card with confirmation alert dialog.
  5. **Duplicate Subject**: Deep clones subject data tree, regenerates all IDs (`periods`, `components`, `items`, `subItems`), appends "Copy" to subject name, and saves.
  6. **Empty States**:
     - No Academic Terms: Displays welcome card with `Ionicons` `school-outline` and "Setup Academic Term" button redirecting to `academic-manager`.
     - No Semester Selected: Displays prompt to select a semester.
     - Empty Subjects: Displays "Add New Subject" button.
     - Unscheduled Subjects Warning Bar: Shows amber warning card if subjects exist without linked schedule blocks (`hasSchedule === false`).
  7. **Active Subject Detail View (`ActiveSubjectView.tsx`)**: Full period/component/item breakdown, weight auto-calculation, weight validation warnings (total != 100%), pass % bar, target goal tracker ("Target Goal"), AI AutoConfig syllabus parser integration (`parse-syllabus` Supabase function), and FinSights modal.
  8. **Settings Modal**: Grading system selector (`1_IS_BEST`, `5_IS_BEST`, `4_IS_BEST`, `PERCENT`) and "Erase All Data" reset option.

---

## 3. Design Tokens & Patterns (Mined from `index.tsx` & `Theme.ts`)

### Color Palette Tokens (`constants/Theme.ts`)

| Token | Light Mode Value | Dark Mode Value | Usage Context |
|---|---|---|---|
| `primary` | `#4f46e5` (Indigo-600) | `#818cf8` (Indigo-400) | Main action buttons, active tabs, primary accents |
| `primaryLight` | `#818cf8` | `#a5b4fc` | Icon background fills, subtle highlights |
| `primaryDark` | `#3730a3` | `#6366f1` | Hover/Pressed primary state |
| `secondary` | `#0ea5e9` (Sky-500) | `#38bdf8` (Sky-400) | Secondary badges, info tags |
| `background` | `#f8fafc` (Slate-50) | `#0f172a` (Slate-900) | Screen background |
| `surface` | `#ffffff` (White) | `#1e293b` (Slate-800) | Card backgrounds |
| `surfaceSecondary` | `#f1f5f9` (Slate-100) | `#334155` (Slate-700) | Stat pill chips, inner containers, input fields |
| `cardBorder` | `#e2e8f0` (Slate-200) | `#334155` (Slate-700) | Card outline borders |
| `text` | `#0f172a` (Slate-900) | `#f8fafc` (Slate-50) | Primary titles and body text |
| `textSecondary` | `#475569` (Slate-600) | `#cbd5e1` (Slate-300) | Subtitles, labels, captions |
| `textTertiary` | `#94a3b8` (Slate-400) | `#64748b` (Slate-500) | Helper text, placeholders, inactive icons |
| `success` | `#10b981` (Emerald-500) | `#34d399` (Emerald-400) | Passing grades (>=90%), PRO badge, success states |
| `warning` | `#f59e0b` (Amber-500) | `#fbbf24` (Amber-400) | Average grades (60-75%), warnings, unscheduled alert |
| `error` | `#ef4444` (Red-500) | `#f87171` (Red-400) | Failing grades (<60%), delete actions, overdue alerts |

### Typography Scale (`constants/Theme.ts`)

| Style Name | Font Size | Font Family | Line Height | Usage in Grade Ledger |
|---|---|---|---|---|
| `display` | 36px | `Nunito_900Black` | 44px | Overall GWA Big Number (Header) |
| `heading` | 28px | `Nunito_900Black` | 34px | Section Headlines, Modal Headers |
| `title` | 22px | `Nunito_700Bold` | 28px | Top App Bar Title ("Grade Tracker") |
| `subtitle` | 18px | `Nunito_700Bold` | 24px | Card Titles, Subject Names, Stat values |
| `body` | 16px | `Nunito_400Regular` | 24px | General text, modal description |
| `bodyBold` | 16px | `Nunito_700Bold` | 24px | Emphasized text, Subject Name in List |
| `caption` | 13px | `Nunito_400Regular` | 18px | Sub-meta info, period counts, unit counts |
| `captionBold` | 13px | `Nunito_700Bold` | 18px | Badge text, chip labels |
| `label` | 11px | `Nunito_700Bold` | 16px | Uppercase section labels (`SEM GWA`, `YEAR GWA`, `FIN SAYS:`) |

### Border Radius Scale (`constants/Theme.ts`)

| Token | Value | Usage |
|---|---|---|
| `Radius.sm` | 8px | Micro badges, status tags |
| `Radius.md` | 12px | Action buttons, attendance chips |
| `Radius.lg` | 16px | Inner input fields, small cards |
| `Radius.xl` | 20px | Date visual boxes, sub-containers |
| `Radius['2xl']` | 24px | Stats cards, pill containers |
| `Radius['3xl']` | 28px | Subject cards, modal top corners |
| `Radius['4xl']` | 32px | Hero Banner container, major modal sheets |
| `Radius.full` | 9999px | Circular avatar buttons, pill buttons, floating action buttons |

### Shadow Scale (`constants/Theme.ts`)

| Scale | iOS Configuration | Android Elevation | Applied Component |
|---|---|---|---|
| `Shadows.sm` | `opacity: 0.05, radius: 2, offset: {0,1}` | 1 | Unscheduled warning bar, inner chips |
| `Shadows.md` | `opacity: 0.08, radius: 8, offset: {0,2}` | 3 | Subject cards, Condensed GWA cards |
| `Shadows.lg` | `opacity: 0.12, radius: 16, offset: {0,4}` | 6 | Hero Banner card, Welcome card |
| `Shadows.xl` | `opacity: 0.16, radius: 24, offset: {0,8}` | 10 | Primary modal sheets |

---

## 4. Features Discovered Table

```
## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Header UI | Hero Overall GWA Banner | Vibrant hero card featuring Overall GWA, Fin mascot graphic (FinDashboard.png), and motivational quote banner | Cumulative GWA float, system string, color scheme | Rendered hero banner card with gradient (#4f46e5 / #312e81), Fin mascot image, quote bubble, and big GWA value | Falls back to '--' or '0.00' if no subjects present | ORIGINAL_REQUEST.md R1, app/(tabs)/index.tsx |
| 2 | Summary UI | Side-by-Side GWA Summary Cards | Condensed Semester GWA and Year GWA cards sitting side-by-side in a horizontal row | semGwa, yearGwa, semPercent, yearPercent, system string | 2 equal-width cards with icon, metric title, GWA value, and indicator tag | Renders '--' when data is missing or total units = 0 | ORIGINAL_REQUEST.md R2, components/ledger/GwaSummary.tsx |
| 3 | Subject List | Subject Card Component | Rounded card displaying subject name, units, passing %, period count, calculated score %, grade equivalent, and score progress bar | Subject object, system string, isTracked, hasSchedule | Animated card with score/GWA chips, color progress bar, and action controls | Greys out card with 'NOT TRACKED' banner when gradeTrackingEnabled is false | app/(tabs)/grades.tsx, components/ledger/SubjectCard.tsx |
| 4 | Subject List | Add Subject Modal | Modal bottom sheet allowing user to type subject name and add to current term | User input text (subject name) | New subject added to semester.subjects array with default 3 units, 60% pass, gradeTrackingEnabled: true | Triggers error message if name is empty or duplicate subject exists | app/(tabs)/grades.tsx, utils/subjectRegistry.ts |
| 5 | Subject List | Toggle Grade Tracking | Eye icon button on subject card to include/exclude subject from GWA calculations | subjectId | Toggles gradeTrackingEnabled flag, triggers alert notification, updates GWA summary | Excludes subject from calculateSemester/calculateYear without deleting items | app/(tabs)/grades.tsx, utils/subjectRegistry.ts |
| 6 | Subject List | Edit Mode & Multi-Delete | Edit button switches subject list to multi-selection mode with radio checkboxes | Selection taps, Delete button tap | Deletes selected subjects from semester.subjects array | Prompts confirmation alert with count of subjects before deleting | app/(tabs)/grades.tsx |
| 7 | Subject List | Subject Duplication | Copy icon duplicates an existing subject with all periods, components, items, and subItems | Subject object | Cloned subject added to array with 'Copy' suffix and newly generated unique IDs | Deep clone ensures no React key collisions across periods/items | app/(tabs)/grades.tsx |
| 8 | Subject List | Single Subject Deletion | Trash icon button on subject card to delete individual subject | Subject object | Subject removed from semester.subjects array | Prompts confirmation alert dialog before removal | app/(tabs)/grades.tsx |
| 9 | Navigation | Term Selector Tab/Modal | Dropdown button displaying active Year & Semester, opens bottom sheet term picker | Selected year ID, selected semester ID | Context updated via setYearAndSemester(), updates active view | Shows empty state if no years/semesters exist with button to Academic Manager | app/(tabs)/grades.tsx, components/ledger/Tabs.tsx |
| 10 | Warning UI | Unscheduled Subjects Alert | Alert banner informing user of subjects that do not have linked schedule blocks | semester.subjects array, class list | Banner displaying count and names of unscheduled subjects with arrow to Schedule tab | Hides automatically when all subjects have linked schedule blocks | app/(tabs)/grades.tsx, utils/subjectRegistry.ts |
| 11 | Detail View | Active Subject View | Full grade breakdown view when tapping a subject card (Periods, Components, Items, Sub-Items) | Subject object, system string | Interactive tree editor with real-time grade calculations, weight auto-split, and target goal tracker | Displays inline weight warning text if total weight != 100% | components/ledger/ActiveSubjectView.tsx |
| 12 | Detail View | Target Goal Tracker | Bottom section in ActiveSubjectView calculating required scores on remaining items to hit target grade | Target percentage input | Text explanation of points needed and table of required scores per empty item | Displays 'Target is impossible' if required score exceeds available remaining weight | components/ledger/ActiveSubjectView.tsx |
| 13 | AI Integration | AI AutoConfig Syllabus Parser | Invokes Supabase edge function 'parse-syllabus' with text prompt or uploaded image to auto-populate subject grading structure | Text prompt or syllabus image base64 | Array of periods, components, and items inserted into subject structure | Shows Alert with error message if API call fails or prompt is empty | components/ledger/ActiveSubjectView.tsx |
| 14 | Settings | Grade System Switcher | Settings pageSheet modal to toggle grading system standard | System choice ('1_IS_BEST', '5_IS_BEST', '4_IS_BEST', 'PERCENT') | Recalculates all GWA equivalents across semester, year, and cumulative | Persists system setting in AsyncStorage and Supabase | app/(tabs)/grades.tsx |
| 15 | Settings | Erase All Data | Reset button in settings modal to reset grade ledger to initial state | Tap reset button | Clears all years, semesters, and subjects, restoring INITIAL_DATA | Requires confirmation alert before wiping data | app/(tabs)/grades.tsx |
```

---

## 5. Edge Cases Table

```
## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Semester GWA Calculation | 0 subjects enrolled in semester | Calculator returns percent: 0, equivalent: 0 without throwing NaN or crashing UI |
| 2 | Year GWA Calculation | All subjects have 0 units (audit courses) | Calculator returns percent: 0, equivalent: 0 without division-by-zero error |
| 3 | Subject Addition | User inputs subject name matching existing subject (case-insensitive e.g. "MATH 101" vs "math 101") | ensureSubjectExists() flags isNew: false, displays warning "MATH 101 already exists. Tap it to manage grades." |
| 4 | Grade Tracking Toggle | All subjects in semester have gradeTrackingEnabled: false | calculateSemester() excludes all subjects, GWA displays '--' / '0.00', subject cards show 'NOT TRACKED' banner |
| 5 | Subject Duplication | Subject with 3 nested periods, 6 components, and 20 items is duplicated | deepCloneSubject() recursively generates fresh random IDs for every node so React key collisions never occur |
| 6 | Weight Validation | Period component weights sum to 80% (20% missing) or 110% (exceeds 100%) | getWeightWarning() calculates auto-weight for blank fields or renders red warning banner "Total 110% (Exceeds 100%)" |
| 7 | Target Goal Tracker | Target grade set to 95%, but remaining uncompleted items only account for 10% of total grade and current score is 70% | Target tracker displays "Target is impossible, but you've already passed!" with warning icon |
| 8 | Academic Terms State | Data has 0 years configured | Displays empty state card with school icon and "Setup Academic Term" pill button routing to /(tabs)/academic-manager |
| 9 | Unscheduled Subjects | User adds a subject in Grade Ledger without creating class schedule blocks | Subject card displays "No schedule" badge, top of ledger displays amber banner "1 subject without a schedule" |
| 10 | System Switching | User switches grading system from 1_IS_BEST (1.0 best) to 4_IS_BEST (4.0 best) or PERCENT | Calculator.interpolateGrade() dynamically re-computes all equivalents across GWA cards, subject cards, and detail views |
```

---

## 6. Architecture & Data Contracts

### 1. Data Schema Hierarchy (`grade_ledger_v2_data`)

```typescript
interface LedgerData {
  settings: {
    gradingSystem: '1_IS_BEST' | '5_IS_BEST' | '4_IS_BEST' | 'PERCENT';
  };
  years: Year[];
}

interface Year {
  id: string;
  name: string; // e.g. "1st Year (2025-2026)"
  semesters: Semester[];
}

interface Semester {
  id: string;
  name: string; // e.g. "1st Semester"
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  subjects: Subject[];
  classes?: ClassBlock[];
  milestones?: EventMilestone[];
  attendanceLog?: Record<string, AttendanceLogEntry>;
}

interface Subject {
  id: string;
  name: string;
  units: number;
  passingPercent: number; // default 60
  periods: Period[];
  hasSchedule?: boolean; // true if linked classes exist
  gradeTrackingEnabled?: boolean; // false = excluded from GWA
  targetValue?: string; // target percentage for goal tracker
}

interface Period {
  id: string;
  name: string; // e.g. "Midterm"
  weight?: number | string; // percentage weight of period
  components: Component[];
}

interface Component {
  id: string;
  name: string; // e.g. "Quizzes", "Exams"
  weight?: number | string;
  items: GradeItem[];
}

interface GradeItem {
  id: string;
  name?: string;
  score?: number | string;
  max?: number | string; // default 100
  weight?: number | string;
  subItems?: SubItem[];
  isCollapsed?: boolean;
}

interface SubItem {
  id: string;
  name?: string;
  score?: number | string;
  max?: number | string;
  weight?: number | string;
}
```

---

## 7. Recommended Component Refactoring Strategy

To achieve the redesign with maximum clarity and clean code isolation:

1. **`components/ledger/GwaSummary.tsx` Refactoring**:
   * Transform `GwaSummary` into the R1 Hero Banner + R2 Side-by-side Cards container.
   * Render the top banner with `FinDashboard.png`, speech bubble quote, and large Cumulative GWA display.
   * Render two side-by-side card items underneath for `Semester GWA` and `Year GWA`.
   * Keep high grade celebration message ("Fin is super happy! 🌟") under the side-by-side cards when student is performing exceptionally well.

2. **`components/ledger/SubjectCard.tsx` Refactoring**:
   * Apply design tokens from `Theme.ts`: `Radius['3xl']` (28px), `theme.surface`, `theme.cardBorder`, `...Shadows.md`.
   * Refine top row typography, action icons (Eye toggle, Copy, Delete), and pill badges.
   * Smooth animated scale spring on press in/out.

3. **`components/ledger/Tabs.tsx` Refactoring**:
   * Update selector button to use modern rounded card styling with calendar icon badge and down chevron.
   * Ensure modal sheet uses `Radius['4xl']` (32px top corners) with dark mode surface background.

---

**Report Status**: Completed & Verified  
**Next Steps**: Implementer agent can utilize these design tokens, specs, and feature contracts directly.
