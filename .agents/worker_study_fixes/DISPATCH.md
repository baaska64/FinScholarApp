## 2026-08-17T14:23:04Z

You are the Study Implementation Worker for FinScholarApp.
Your working directory is: c:\Projects\FinScholarApp\.agents\worker_study_fixes
Original Request path: c:\Projects\FinScholarApp\.agents\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission is to implement the fixes and usability enhancements for Milestones 1 and 2 in the Flash Study tab:

1. **Header Settings Button Routing (`app/(tabs)/flashcards.tsx`)**:
   - Update line ~1342: When tapping the settings button, route to `/study-options` (not `/(tabs)/profile`).

2. **Session Completion XP Scaling (`app/(tabs)/flashcards.tsx`)**:
   - In `handleRate`, when `cardIndex + 1 >= sessionCards.length && !shouldRequeue`, pass `sessionCards.length` as `reviewsCount` when `sessionDone = true` to `updateStudyStats`, ensuring proper XP completion scaling based on session size.

3. **Speed Match Balancing & Live Timer (`app/(tabs)/flashcards.tsx`)**:
   - In `handleMatchComplete`, fix the XP exploit by passing `0` as `masteredCount` (e.g. `updateStudyStats(flashcardStats, totalPairs, 0, true)`). Speed Match pairs are matching game rounds, not graduated SM-2 cards.
   - Add a live running elapsed seconds ticker during Speed Match gameplay in `renderMatch` (updating every second while game is active and `!matchWon`).

4. **Stale Closure State Race Prevention (`app/(tabs)/flashcards.tsx`)**:
   - In `saveDecks`, ensure `flashcardStats` is kept fresh (e.g., maintain `statsRef` or ensure latest state is saved) so saving decks does not overwrite recently incremented stats/XP.

5. **Quiz Mode Distractor Deduplication (`app/(tabs)/flashcards.tsx`)**:
   - In `handleStartQuiz`, ensure distractors are filtered/deduplicated by text value (using `Set` or unique strings) so duplicate answer choices never appear in the 4-choice quiz when decks have duplicate answer terms.

6. **Card Management & Folder Actions UX (`app/(tabs)/flashcards.tsx`)**:
   - Add "Select All / Deselect All" toggle in `renderManage` when `isSelecting` is active.
   - In `renderDetail`: When viewing a folder (`activeNode.deck === null`), resolve the card's owning deck via `card.deckId` from `decks` so the edit card pencil modal and delete card buttons work seamlessly directly from folder card lists.
   - Add Deck Export capability via `Share.share` in `showDeckActions` to export cards as formatted CSV/text.

7. **Dashboard Live Streak Liveliness (`components/study/utils.ts` & `components/study/StudyDashboardStats.tsx`)**:
   - Add/export `isStreakLive(lastStudyDate?: string, todayStr?: string, yesterdayStr?: string): boolean` in `components/study/utils.ts`.
   - In `StudyDashboardStats.tsx`, use `isStreakLive` to check if `stats.lastStudyDate` is today or yesterday; if streak has lapsed, render `0` active streak.

8. **Daily Goal Configuration in `app/study-options.tsx`**:
   - Add a Daily Goal selector/stepper (e.g., 5, 10, 15, 20, 30, 50 cards) in `app/study-options.tsx`, persisting to settings and updating stats daily goal.

9. **Verification**:
   - Run `npx tsc --noEmit` (must pass with 0 errors).
   - Run `npm test` / `node scripts/run-tests.js` (all 77 test suites must pass).

Document all your changes, exact line diffs, and verification command outputs in:
`c:\Projects\FinScholarApp\.agents\worker_study_fixes\changes.md` and `c:\Projects\FinScholarApp\.agents\worker_study_fixes\handoff.md`.
Update `progress.md` in your directory regularly.
When complete, send a message to parent with your handoff report.
