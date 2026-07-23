## 2026-07-17T13:20:56Z
You are the teamwork_preview_worker for Milestone 4.
Your working directory is: c:\Projects\FinScholarApp\.agents\worker_m4
Your identity is: teamwork_preview_worker

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please implement the following tasks for Milestone 4:

1. Resolve the Auto-Grading Component Shifting Bug:
   - In `app/(tabs)/requirements.tsx`, locate the `syncGradeItem` function.
   - The current implementation skips the cleanup pass to remove stale items if `task.status === 'graded'` and `task.linkedComponentId` is truthy, causing duplicates when a task's linked component is shifted.
   - Fix this by always running a complete cleanup pass across all periods and components of the subject to filter out any grade items with `it.id === task.gradeItemId` BEFORE inserting/updating it in the target component.

2. Resolve the Positive Timezone Date Shift Bug:
   - In `app/(tabs)/calendar.tsx` and `app/(tabs)/requirements.tsx`, locate all instances where `toISOString().split('T')[0]` is used to format selected date strings (e.g. lines that format date values from state or forms).
   - In positive timezone offsets (ahead of UTC), converting local midnight to UTC shifts the calendar date back by one day.
   - Replace these instances with local formatting:
     ```typescript
     const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
     ```

3. Run Verification Tests:
   - In the command line, run the Challenger's programmatic test scripts to verify the codebase's functionality and that the bugs are fully resolved:
     * Basic features: `node c:\Projects\FinScholarApp\.agents\challenger_m3\challenge_tests.js`
     * Component shifting grade sync: `node c:\Projects\FinScholarApp\.agents\challenger_m3\sync_bug_test.js`
     * Timezone safety: `node c:\Projects\FinScholarApp\.agents\challenger_m3\timezone_test.js`
     Ensure that all three tests pass successfully.
   - Run the type-checking command: `npx tsc --noEmit` and confirm it passes with 0 errors.
   - Run bundling verification command: `npx expo export --platform web` to ensure bundling succeeds.

Write a complete report of your changes in `c:\Projects\FinScholarApp\.agents\worker_m4\handoff.md`. Once complete, send a message to the orchestrator (conversation ID: 47b29704-55dd-45d1-9aef-0bde8b6a5344) reporting completion and including the path to your handoff.md.
