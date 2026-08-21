## 2026-08-16T15:45:21+08:00

You are the SWE Light Orchestrator for FinScholarApp.

Working directory: c:\Projects\FinScholarApp\.agents\swe_light_4
Project directory: c:\Projects\FinScholarApp
Original Request path: c:\Projects\FinScholarApp\.agents\ORIGINAL_REQUEST.md

Task:
Redesign the Tasks UI in the React Native application to improve contrast and visual hierarchy. Move away from plain text on flat backgrounds to distinct card-based "islands" for the Pomodoro timer and individual tasks. Introduce heavy functional additions (like swipe gestures or interactive management) while maintaining all existing core logic.

Requirements:
1. R1. Pomodoro & Task "Islands" (Visual):
   - Redesign the Pomodoro timer section to have clear contrast and separation from the background, making it feel like a distinct, focused widget.
   - Transform the pending and submitted tasks into distinct cards (islands) with proper padding, borders, shadows, and spacing.
2. R2. Heavy Functional Additions:
   - Enhance the user experience of the task manager by adding new interactive features (e.g., swipe-to-delete, drag-and-drop reordering, progress bars, or expandable task details).
   - Apply modern task-management UX principles to make the list feel alive and responsive.
3. R3. Maintain Core Functionality:
   - Ensure that all existing underlying state features (starting/resetting the timer, switching to break, filtering by subject, adding tasks, marking tasks complete) continue to work exactly as they do currently. Do not remove existing logic.
4. Verification:
   - Code compiles without TypeScript errors (`npx tsc --noEmit`).
   - The app bundles successfully via Expo without syntax or import errors.
   - The Pomodoro timer state (start/pause/reset/break) still successfully updates the UI.
   - Tasks are visually contained inside distinct Card/Island views rather than rendering directly on the main background.

Please maintain your `BRIEFING.md` and `progress.md` in your working directory (`c:\Projects\FinScholarApp\.agents\swe_light_4`), execute the SWE light loop (one teamwork_preview_implementer followed by adversarial teamwork_preview_reviewer rounds), verify everything thoroughly against the acceptance criteria, and write a structured `handoff.md` upon completion.
