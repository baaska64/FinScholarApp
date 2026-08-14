## Dispatch Assignment — Reviewer 2 (Feature Parity & Data Integrity Review)
Target: c:\Projects\FinScholarApp
Working Directory: c:\Projects\FinScholarApp\.agents\reviewer_2
Original Request: c:\Projects\FinScholarApp\ORIGINAL_REQUEST.md
Scope Document: c:\Projects\FinScholarApp\.agents\orchestrator\PROJECT.md

Task: Perform feature parity, state flow, and data integrity review of the refactored Grade Ledger code:
- `app/(tabs)/grades.tsx`
- `components/ledger/GwaSummary.tsx`
- `components/ledger/Tabs.tsx`
- `components/ledger/SubjectCard.tsx`

Review Criteria:
1. R4 Feature Parity: Verify Add subject modal/action, toggle grade tracking, selection mode batch delete, single subject delete, duplicate subject, empty states, ActiveSubjectView modal, system settings grading system switcher.
2. State persistence & sync: AsyncStorage `grade_ledger_v2_data` persistence, Supabase sync handlers.
3. Edge case handling: empty semesters, zero units, 0 tracked subjects, blank grade scores.

Deliverable:
- Report with verdict (`APPROVE` or `REQUEST_CHANGES`) in `c:\Projects\FinScholarApp\.agents\reviewer_2\handoff.md`.
