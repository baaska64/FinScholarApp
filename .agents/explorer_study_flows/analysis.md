# Deep Technical Analysis: Flash Study Tab & Core Study Flows

**Author:** Study Flows Explorer  
**Date:** 2026-08-17  
**Target Repository:** `FinScholarApp`  
**Components Analyzed:** `app/(tabs)/flashcards.tsx`, `app/study-options.tsx`, `components/study/*`, `__tests__/study.test.js`

---

## Executive Summary

The Flash Study system in **FinScholarApp** has been engineered around an SM-2 spaced repetition engine, hierarchical deck organization (`::` path notation), multi-mode study activities (Classic Flashcards, Spaced Review, Speed Match Game, Practice Test Quiz, and Cepeda-based Exam Prep), and gamification momentum tracking (streaks, daily goals, XP leveling, scholar tiers).

This deep technical investigation evaluated all 5 core study flows across:
1. **Deck creation & editing** (custom cards, hierarchical tree, tags, import/export, batch operations).
2. **Spaced Repetition Review** (SM-2 learning steps, ease factor calculations, ratings 1-4, interval previews, session completion).
3. **Speed Match Game** (pair generation, tap matching logic, rapid-tap concurrency guards, timer and scoring).
4. **Exam Prep Schedule** (Cepeda et al. 2008 spaced schedule, cram mode for <= 1 day, expanding intervals, custom overrides).
5. **Quiz Mode** (distractor generation, lettered MCQ options, immediate feedback, score tracking, retry missed terms).

---

## 1. Architecture of the Study Tab

### 1.1 Component & Store Hierarchy

```
app/(tabs)/flashcards.tsx (Main Flash Study Hub)
├── StudyDashboardStats (Streak, XP, Level, 4-Metric Grid, Mon-Sun Activity, Hero Banner)
├── StudyModesStrip (Flashcards, Spaced Rep, Speed Match, Practice Test, Exam Prep)
├── DeckTreeItem (Hierarchical Tree Nodes / Folder Containers)
│   └── DeckCard (Top-level Single Deck Card with Progress, Tags, Badges)
├── FlipCard (3D perspective spring flip card component)
├── Modals & Sheets:
│   ├── CreateSheet (New Deck vs New Folder selector)
│   ├── AddDeckModal (Name, Subject Tag, 8 Accent Colors, 16 Deck Icons)
│   ├── AddCardModal (Question Front, Answer Back, Reverse swap)
│   ├── ImportModal (File picker & text paste: comma, semicolon, pipe, tab)
│   ├── ExamPrepModal (Exam date picker, auto/manual frequency, schedule preview)
│   └── MoveDeckModal (Folder tree reassignment)
└── Sub-Views:
    ├── 'decks' (Dashboard & Tree)
    ├── 'detail' (Deck Overview, Mode launcher, Card list & filters)
    ├── 'study' (Active Flip Card Session & Post-session Analytics)
    ├── 'manage' (Deck Management, Multi-select, Batch delete/reverse)
    ├── 'quiz' (MCQ Practice Test & Missed terms review)
    └── 'match' (16-tile Speed Match Grid Game)
```

### 1.2 Data Persistence & Models (`components/study/types.ts`)

Data is persisted in AsyncStorage under the key `grade_ledger_v2_data` within `flashcards`:
```typescript
{
  flashcards: {
    decks: FlashcardDeck[],
    settings: SRSettings,
    stats: FlashcardStats
  }
}
```

Key interfaces:
- **`Flashcard`**: `id`, `front`, `back`, `interval` (days), `easeFactor` (1.3 - 4.0), `nextDue` (timestamp ms), `reviewCount`, `stepIndex` (learning step).
- **`FlashcardDeck`**: `id`, `name`, `subject`, `color`, `icon`, `coverStyle`, `createdAt`, `cards: Flashcard[]`.
- **`DeckNode`**: `name`, `fullPath`, `deck: FlashcardDeck | null`, `children: Map<string, DeckNode>`.
- **`SRSettings`**: `learningSteps` (e.g. `'1 10'`), `graduatingInterval` (days), `easyInterval` (days), `studyTimeHour`, `studyTimeMinute`.
- **`FlashcardStats`**: `lastStudyDate` ('YYYY-MM-DD'), `currentStreak`, `masteredToday`, `totalXp`, `dailyGoal`, `cardsReviewedToday`, `weeklyHistory` (60-day bounded array).

---

## 2. Core Flow Investigations & Findings

### 2.1 Deck Creation & Editing Flow

#### Implementation Traced:
- **Deck Creation (`openAddDeck`, `handleSaveDeck` in `app/(tabs)/flashcards.tsx:504-560`):**
  - Users create root decks or nested decks using `::` notation (e.g. `Biology::Genetics::Chapter 1`).
  - `buildDeckTree()` in `components/study/utils.ts:187-237` recursively parses paths into a deterministic tree sorted alphabetically.
  - Supports custom accent colors (`DECK_COLORS`) and icons (`DECK_ICONS` or auto-detection via `getDeckThematicIcon`).
- **Deck Duplication (`handleDuplicateDeck` in `app/(tabs)/flashcards.tsx:650-662`):**
  - Generates new UUIDs for the deck and every duplicated card, preventing ID collision.
- **Deck Relocation (`handleMoveDeck`, `confirmMoveDeck` in `app/(tabs)/flashcards.tsx:664-707`):**
  - Updates path segments and re-links parent `subject` and child `name` correctly.
- **Batch Card Operations (`handleBulkDelete`, `handleBulkReverse` in `app/(tabs)/flashcards.tsx:835-891`):**
  - Multi-select mode allows bulk deletion and front/back swapping.

#### Discovered Observations & Edge Cases:
1. **Flashcard Export Missing (UX / Feature Gap):**
   - *Observation:* While `ImportModal` (`flashcards.tsx:3372`) supports importing via CSV, TXT, pipe, tab, and semicolon with auto-detection, there is no corresponding **Export Deck** option (to CSV, JSON, or clipboard) in `showDeckActions` or `renderManage`.
   - *Fix Proposal:* Add an `Export Deck` option in `showDeckActions` that serializes `deck.cards` to standard RFC-4180 CSV or formatted text and triggers sharing/clipboard copying.
2. **Card Edit/Delete in Folder Detail View vs Single Deck Detail View:**
   - *Observation:* In `renderDetail` (`flashcards.tsx:2089`), card action buttons (pencil/trash) are conditionally rendered as `{deck && ...}`. When viewing a folder (`activeNode.deck === null`), cards collected from child decks are displayed, but the pencil and trash buttons are hidden. In `renderManage` (`flashcards.tsx:2976`), cards under folders are grouped by deck and can be edited.
   - *Fix Proposal:* In `renderDetail`, lookup each card's parent deck via `card.deckId` (`const cardDeck = decks.find(d => d.id === card.deckId)`), allowing card editing/deletion even in folder view.
3. **Empty Folder Name in Create Sheet:**
   - *Observation:* Tapping "New Folder" in `CreateSheet` (`flashcards.tsx:3137`) pre-fills `::`. If a user submits without changing it, `buildDeckTree` assigns fallback `'Untitled Deck'`.
   - *Fix Proposal:* Add validation in `handleSaveDeck` to reject bare `::` or sanitize leading/trailing separators.

---

### 2.2 Spaced Repetition Review (SM-2 Engine) Flow

#### Implementation Traced:
- **Algorithm (`applyRating` in `components/study/utils.ts:92-170`):**
  - **Learning Phase (`interval === 0`):**
    - Rating 1 (Again): `stepIndex = 0`, due in `steps[0]` min (e.g. 1m), easeFactor -= 0.2.
    - Rating 2 (Hard): `stepIndex` unchanged, due in `steps[stepIndex]` min (e.g. 1m), easeFactor -= 0.15.
    - Rating 3 (Good): `stepIndex += 1`. If `stepIndex >= steps.length`, graduates with `interval = graduatingInterval` (default 1 day); else due in `steps[stepIndex]` min.
    - Rating 4 (Easy): Graduates immediately with `interval = easyInterval` (default 4 days), easeFactor += 0.1.
  - **Review Phase (`interval > 0`):**
    - Rating 1 (Again): Relapses to `interval = 0`, `stepIndex = 0`, easeFactor -= 0.2.
    - Rating 2 (Hard): `interval = Math.max(1, Math.round(interval * 1.2))`, easeFactor -= 0.15.
    - Rating 3 (Good): `interval = Math.max(1, Math.round(interval * easeFactor))`.
    - Rating 4 (Easy): `interval = Math.max(1, Math.round(interval * easeFactor * 1.3))`, easeFactor += 0.1.
  - **Ease Factor Bounds:** Strictly clamped between `1.3` and `4.0`.
- **Active Study Session (`renderStudy` in `flashcards.tsx:2166-2442`):**
  - Interactive flip animation with perspective rendering.
  - Reverse study toggle (`studyReversed`).
  - Pre-calculated interval tags under each button (`<1m`, `<10m`, `1d`, `4d`).
  - Intraday Requeueing: Cards rated 'Again' (interval 0) with `nextDue - now < 20 min` are requeued at the end of the current session (`flashcards.tsx:977`).

#### Discovered Observations & Edge Cases:
1. **Session Accuracy Metric with Requeued Cards:**
   - *Observation:* In `renderStudy` (`flashcards.tsx:2189`), accuracy is calculated as:
     `Math.round(((sessionCards.length - sessionStats.again) / sessionCards.length) * 100)`.
     When cards are failed and requeued, `sessionCards.length` grows dynamically.
   - *Fix Proposal:* Ensure `Math.max(0, ...)` bounds are strictly applied so accuracy never drops below 0%, and optionally track initial cards vs review attempts for enhanced reporting.
2. **Double-Tap Rating Guard:**
   - *Observation:* Handled robustly via `isRatingRef.current` (`flashcards.tsx:945`), preventing rapid double-taps from rating multiple cards simultaneously.

---

### 2.3 Speed Match Game Flow

#### Implementation Traced:
- **Game Setup (`startMatch` in `flashcards.tsx:1129-1153`):**
  - Selects up to 8 cards from the deck (producing 16 tiles).
  - Creates Term tile (`isTerm: true`) and Definition tile (`isTerm: false`), both with matching `pairId`.
  - Shuffles tiles and renders in a 4-column responsive grid (`cardSize` scaled to `SCREEN_WIDTH`).
- **Matching Engine (`handleMatchTap` in `flashcards.tsx:1155-1192`):**
  - Checks `matchRevealed.length >= 2` and `matchRevealed.includes(cardId)` to avoid race conditions.
  - Compares `first.pairId === second.pairId && first.isTerm !== second.isTerm`.
  - On match: 400ms timeout adds pair to `matchMatched`.
  - On mismatch: 800ms timeout unreveals both tiles.
  - When all pairs matched: Computes elapsed time, moves, and accuracy (`Math.round((totalPairs / matchMoves) * 100)`), awards XP, and displays completion summary.

#### Discovered Observations & Edge Cases:
1. **Live In-Game Timer:**
   - *Observation:* During active play, the header displays `{matchMoves} moves`, but no live running clock is shown. Elapsed time is computed upon completion via `Math.floor((Date.now() - matchStartTime) / 1000)`.
   - *UX Enhancement Proposal:* Add a lightweight `useEffect` timer tick (every 1s) while `view === 'match' && !matchDone` to show a live `00:45` counter in the game header for increased gamified urgency.
2. **Identical Front/Back Strings:**
   - *Observation:* Cards where front equals back are handled safely because matching checks `first.pairId === second.pairId && first.isTerm !== second.isTerm`, preventing false matches across different cards.

---

### 2.4 Exam Prep Scheduling Flow

#### Implementation Traced:
- **Cepeda Spacing Model (`computeExamPlan` in `components/study/utils.ts:607-667`):**
  - **Cram Mode (`daysUntilExam <= 1`):** Generates 4 intraday review slots (`[0, 0.014, 0.042, 0.125]` -> Now, +20m, +1h, +3h).
  - **Standard Mode (`daysUntilExam > 1`):** Calculates optimal first gap (`safeDays * 0.12`) and scales subsequent intervals by `1.4x` expansion factor, strictly bounded within `maxSpan`.
  - **Schedule Application (`applyExamSchedule` in `flashcards.tsx:749-780`):**
    - Sets all cards' `nextDue` to `now + examPlan[0].day * 24h` and initial interval to first session gap.

#### Discovered Observations & Edge Cases:
1. **Overdue / Past Exam Date Handling:**
   - *Observation:* `computeExamPlan` uses `safeDays = Math.max(0, daysUntilExam)`. If `safeDays <= 1`, it cleanly switches to cram mode without throwing. In the UI (`renderExamModal`), `DateTimePicker` has `minimumDate={new Date()}`.
2. **Schedule Monotonicity:**
   - *Observation:* Verified by Suite 17 & Suite 25 tests — interval gaps are strictly non-overlapping and monotonic.

---

### 2.5 Quiz Mode (Practice Test) Flow

#### Implementation Traced:
- **Question Generation (`generateQuiz` in `flashcards.tsx:1065-1096`):**
  - Slices up to 10 random cards.
  - Distractors are picked randomly from other cards' answers in the deck (`c.id !== card.id`).
  - Options array is shuffled with the correct answer.
- **Interactive Quiz View (`renderQuiz` in `flashcards.tsx:2531-2645`):**
  - Question counter, lettered badges (A, B, C, D), and immediate feedback (emerald green for correct, red for incorrect).
  - 1.2s timeout before advancing.
- **Results & Retry (`renderQuiz` in `flashcards.tsx:2451-2525`):**
  - Displays score percentage, score count, missed terms summary, and "Retry Missed" CTA which invokes `generateQuiz(activeNode, quizMissed)`.

#### Discovered Observations & Edge Cases:
1. **Distractor Deduplication:**
   - *Observation:* In `generateQuiz` (`flashcards.tsx:1081-1085`):
     ```typescript
     const otherBacks = allCards.filter((c) => c.id !== card.id).map((c) => c.back);
     const shuffledOthers = [...otherBacks].sort(() => Math.random() - 0.5);
     const distractors = shuffledOthers.slice(0, 3);
     const options = [...distractors, card.back].sort(() => Math.random() - 0.5);
     ```
     If multiple cards in a deck share identical definitions (e.g. "True"/"False" cards or shared terms), `options` could contain duplicate choices, which causes duplicate selection highlights in `renderQuiz:2565`.
   - *Fix Proposal:* Deduplicate distractors before slicing:
     ```typescript
     const uniqueOtherBacks = Array.from(
       new Set(allCards.filter((c) => c.id !== card.id && c.back.trim() !== card.back.trim()).map((c) => c.back.trim()))
     );
     ```
2. **Decks with 2 or 3 Cards:**
   - *Observation:* Safely handled — when fewer than 3 distractors exist, `options` contains 2 or 3 lettered choices (A/B or A/B/C) without runtime errors.

---

## 3. Test Suite Verification & Coverage Matrix

The test harness in `__tests__/study.test.js` contains **25 suites** and **52 test cases** specifically validating the study engine, all passing with 100% success rate:

| Test Suite | Focus Area | Status |
|---|---|---|
| Suite 1 | SM-2 Spaced Repetition Engine (Ratings 1-4, Ease Factor Clamping) | PASSED |
| Suite 2 | Deck Tree Hierarchy & Node Statistics Calculation | PASSED |
| Suite 3 | Gamification, Streaks & XP System | PASSED |
| Suite 4 | File & Text Import Parser (CSV, Pipe, Tab, Auto) | PASSED |
| Suite 5 | Exam Prep Spaced Algorithm (Cram & Expanding Windows) | PASSED |
| Suite 6 | Thematic Deck Icons & Visual Helpers | PASSED |
| Suite 7 | Edge Cases, Input Fuzzing & Invariants | PASSED |
| Suite 8 | Advanced CSV & Quoted Delimiter Parsing | PASSED |
| Suite 9 | Timezone & Local Date Invariants | PASSED |
| Suite 10 | Color Alpha & Token Contract | PASSED |
| Suite 11 | Gamification Max Level & Day Rollover | PASSED |
| Suite 12 | Hierarchical Deck Tree Filtering | PASSED |
| Suite 13 | Exam Prep Expansion & Edge Overrides | PASSED |
| Suite 14 | Deck Tree Hierarchical Subject Deduplication | PASSED |
| Suite 15 | Gamification Engine NaN & Non-Finite Safety | PASSED |
| Suite 16 | Extended Delimiters & Trailing Commas | PASSED |
| Suite 17 | Exam Prep Schedule Monotonicity | PASSED |
| Suite 18 | 8-Digit Hex Color Support | PASSED |
| Suite 19 | History Retention & Safe Traversals | PASSED |
| Suite 20 | SM-2 Engine Corrupt Data & Step Bounds | PASSED |
| Suite 21 | RFC-4180 Escaped Quotes & Semicolon Delimiters | PASSED |
| Suite 22 | Deck Tree Empty Names & Fallback Safety | PASSED |
| Suite 23 | 4-Digit Hex Color & Alpha Clamping | PASSED |
| Suite 24 | Deterministic Weekday Date Traversal | PASSED |
| Suite 25 | Exam Prep Boundary Protection & Safe XP | PASSED |

**Overall Project Test Results:**
- `node scripts/run-tests.js`: **77/77 suites passed, 256/256 tests passed (1.68s)**.
- `npx tsc --noEmit`: **0 TypeScript compilation errors**.

---

## 4. Proposed Technical Fixes & Improvements

### Proposal 1: Implement Deck Export Feature
- **Target File:** `app/(tabs)/flashcards.tsx`
- **Location:** `showDeckActions` (`flashcards.tsx:711`)
- **Code Change:**
  ```typescript
  import { Share } from 'react-native';
  
  const handleExportDeck = async (node: DeckNode) => {
    const allCards = collectCards(node);
    if (allCards.length === 0) {
      AlertService.alert('Empty Deck', 'No cards to export.');
      return;
    }
    const csvContent = allCards
      .map(c => `"${c.front.replace(/"/g, '""')}","${c.back.replace(/"/g, '""')}"`)
      .join('\n');
    try {
      await Share.share({
        title: `${node.name} Flashcards`,
        message: csvContent,
      });
    } catch (e) {
      console.error('Export failed:', e);
    }
  };
  ```

### Proposal 2: Deduplicate Distractors in Quiz Question Generation
- **Target File:** `app/(tabs)/flashcards.tsx`
- **Location:** `generateQuiz` (`flashcards.tsx:1081`)
- **Code Change:**
  ```typescript
  const questions: QuizQuestion[] = source.map((card) => {
    const uniqueOtherBacks = Array.from(
      new Set(
        allCards
          .filter((c) => c.id !== card.id && c.back.trim() !== card.back.trim())
          .map((c) => c.back.trim())
      )
    );
    const shuffledOthers = [...uniqueOtherBacks].sort(() => Math.random() - 0.5);
    const distractors = shuffledOthers.slice(0, 3);
    const options = [...distractors, card.back].sort(() => Math.random() - 0.5);
    return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
  });
  ```

### Proposal 3: Live Running Timer for Speed Match Game
- **Target File:** `app/(tabs)/flashcards.tsx`
- **Location:** `renderMatch` (`flashcards.tsx:2749`)
- **Code Change:**
  - Add active second ticker `useEffect` when `view === 'match' && !matchDone`.
  - Display running time `00:XX` alongside move count in the match header.

### Proposal 4: Card Edit/Delete in Folder Detail View
- **Target File:** `app/(tabs)/flashcards.tsx`
- **Location:** `renderDetail` (`flashcards.tsx:2089`)
- **Code Change:**
  ```typescript
  {(() => {
    const cardDeck = deck || decks.find(d => d.id === card.deckId);
    if (!cardDeck) return null;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 10 }}>
        <TouchableOpacity
          onPress={() => {
            setActiveDeck(cardDeck);
            setEditingCard(card);
            setCardForm({ front: card.front, back: card.back });
            setShowAddCardModal(true);
          }}
        >
          <Ionicons name="pencil-outline" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setActiveDeck(cardDeck);
            handleDeleteCard(card);
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  })()}
  ```
