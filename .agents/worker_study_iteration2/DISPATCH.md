## 2026-08-17T14:39:36Z
You are the Study Implementation Worker for Iteration 2 of FinScholarApp.
Your working directory is: c:\Projects\FinScholarApp\.agents\worker_study_iteration2
Original Request path: c:\Projects\FinScholarApp\.agents\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Issue Identified by Reviewer 1:
In `app/(tabs)/flashcards.tsx`, `handleRate` was calling `updateStudyStats(..., sessionCards.length, ..., true)` on the final card of a review session. Because intermediate cards (0 to N-2) each already called `updateStudyStats(..., 1, ..., false)` to add 1 review (+10 XP) each, passing `sessionCards.length` on the last card added `sessionCards.length` to `cardsReviewedToday` and `sessionCards.length * 10` review XP again, causing double-counting (e.g. 10 cards resulted in 19 cards recorded as reviewed today and +240 XP instead of +150 XP).

Task:
1. In `components/study/utils.ts`:
   - Update `updateStudyStats`:
     ```ts
     export function updateStudyStats(
       currentStats: FlashcardStats | undefined,
       reviewsCount: number = 0,
       masteredCount: number = 0,
       sessionDone: boolean = false,
       sessionTotalCards?: number
     ): FlashcardStats
     ```
   - Calculate `completionBonus = sessionDone ? Math.max(20, Math.min(100, (sessionTotalCards ?? safeReviews) * 5)) : 0;`
   - Calculate `xpGained = safeReviews * 10 + safeMastered * 25 + completionBonus;`
   - Increment `cardsReviewedToday += safeReviews;`

2. In `app/(tabs)/flashcards.tsx`:
   - In `handleRate`, when `cardIndex + 1 >= sessionCards.length && !shouldRequeue`:
     Call `updateStudyStats(statsRef.current || flashcardStats, 1, justMastered ? 1 : 0, true, sessionCards.length)`.
     This cleanly records 1 review for the final card, adds the session completion bonus scaled by `sessionCards.length`, and avoids double-counting.

3. In `__tests__/study.test.js`:
   - Update Suite 26/28 test cases to verify step-by-step incremental card review through an entire session (e.g., 10 cards rated one-by-one), verifying that `cardsReviewedToday` equals exactly 10 and `totalXp` is exactly 150 (10*10 review XP + 50 session completion bonus).

4. Verification:
   - Run `npx tsc --noEmit` (must pass with 0 errors).
   - Run `npm test` (all test suites must pass).

Document your changes and verification output in:
`c:\Projects\FinScholarApp\.agents\worker_study_iteration2\changes.md` and `c:\Projects\FinScholarApp\.agents\worker_study_iteration2\handoff.md`.
Update `progress.md` in your directory.
Send a message to parent when complete.
