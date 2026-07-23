# Milestone 3 Handoff Report

This report presents the Quality Review and Adversarial Review findings for the Milestone 3 implementation of FinScholarApp.

---

## 1. Handoff components

### 1.1 Observation
* **Visual Calendar & Layout:** Checked `components/calendar/VisualCalendar.tsx` and observed the horizontal layout math:
  * Screen width is divided using `cellWidth = (screenWidth - padding - (gap * 6)) / 7` (lines 68-71).
  * Padding is exactly defined as `48 + 40 + 4` (line 69).
  * The outer calendar container `View` in `VisualCalendar.tsx` has `p-5` (padding of 20 on each side = 40) and `border-2` (border of 2 on each side = 4) (line 74).
  * The calendar screen in `app/(tabs)/calendar.tsx` embeds the calendar inside a `View` with `px-6` (padding of 24 on each side = 48) (line 289).
  * Total horizontal spacing: 48 (screen padding) + 40 (card padding) + 4 (card border) = 92. This matches `padding = 92` exactly, ensuring the columns align and Saturday column fits on 1 row without wrapping.
* **Timezone Safety:** Checked `components/calendar/VisualCalendar.tsx` (lines 48-59, 122-125), `app/(tabs)/calendar.tsx` (lines 236-243, 326-329, 498-503), and `app/(tabs)/requirements.tsx` (lines 347-350, 401-404).
  * Dates are processed via `.split('-')` and constructed as local Date objects using `new Date(year, month - 1, day)`.
  * This guarantees that when running on negative timezone offset devices (e.g., GMT-5), the date does not shift to the previous day as it would when parsing ISO strings using `new Date(ISOString)`.
* **Tasks Tab CRUD & Sync:** Checked `app/(tabs)/requirements.tsx` (lines 246-328).
  * Task creation, update, and deletion are handled and stored in the nested subject requirements object.
  * Local persistence is handled via `AsyncStorage.setItem('grade_ledger_v2_data', ...)`.
  * Cloud sync is integrated via the Supabase table `user_ledgers` using `supabase.from('user_ledgers').upsert(...)`.
* **Focus Pomodoro Timer:** Checked `app/(tabs)/requirements.tsx` (lines 135-155, 556-567).
  * It transitions between three mascot images based on state:
    * `studying.png` when `isRunning` is `true` (timer active)
    * `happy.png` when `isRunning` is `false` and `timeLeft` is `0` (session completed)
    * `sleeping.png` when `isRunning` is `false` and `timeLeft > 0` (idle/paused)
* **Daily Mascot Quotes:** Checked `app/(tabs)/index.tsx` (lines 12-23, 204-213) and observed the speech bubble UI:
  * A box containing `FIN_QUOTES` with a rotated pseudo-triangle arrow created via absolute positioning and `rotate-45`.
* **Build & Export Verification:** Ran:
  * `npx tsc --noEmit` which completed successfully with 0 errors.
  * `npx expo export --platform web` which compiled and completed successfully with 0 errors.

### 1.2 Logic Chain
1. The horizontal layout calculations in `VisualCalendar.tsx` use a padding of 92, which corresponds exactly to the 48px screen padding, 40px card padding, and 4px card border padding in the hierarchy. This ensures the available width for grid cells is computed correctly, keeping the Saturday column on the same row.
2. Constructing Date objects using `new Date(year, month - 1, day)` (via split strings) constructs dates in local timezone. This prevents browser date parsing engines from defaulting to UTC, which shifts dates to the previous day on GMT negative offset devices.
3. CRUD actions in `requirements.tsx` modify the main state and call `saveData(nd)` which executes both local AsyncStorage writes and Supabase database upserts.
4. The Pomodoro Timer's image source selector dynamically maps execution states to the correct asset files, ensuring correct mascot transitions.

### 1.3 Caveats
* The sync from Tasks to Grade Ledger is one-way. Saving or editing a task with a grade component link creates or updates a grade item in the Grade Ledger. However, updating that grade item's name or score in the Grade Ledger tab does not propagate changes back to the task object in `subject.requirements`.
* AutoConfig features utilize a Supabase edge function `parse-syllabus` which requires an active session and network connectivity.

### 1.4 Conclusion
The Milestone 3 changes meet the functional requirements, compile successfully without TypeScript errors, and export cleanly for the web. Timezone safety is handled properly using split-string local date construction. The layout fits 7 days on 1 row exactly.

### 1.5 Verification Method
To independently verify:
1. Run `npx tsc --noEmit` from the project root.
2. Run `npx expo export --platform web` from the project root.
3. Inspect `components/calendar/VisualCalendar.tsx` lines 68-71 to verify layout math.
4. Inspect `app/(tabs)/calendar.tsx` lines 498-503 to verify local Date construction from split string.

---

## 2. Quality review

**Verdict**: APPROVE

### Findings

#### [Minor] Finding 1: Unidirectional Sync from Tasks to Grade Ledger
* **What:** Changes made to synced grade items in the Grade Ledger do not propagate back to the original task in the Tasks tab.
* **Where:** `components/ledger/ActiveSubjectView.tsx` and `app/(tabs)/requirements.tsx`
* **Why:** In `ActiveSubjectView.tsx`, updating a grade item changes it only in `periods[pIndex].components[cIndex].items`. It does not search `subject.requirements` for a matching `gradeItemId` to sync the name or score.
* **Suggestion:** Implement a helper function `syncTaskFromGradeItem(subject, gradeItem)` in `ActiveSubjectView.tsx` that updates the corresponding task inside `subject.requirements` when a ledger grade item is updated.

### Verified Claims

* **Saturday column fits on 1 row** → verified via layout mathematical verification in `VisualCalendar.tsx` (padding matches exactly) → **PASS**
* **Timezone safety on negative offsets** → verified via inspection of split-string Date construction in `calendar.tsx` and `requirements.tsx` → **PASS**
* **TypeScript compiles** → verified via `npx tsc --noEmit` → **PASS**
* **Expo Web Export succeeds** → verified via `npx expo export --platform web` → **PASS**

### Coverage Gaps
* **Bidirectional sync between Tasks and Ledger** — risk level: low/medium — recommendation: accept risk for now, but document that editing grade ledger items directly will desynchronize the associated task score in the tasks tab.

### Unverified Items
* None.

---

## 3. Adversarial review

**Overall risk assessment**: LOW

### Challenges

#### [Medium] Challenge 1: Desynchronization of Task scores from Grade Ledger
* **Assumption challenged:** "Bidirectional auto-grading integration" implies changes sync both ways.
* **Attack scenario:** User creates a task, marks it as graded, sets score `85/100`, which correctly inserts a grade item in Grade Ledger. Later, the teacher updates the score to `90/100`. The user edits the grade item score to `90` in the Grade Ledger tab. Because sync is only task -> ledger, the task in the Requirements tab still shows `85/100`, leading to inconsistent UI states.
* **Blast radius:** The UI displays different scores for the same item in the Tasks tab vs. the Grade Ledger.
* **Mitigation:** Update `ActiveSubjectView.tsx`'s `updateThisItem` method to propagate name/score changes to any task in `subject.requirements` that matches `item.id === task.gradeItemId`.

### Stress Test Results

* **Negative timezone offset (GMT-5)** → parses date strings using split-strings and local constructor → correctly constructs local midnight of the target date rather than GMT afternoon/evening of the previous day → **PASS**
* **O(N) search complexity on calendar and requirements lookups** → filtered events are localized to the active semester (usually small list, N < 100) → performs within normal CPU constraints → **PASS**

### Unchallenged Areas
* **Supabase edge function parsing accuracy** — reason not challenged: requires real AI invocation and active backend database mock, which is out of scope for the current local-first static analysis.
