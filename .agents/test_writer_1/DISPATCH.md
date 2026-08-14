## Dispatch Assignment — Test Writer 1 (Grade Ledger Test Suite Creation)
Target: c:\Projects\FinScholarApp
Working Directory: c:\Projects\FinScholarApp\.agents\test_writer_1
Original Request: c:\Projects\FinScholarApp\ORIGINAL_REQUEST.md
Scope Document: c:\Projects\FinScholarApp\.agents\orchestrator\PROJECT.md

Task: Write a comprehensive unit and component logic test suite for Grade Ledger features in `__tests__/ledger.test.js`.
Requirements:
1. Cover GWA calculations (Cumulative, Year, Semester for all grading systems `1_IS_BEST`, `5_IS_BEST`, `4_IS_BEST`, `PERCENT`).
2. Cover subject tracking toggles (`toggleGradeTracking`), subject creation defaults (`ensureSubjectExists`), and duplication logic.
3. Cover empty states and edge cases (0 units, missing grades, 0 subjects).
4. Run `npm test` to verify all tests pass.
5. Create `TEST_READY.md` at project root (`c:\Projects\FinScholarApp\TEST_READY.md`) summarizing the test suite coverage and test runner command (`npm test`).

Deliverable:
- Test file `__tests__/ledger.test.js`
- `TEST_READY.md` at root
- Report in `c:\Projects\FinScholarApp\.agents\test_writer_1\handoff.md`
