## 2026-08-08T10:39:27Z

## Dispatch Assignment — Worker M3 (Main Screen Integration & Feature Parity)
Target: c:\Projects\FinScholarApp
Working Directory: c:\Projects\FinScholarApp\.agents\worker_m3
Original Request: c:\Projects\FinScholarApp\ORIGINAL_REQUEST.md
Scope Document: c:\Projects\FinScholarApp\.agents\orchestrator\PROJECT.md

Exclusive Write Ownership:
- `app/(tabs)/grades.tsx`

Requirements (R3 & R4):
1. **Main Screen UI Integration (R3)**:
   - Integrate redesigned `GwaSummary`, `Tabs`, `SubjectCard`, and empty states into `app/(tabs)/grades.tsx`.
   - Refactor screen background, scroll view padding, header actions bar (Pro badge, Settings icon, Edit Mode toggle, Add Subject pill button).
   - Refactor Edit Mode selection bar (Select All, Delete Selected count badge, Cancel button) with pill buttons and soft drop shadows (`Shadows.md`).
   - Refactor empty state cards (No subjects added, No tracked subjects) with rounded surfaces (`Radius['2xl']`), soft drop shadows, and pill CTA buttons.

2. **Feature Parity (R4)**:
   - Ensure ALL existing features work flawlessly:
     - Add Subject modal (`handleAddSubject`, `ensureSubjectExists`).
     - Toggle grade tracking (`handleToggleTracking`).
     - Selection mode / batch delete (`handleDeleteSelected`).
     - Single subject delete (`handleDeleteSubject`).
     - Duplicate subject (`handleDuplicateSubject`).
     - ActiveSubjectView tree editor detail modal opening.
     - System settings grading system modal switcher.
     - Cloud sync status & AsyncStorage persistence (`saveData`).

3. **Verification**:
   - Run `npx tsc --noEmit` and `npm test`. Ensure 0 compilation errors in `app/(tabs)/grades.tsx` and all tests pass.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Deliverable:
- Refactored `app/(tabs)/grades.tsx`
- Report in `c:\Projects\FinScholarApp\.agents\worker_m3\handoff.md`
