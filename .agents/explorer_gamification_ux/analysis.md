# Flash Study Gamification & UX Investigation Report

**Author:** Gamification & UX Explorer  
**Date:** 2026-08-17  
**Scope:** FinScholarApp Flash Study Tab (`app/(tabs)/flashcards.tsx`, `components/study/*`, `app/study-options.tsx`, `__tests__/study.test.js`)

---

## Executive Summary

This deep-dive investigation evaluated the gamification systems (XP, streaks, daily goals, tiers) and user experience (UX) flows in the newly redesigned Flash Study tab of FinScholarApp.

### Core Findings:
1. **Gamification State & XP Exploits:**
   - **Speed Match XP Inflation Exploit:** Completing a quick 8-pair matching game in ~10 seconds awards 320 XP (`8 * 10 + 8 * 25 + 40`), allowing players to reach Grandmaster Tier (2,000 XP) in ~1 minute of spamming.
   - **Session Completion XP Calculation Disconnect:** In `flashcards.tsx`, `handleRate` invokes `updateStudyStats` per card with `reviewsCount = 1`, resulting in the session completion bonus calculating `Math.max(20, Math.min(100, 1 * 5)) = 20 XP` regardless of whether the user completed 5 cards or 100 cards.
   - **State Persistence Race Condition:** In `saveDecks` (`flashcards.tsx:411`), `flashcardStats` is captured from stale component state closure when updating decks, potentially overwriting recent XP and streak changes saved by `saveStats`.
2. **Streak Mechanics & Display Inconsistencies:**
   - **Inactive Streak Display Bug:** In `StudyDashboardStats.tsx`, `stats.currentStreak` is rendered directly. If a user hasn't studied for multiple days, the dashboard displays their old streak (e.g. `🔥 15 Days Streak`) until they perform a review, at which point it abruptly drops to 1.
   - **No "Streak at Risk" Visual Feedback:** Users are not visually informed whether today's review is completed (streak preserved) or pending (streak expiring at midnight).
3. **Daily Goals & Customization:**
   - Daily Goal is hardcoded to a default of 20 cards in `updateStudyStats` and `StudyDashboardStats.tsx`. There is no UI setting in `app/study-options.tsx` or `flashcards.tsx` to configure personal daily targets.
4. **UX Flow & Navigation Polish:**
   - **Header Settings Button Mismatch:** In `flashcards.tsx:1342`, the top-right settings button routes to `router.push('/(tabs)/profile')` instead of Spaced Repetition settings (`/study-options`), breaking user expectations.
   - **Dashboard Mode Strip Deck Target:** The `StudyModesStrip` on the dashboard launches modes targeting `tree[0]` without providing a deck picker when multiple decks exist.
   - **Card Management Multi-Select:** The card management screen (`view === 'manage'`) has Select, Reverse, and Delete actions, but lacks a "Select All / Deselect All" toggle.

---

## Part 1: Gamification Mechanics Deep Dive

### 1.1 XP System (Gain Rates, Multipliers, Caps, Exploits)

#### A. Review Mode XP Formula
- **Implementation:** `components/study/utils.ts:402-478`
- **Rules:**
  - Card Review: `+10 XP`
  - Card Graduated/Mastered (`interval = 0 -> interval > 0`): `+25 XP`
  - Session Completion Bonus: `Math.max(20, Math.min(100, count * 5))`
- **Flaw in `flashcards.tsx:980-1004`:**
  During SM-2 card reviews, `handleRate` updates stats incrementally per card:
  ```ts
  // flashcards.tsx:982-987
  if (cardIndex + 1 >= sessionCards.length && !shouldRequeue) {
    setSessionDone(true);
    const newStats = updateStudyStats(
      flashcardStats,
      1, // <-- reviewsCount is 1
      justMastered ? 1 : 0,
      true // <-- sessionDone is true
    );
    saveStats(newStats);
  }
  ```
  Because `reviewsCount = 1` is passed, `updateStudyStats` calculates the session bonus as:
  `Math.max(20, Math.min(100, safeReviews * 5)) = Math.max(20, 5) = 20 XP`.
  A user studying a large 50-card deck receives the exact same 20 XP completion bonus as a user reviewing 1 card.
- **Recommended Fix:** Pass `sessionCards.length` as the card count when calculating the session completion bonus.

#### B. Speed Match Game XP Exploit
- **Implementation:** `flashcards.tsx:1176-1182`
  ```ts
  const newStats = updateStudyStats(
    flashcardStats,
    totalPairs, // e.g. 8
    totalPairs, // e.g. 8 (marked as mastered!)
    true
  );
  ```
- **Exploit Dynamics:**
  - Speed Match takes ~10-15 seconds for an 8-pair deck.
  - Passing `totalPairs = 8` as `masteredCount` awards `8 * 25 = 200 XP` in addition to `8 * 10 = 80 XP` and session bonus `40 XP`, totaling **320 XP per 10-second play**.
  - A user playing Match 6 times earns **1,920 XP** in under 2 minutes, bypassing all SM-2 spaced repetition effort to reach Grandmaster tier.
- **Recommended Fix:**
  - Speed Match should reward game engagement appropriately without treating unmatched deck cards as mastered:
    `reviewsCount: Math.min(4, Math.floor(totalPairs / 2))`, `masteredCount: 0`, and a modest game completion bonus (+15 to +25 XP based on speed/moves).

#### C. Practice Test / Quiz XP
- **Implementation:** `flashcards.tsx:1111-1117`
  ```ts
  const newStats = updateStudyStats(
    flashcardStats,
    quizQuestions.length,
    quizScore + (isCorrect ? 1 : 0),
    true
  );
  ```
- **Analysis:**
  - Awards 10 XP per question reviewed + 25 XP per correct question + session bonus.
  - For a 10-question quiz with 100% score: `10*10 + 10*25 + 50 = 400 XP`.
  - While quizzes test recall, correct quiz answers increment `masteredToday` on user stats even though cards are not marked as mastered in SM-2 intervals.
- **Recommendation:** Keep quiz XP rewarding (e.g. 10 XP per question + 15 XP bonus for correct answers), but separate `masteredToday` from quiz correct answers to preserve deck mastery metric integrity.

#### D. State Management & Dropped Stats Race Condition
- **Implementation:** `flashcards.tsx:409-415` & `flashcards.tsx:945-1004`
- **Mechanism:**
  ```ts
  // flashcards.tsx:409
  const saveDecks = async (newDecks: FlashcardDeck[]) => {
    ...
    const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
    const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
    ledger.flashcards = { decks: newDecks, settings: srSettings, stats: flashcardStats }; // <-- captures stale closure
    await SyncService.pushLocalChanges(ledger);
  };
  ```
  When `handleRate` runs, `saveDecks(nd)` is called, and immediately `saveStats(newStats)` is called. If `saveDecks` is invoked during card updates or deck edits, it writes the component closure's `flashcardStats`. If `saveDecks` finishes after `saveStats`, newly earned XP/streaks can be overwritten with old state.
- **Recommended Fix:** Always pass `stats` explicitly or merge existing `ledger.flashcards.stats` in `saveDecks` without overwriting with stale closure state:
  `stats: ledger.flashcards?.stats || flashcardStats`.

---

### 1.2 Streak System (Increment Rules, Timezones, Loss Prevention)

#### A. Timezone & Date Calculations
- **Implementation:** `components/study/utils.ts:65-71, 429-442`
- **Strengths:**
  - `getLocalDateString()` uses local `getFullYear()`, `getMonth() + 1`, and `getDate()`, preventing UTC date boundary bugs where users studying late at night lose streaks.
  - `weeklyHistory` retains 60 days of unique date strings with bounded memory retention (`components/study/utils.ts:460-468`).

#### B. Inactive Streak Display Bug
- **Implementation:** `components/study/StudyDashboardStats.tsx:44-93`
- **Observation:**
  - In `StudyDashboardStats.tsx`: `const streak = Math.max(0, stats.currentStreak || 0);`
  - If a user achieved a 14-day streak on Monday, and opens the app on Friday without studying, `stats.currentStreak` in database is still `14`.
  - The dashboard displays `🔥 14 Days Streak`!
  - When the user finally reviews a card on Friday, `updateStudyStats` detects `lastStudyDate !== yesterdayStr`, resetting streak to `1`.
  - **UX Issue:** The user sees a 14-day streak, studies 1 card expecting it to become 15, and watches it drop to 1.
- **Recommended Fix:**
  Compute effective streak for display:
  ```ts
  const todayStr = getLocalDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  const isStreakActive = stats.lastStudyDate === todayStr || stats.lastStudyDate === yesterdayStr;
  const displayStreak = isStreakActive ? (stats.currentStreak || 0) : 0;
  ```

#### C. Streak Loss Prevention & Visual State
- **Status Today Indicator:**
  - If `stats.lastStudyDate === todayStr`: Streak is safe for today (`🔥 5 Days · Done today`).
  - If `stats.lastStudyDate === yesterdayStr`: Streak is active but expiring (`⚡ 5 Days · Review today to keep!`).
  - If `stats.lastStudyDate < yesterdayStr`: Streak is inactive (`⚡ 0 Days · Start a new streak!`).

---

### 1.3 Daily Goals (Target Tracking & Reset Logic)

#### A. Target Tracking & Reset
- **Implementation:** `components/study/utils.ts:444-478` & `components/study/StudyDashboardStats.tsx:37-45`
- **Logic:**
  - Tracks `cardsReviewedToday` and `dailyGoal` (default 20).
  - When `lastStudyDate !== todayStr`, `cardsReviewedToday` resets to 0.
  - Progress percentage is clamped: `Math.min(100, Math.max(0, Math.round((cardsReviewedToday / dailyGoal) * 100)))`.
  - Highlighting: Turns gold with trophy icon when 100% reached (`StudyDashboardStats.tsx:206-237`).

#### B. Missing Daily Goal Customization
- **Issue:** Neither `app/study-options.tsx` nor `flashcards.tsx` provides a field or slider for users to change their daily goal from 20 to their preferred target (e.g. 10, 30, 50).
- **Recommendation:** Add a `Daily Goal (Cards/Day)` input field to `app/study-options.tsx` and sync it with `flashcardStats.dailyGoal`.

---

### 1.4 Scholar Tiers & Leveling

#### A. Thresholds & Title Progression
- **Implementation:** `components/study/utils.ts:345-400`
- **Tiers:**
  | Level | Tier Title | Badge | Min XP | XP Span |
  |---|---|---|---|---|
  | **1** | Novice Scholar | 🥉 | 0 | 100 |
  | **2** | Apprentice Scholar | 🥈 | 100 | 150 |
  | **3** | Scholar | 🥇 | 250 | 250 |
  | **4** | Senior Scholar | 💎 | 500 | 500 |
  | **5** | Master Scholar | 👑 | 1000 | 1000 |
  | **6** | Grandmaster Scholar | 🏆 | 2000 | Max |

#### B. Boundary & Max Level Behavior
- Max level (Lv 6, 2000+ XP) sets `isMaxLevel: true`, `progress: 1.0`, and displays `"Max Level Achieved 🏆"`.
- XP earned and required calculations are protected against division-by-zero and non-finite numbers.

---

## Part 2: Usability & UX Polish Deep Dive

### 2.1 Navigation & Screen Routing

```
[ Flashcards Dashboard (view === 'decks') ]
    │
    ├── Top Bar Settings Icon ──> ⚠️ Routes to '/(tabs)/profile' (Bug: should route to '/study-options')
    ├── "Study Options" Card  ──> Routes to '/study-options'
    ├── "Study Modes Strip"   ──> Launches mode on tree[0]
    │
    ├── Tap DeckCard ──────────> [ Deck Detail (view === 'detail') ]
    │                                │
    │                                ├── Study Modes (Flashcards, Spaced Rep, Match, Quiz, Exam)
    │                                ├── Cards List (with search, filter tabs, edit/delete)
    │                                └── Bottom CTA "Study Deck" ──> [ Study Session (view === 'study') ]
    │
    ├── Quick Study CTA ───────> [ Study Session (view === 'study') ]
    ├── Long Press / Ellipsis ──> Action Sheet (Study, Ahead, Exam, Subdeck, Manage, Edit, Move, Delete)
    └── FAB / "+" Button ───────> Create Sheet Modal (New Deck / New Folder)
```

### 2.2 Critical UX Friction Points Identified

| # | Friction Point | Location | Description & Impact | Recommended Polish |
|---|---|---|---|---|
| **1** | Header Settings Button Misroute | `flashcards.tsx:1342` | Header settings button navigates to `/(tabs)/profile` instead of Study Options (`/study-options`), confusing users looking for SM-2 intervals. | Change `router.push('/(tabs)/profile')` to `router.push('/study-options')`. |
| **2** | Dashboard Study Mode Launcher Target | `flashcards.tsx:1195-1222` | When tapping an activity in `StudyModesStrip` on the dashboard, it immediately selects `tree[0]`. If a user has multiple decks, they cannot choose which deck to quiz/match without opening deck detail first. | If `decks.length > 1`, show a quick deck selection sheet or default to all due cards. |
| **3** | Card Management Missing "Select All" | `flashcards.tsx:2930-2973` | In card selection mode (`view === 'manage'`), users must tap every card individually to bulk delete or reverse. | Add a "Select All" / "Deselect All" button next to "Reverse" and "Delete". |
| **4** | Missing Daily Goal Setting in Options | `app/study-options.tsx` | Screen only configures learning steps and intervals. Users cannot configure their daily cards goal. | Add Daily Goal numeric input (e.g. 5–100 cards) in `study-options.tsx`. |
| **5** | Session Summary XP Clarity | `flashcards.tsx:2209-2240` | Session complete screen displays Accuracy, Mastered, and Streak, but does not explicitly show XP earned in that session. | Add a "+XP Earned" metric tile in the session analytics card. |
| **6** | Stale Stats Storage Overwrite | `flashcards.tsx:411` | `saveDecks` packages `flashcardStats` from component state closure, which can overwrite recent `saveStats` changes during quick study interactions. | Ensure `saveDecks` preserves `ledger.flashcards?.stats` from database if not updating stats. |

---

## Part 3: Concrete Proposed Code Adjustments

### Proposed Fix 1: Header Settings Routing & Daily Goal in Study Options
- **Target:** `app/(tabs)/flashcards.tsx:1342`
  ```tsx
  // Before:
  <TouchableOpacity
    onPress={() => router.push('/(tabs)/profile')}
    ...
  >

  // After:
  <TouchableOpacity
    onPress={() => router.push('/study-options')}
    ...
  >
  ```

### Proposed Fix 2: Session XP Calculation Scaling in `handleRate`
- **Target:** `app/(tabs)/flashcards.tsx:980-988`
  ```tsx
  // Before:
  const newStats = updateStudyStats(
    flashcardStats,
    1,
    justMastered ? 1 : 0,
    true
  );

  // After:
  const newStats = updateStudyStats(
    flashcardStats,
    sessionCards.length,
    justMastered ? 1 : 0,
    true
  );
  ```

### Proposed Fix 3: Speed Match Game XP Balancing
- **Target:** `app/(tabs)/flashcards.tsx:1176-1182`
  ```tsx
  // Before:
  const newStats = updateStudyStats(
    flashcardStats,
    totalPairs,
    totalPairs,
    true
  );

  // After:
  const newStats = updateStudyStats(
    flashcardStats,
    Math.min(4, Math.floor(totalPairs / 2)),
    0, // match game does not graduate deck cards
    true
  );
  ```

### Proposed Fix 4: Effective Streak Display in `StudyDashboardStats.tsx`
- **Target:** `components/study/StudyDashboardStats.tsx:44-46`
  ```tsx
  // Before:
  const streak = Math.max(0, stats.currentStreak || 0);

  // After:
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  const isStreakLive = stats.lastStudyDate === todayStr || stats.lastStudyDate === yesterdayStr;
  const streak = isStreakLive ? Math.max(0, stats.currentStreak || 0) : 0;
  const isStudiedToday = stats.lastStudyDate === todayStr;
  ```

### Proposed Fix 5: Multi-Select "Select All" in Card Management
- **Target:** `app/(tabs)/flashcards.tsx:2940-2972`
  Add a `Select All` handler when `isSelectionMode` is active:
  ```tsx
  const handleSelectAll = (allIds: string[]) => {
    if (selectedCardIds.size === allIds.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(allIds));
    }
  };
  ```

---

## Part 4: Verification & Test Coverage Summary

- Automated tests in `__tests__/study.test.js` cover:
  - SM-2 engine step advances, ease factor bounds [1.3, 4.0], intervals.
  - Deck tree nesting and recursive statistics.
  - Gamification level mappings, XP gain, streak rollover, 60-day history retention.
  - CSV/TSV/Pipe import parsers and RFC-4180 quotes.
  - Exam prep spacing algorithms and monotonicity.
- TypeScript check (`npx tsc --noEmit`) passes cleanly with 0 type errors.
- Test runner (`npm test`) passes 256/256 tests across 77 suites.
