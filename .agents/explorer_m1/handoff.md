# Handoff Report: FinScholarApp Codebase Exploration & Implementation Proposal

**Date**: 2026-07-17T13:08:00Z  
**Agent working directory**: `c:\Projects\FinScholarApp\.agents\explorer_m1`

---

## 1. Observation
Below are the exact observations, file paths, line numbers, and tool command execution outputs recorded during the read-only exploration.

### A. Data Storage & Syncing Architecture
- **Local Storage Key**: The application uses `AsyncStorage` with key `'grade_ledger_v2_data'` to store the full curriculum ledger.
- **Supabase Client**: Configured in `services/supabaseClient.js` using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Database Table**: Syncs to a single Supabase table named `user_ledgers`.
  - In `app/(tabs)/academic-manager.tsx` (lines 54-62):
    ```typescript
    await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(newData));
    if (user) {
        await supabase
            .from('user_ledgers')
            .upsert({ 
                id: user.id, 
                ledger_data: newData,
                updated_at: new Date().toISOString()
            });
    }
    ```
  - In `app/(tabs)/grades.tsx` (lines 95-106):
    ```typescript
    await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(newData));
    if (user) {
      setSyncStatus('syncing');
      await supabase.from('user_ledgers').upsert({ id: user.id, ledger_data: newData });
      setSyncStatus('saved');
    }
    ```
  - In `app/(tabs)/schedule.tsx` (lines 126-138) and `app/(tabs)/calendar.tsx` (lines 118-133), similar `upsert` queries to `user_ledgers` targeting the `ledger_data` column are used.

### B. Requirements / Tasks Data Structure
- There are no `.sql` files, database schema files, or other tables referenced for requirements/tasks in the repository.
- `app/(tabs)/requirements.tsx` is a visual stub containing no storage logic:
  ```typescript
  export default function RequirementsScreen() {
      ...
      return (
          <SafeAreaView className={`flex-1 justify-center items-center ${isDark ? 'bg-[#0f172a]' : 'bg-[#f8fafc]'}`}>
              <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Requirements Tracker</Text>
              <Text className={`mt-2 text-center px-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Requirements tracker is currently under construction.
              </Text>
          </SafeAreaView>
      );
  }
  ```
- However, the schedule ticker component in `app/(tabs)/schedule.tsx` (lines 99-106) already expects a `requirements` array to be nested inside subjects:
  ```typescript
  s.subjects?.forEach((sub: any) => {
      if (sub.requirements) {
          allItems.push(...sub.requirements
              .filter((r:any) => r.status !== 'submitted' && r.status !== 'graded')
              .map((r:any) => ({ ...r, isRequirement: true, subjectName: sub.name }))
          );
      }
  });
  ```
- These requirements are expected to have:
  - `status` (string, checked against `'submitted'` and `'graded'`)
  - `date` (string local date)
  - `title` or `name` (string)

### C. Mascot Assets
- Checked the contents of `assets/images/`:
  - `FinDashboard.png` (Used in `app/(tabs)/index.tsx` for the stats card)
  - `FinLogo.png` (Used in `app/login.tsx`)
  - `FinSights.png` (Used in `app/(tabs)/schedule.tsx` and `components/ledger/ActiveSubjectView.tsx`)
  - **Mascots**: The files `happy.png`, `confused.png`, `sleeping.png`, and `studying.png` are in `assets/images/` but are currently unreferenced anywhere in the `.tsx` code files.

### D. Build & Type Verification
- **Bundler Compilation Check**: Running `npx expo export --platform web` succeeded:
  ```
  Starting Metro Bundler
  Web Bundled 14078ms node_modules\expo-router\entry.js (1225 modules)
  › Assets (57):
    assets\images\FinDashboard.87effec32b777fbf47f40026a9e8c14f.png
    assets\images\FinLogo.c150bad56e3b6aaf43cb5bb577b3bf89.png
    assets\images\FinSights.5726a6a07fa785f7549497711de8397f.png
    ...
  Exported: dist
  ```
- **TypeScript Verification Check**: Running `npx tsc --noEmit` failed with 17 compile-time errors. Major errors include:
  - Type assignment conflict: `app/index.tsx` lines 12 and 17:
    `Argument of type 'Session | null' is not assignable to parameter of type 'SetStateAction<null>'.`
  - Unofficial backup file type errors: `temp_active.tsx` line 4:
    `Cannot find module '../../utils/calculator' or its corresponding type declarations.`
  - Invalid type indexing in `components/Themed.tsx` (lines 24, 29).
  - Implicit index signature in `components/schedule/AttendanceTracker.tsx` (lines 408, 409).

---

## 2. Logic Chain
1. Since the application does not have a separate Supabase schema/table for tasks or requirements, and the schedule tab ticker is already written to inspect `sub.requirements` inside the `ledger_data` JSON structure, we can conclude that requirements/tasks are designed to be stored as a nested array inside subjects within the main `ledger_data` object in `user_ledgers`.
2. Storing requirements nested in the JSON payload (Option A) has the advantage of automatically utilizing the existing offline-first sync architecture (AsyncStorage saved locally, upserted to Supabase when online), ensuring zero database migrations, and keeping code changes localized.
3. The mascot images (`happy.png`, `confused.png`, `sleeping.png`, `studying.png`) are in the codebase but unused. They can be integrated into existing screens by rendering them in empty state panels, card headers, or conditional goal metrics.
4. The TypeScript type errors are a mix of legacy backup code (e.g. `temp_active.tsx` at the root which uses a broken relative path) and weak typing on states (e.g. `useState(null)` without generic parameters).

---

## 3. Caveats
- **Supabase Sync Conflicts**: The ledger payload syncing uses a simple `upsert` mechanism. If multiple clients mutate the ledger offline simultaneously, the last writer will overwrite the other's changes.
- **Syllabus Parsing API**: `ActiveSubjectView.tsx` uses a Supabase edge function `parse-syllabus` to automatically extract requirements/milestones from uploaded syllabi. We assume this edge function is already deployed and functional.

---

## 4. Conclusion & Implementation Proposal

### A. Tasks/Requirements Tracker Design Proposal
It is proposed to implement `app/(tabs)/requirements.tsx` (Tasks) by parsing and mutating the `requirements` array inside the active semester's subjects.

#### 1. Data Schema
A Requirement object will have the following structure:
```typescript
interface Requirement {
  id: string;               // Unique string (generateId())
  title: string;            // Name of the task
  description?: string;     // Short description/details
  date: string;             // Due date in 'YYYY-MM-DD' format
  status: 'pending' | 'submitted' | 'graded'; // Task status
  priority: 'low' | 'medium' | 'high';        // Priority
  score?: number;           // Earned score, if graded
  maxScore?: number;        // Maximum score, if graded
  componentId?: string;     // Linked Grade Ledger component ID (optional)
  periodId?: string;        // Linked Grade Ledger period ID (optional)
}
```

#### 2. UI Layout (All 5 Tabs Sync)
- **Top Bar**: Active Year and Semester selector tabs (reusing `components/ledger/Tabs.tsx`).
- **Subject Filters**: Horizontal chip layout filter (e.g., "All Subjects", "MATH 101", etc.).
- **Tasks Grouping**: Group tasks into 3 columns or collapsible groups:
  1. **Pending** (Active/Incomplete)
  2. **Submitted** (Pending Grading)
  3. **Graded** (Completed with score)
- **Adding/Editing Task Modal**: Modal offering fields for Title, Due Date (using Expo DateTimePicker), Priority, Subject, and optional grade integration (letting the user select a target Component from the selected Subject).
- **Auto-grading Integration**: If a task has `componentId` and is moved to `graded`, automatically insert an item under that component in the Grade Ledger with the score and maxScore entered by the user.

---

### B. Mascot Integration Proposal (3 Contextual States)

We will integrate the mascots (`assets/images/`) in these 3 states:

| Context State | Mascot Asset | Implementation Details |
|---|---|---|
| **Empty Term Manager** | `sleeping.png` | In `academic-manager.tsx`, when `data.years.length === 0`, show `sleeping.png` (Fin sleeping) with the caption: *"Fin is taking a nap because there are no academic terms yet. Add a Year to wake him up!"* |
| **Clear Skies / No Tasks** | `studying.png` | In `index.tsx` (Dashboard) inside the "Clear Skies" section, render `studying.png` (Fin happily sitting and reading) with the message: *"No deadlines in sight. Fin is taking it easy!"* |
| **High GWA Achievement** | `happy.png` | In `components/ledger/GwaSummary.tsx` (Grade Ledger), if GWA is in the top tier (e.g., equivalent <= 1.5 for `1_IS_BEST` or percent >= 90%), display `happy.png` with a popup speech bubble: *"Awesome job! Fin is super proud of your grades!"* |
| **Empty Timetable** | `confused.png` | In `schedule.tsx`, when `classes.length === 0`, replace `FinSights.png` with `confused.png` (Fin looking confused) with the message: *"Where are your classes, FinScholar? Scan an image or add classes manually!"* |

---

### C. Build and Type Verification Setup

- **Bundling Verification**:
  ```bash
  npx expo export --platform web
  ```
- **Type Checking**:
  ```bash
  npx tsc --noEmit
  ```

#### Recommended TypeScript Fixes:
1. **`app/index.tsx` (Lines 12 & 17)**:
   Change `const [session, setSession] = useState(null)` to `const [session, setSession] = useState<any>(null)`.
2. **`temp_active.tsx` (Root file)**:
   Delete or move `temp_active.tsx` to `.agents/` as it is a copy-paste backup of `ActiveSubjectView` that breaks root folder type building.
3. **`components/Themed.tsx`**:
   Cast index access string keys as key of styles to avoid `null` and `undefined` index errors.

---

## 5. Verification Method
1. To verify the Expo bundler: run `npx expo export --platform web` in the command prompt. Verify that the build outputs "Exported: dist" without bundling failures.
2. To verify TypeScript checking: run `npx tsc --noEmit` and confirm that type errors are fixed (after applying the recommended type adjustments).
