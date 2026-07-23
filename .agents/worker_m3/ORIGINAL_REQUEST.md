## 2026-07-17T13:16:11Z
You are the teamwork_preview_worker for Milestone 3.
Your working directory is: c:\Projects\FinScholarApp\.agents\worker_m3
Your identity is: teamwork_preview_worker

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please implement the following tasks for Milestone 3:

1. Fix Calendar & Timezone Bugs:
   - In `components/calendar/VisualCalendar.tsx`, fix the padding math in `cellWidth` to account for screen padding (48px) + card padding p-5 (40px) + card border-2 (4px) = 92px total padding. Use `const padding = 48 + 40 + 4;` to prevent the Saturday column from wrapping.
   - In `components/calendar/VisualCalendar.tsx` and `app/(tabs)/calendar.tsx`, fix the timezone offset bug. Normalize all event/milestone date comparisons to timezone-agnostic string slice comparisons (using YYYY-MM-DD format directly). Do NOT use `toLocaleDateString()` on dates constructed via UTC or local time zones, as this causes event dates to shift back in negative timezones.
   - Construct the ISO date string manually when a day cell is pressed in `VisualCalendar.tsx` using `currentDate.getFullYear()`, `currentDate.getMonth()`, and the day index to ensure it is timezone-independent.
   - In `app/(tabs)/calendar.tsx`'s Day Details modal date header, parse the `"YYYY-MM-DD"` date string as local midnight (numerical construction `new Date(year, month, day)`) before calling `.toLocaleDateString()` so it prints the correct day rather than shifting back.

2. Port "Tasks/Requirements" Feature:
   - Redesign `app/(tabs)/requirements.tsx` to be a functional Tasks tracker.
   - Re-use the active Year/Semester selector (mirroring `components/ledger/Tabs.tsx`) to filter subjects for the current term.
   - Load the list of subjects in the current semester and display a horizontal filter of chips (e.g. "All Subjects", "MATH 101", etc.).
   - Group tasks into columns or collapsible lists based on status: `pending`, `submitted`, `graded`.
   - Implement Add / Edit / Delete task capabilities:
     * Fields: Title, description, due date (use expo datetimepicker), priority ('low', 'medium', 'high'), subject (must select a subject), and optional Grade Ledger integration.
     * For Grade Ledger integration, allow linking the task to a specific Component (e.g. "Quizzes", "Exams") under the selected subject's grading periods.
   - Auto-grading integration: If a task has a linked Component and its status is updated to `graded`, prompt/allow the user to enter their earned score and max score. Automatically insert a new grade item inside that subject's Component in the main `ledger_data` structure with the title, score, and max score.
   - Save all task modifications back into the subject's nested `requirements` array in the main `ledger_data` JSON payload. Call the existing local and Supabase saving pipeline (`saveAndSync`) so it natively supports offline saving and online Supabase syncing!

3. Autonomous Companion Features:
   - **Daily Quote from Fin**: On the Dashboard (`app/(tabs)/index.tsx`), render a speech bubble from Fin showing a randomized academic/encouraging quote that changes daily or on refresh.
   - **Fin's Focus Pomodoro Timer**: In `app/(tabs)/requirements.tsx` (Tasks tab), add a cute Pomodoro focus timer widget. When active, show Fin studying (`studying.png`) with a running countdown. When paused/done, show Fin in `sleeping.png` or `happy.png` with a celebration.

4. Build & Type Verification:
   - Run type-checking command: `npx tsc --noEmit` and confirm it passes with 0 errors.
   - Run bundling verification command: `npx expo export --platform web` to ensure the project bundles successfully.

Write a complete report of your changes in `c:\Projects\FinScholarApp\.agents\worker_m3\handoff.md`. Once complete, send a message to the orchestrator (conversation ID: 47b29704-55dd-45d1-9aef-0bde8b6a5344) reporting completion and including the path to your handoff.md.
