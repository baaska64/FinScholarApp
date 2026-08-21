# Project: FinScholarApp Flash Study Tab QA, Bug Fixing & Usability Polish

## Architecture
FinScholarApp Flash Study Tab features an offline-first, highly responsive study engine comprising:
- **Presentation Layer**: `app/(tabs)/flashcards.tsx` (6 interactive views: `decks`, `detail`, `study`, `manage`, `quiz`, `match`), `app/study-options.tsx` (study & SRS configuration).
- **Study Components**: `components/study/` (`StudyDashboardStats`, `StudyModesStrip`, `DeckCard`, `DeckTreeItem`, `types.ts`, `utils.ts`).
- **Core Algorithms**: SM-2 spaced repetition engine (`applyRating`), Cepeda et al. expanding exam prep scheduler (`computeExamPlan`), Gamification momentum engine (`calculateLevel`, `calculateXpGain`, `updateStudyStats`).
- **Persistence & Sync**: Local `AsyncStorage` ledger synchronization with Supabase offline queue (`SyncService.pushLocalChanges`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Deck & Card Management | Hierarchical deck trees, folder creation, card creation/editing, bulk delete & reverse, deck export | M1 | Survey |
| F2 | Spaced Repetition (SM-2) | 4-grade rating system, ease factor clamping, intraday requeuing, 3D flip card, reverse study | M1 | Survey |
| F3 | Speed Match Game | 16-tile matching grid, pair generation, tap concurrency lock, live elapsed timer, balanced scoring | M1 | Survey |
| F4 | Practice Test / Quiz Mode | 4-choice MCQ generation, distractor deduplication, immediate feedback, score tracking, retry missed terms | M1 | Survey |
| F5 | Exam Prep Scheduler | Cepeda expanding spacing, cram mode, tree schedule application, monotonicity guarantee | M1 | Survey |
| F6 | Gamification & Tiers | XP scaling, exploit elimination, live streak validation, scholar tier leveling, daily goal configuration | M2 | Survey |
| F7 | UX Navigation & Polish | Settings routing to /study-options, folder card actions, Select All bulk toggle, interactive live timer | M2 | Survey |
| F8 | End-to-End Simulation & Test Suite | Automated test suite expansion (Suites 26-32) covering all 5 study modes, gamification state traces, and edge cases | M3 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Study Logic & State Fixes | Fix quiz distractor deduplication, match game XP/scoring, deck export, folder card action editing, live timer | none | PLANNED |
| M2 | Gamification & UX Polish | Fix header settings routing, session completion XP scaling, dashboard live streak validation, daily goal config, bulk Select All | M1 | PLANNED |
| M3 | Automated Test Suite & State Trace Validation | Implement comprehensive test suites (Suites 26-32) covering all study modes and multi-day state simulations | M1, M2 | PLANNED |
| M4 | Forensic Integrity Audit & Multi-Review Verification | Reviewer checks, Challenger stress test, and Forensic Integrity Audit verification | M3 | PLANNED |

## Interface Contracts
### `app/(tabs)/flashcards.tsx` ↔ `components/study/utils.ts`
- `updateStudyStats(currentStats, reviewsCount, masteredCount, sessionDone)`:
  - `reviewsCount`: total cards reviewed in session when `sessionDone = true`
  - `masteredCount`: strictly SM-2 graduated cards (not raw match game pairs)
- `calculateLevel(xp)`: computes scholar tier level `[1..50]`, rank name, and progress percentage
- `isStreakLive(lastStudyDate, todayStr, yesterdayStr)`: determines whether displayed streak is active

## Code Layout
- `app/(tabs)/flashcards.tsx`: Main Flash Study screen & view switcher
- `app/study-options.tsx`: Study and spaced repetition preferences screen
- `components/study/types.ts`: TypeScript data contracts & models
- `components/study/utils.ts`: Pure algorithmic calculations & business logic
- `components/study/StudyDashboardStats.tsx`: Dashboard stats & gamification visualization
- `components/study/StudyModesStrip.tsx`: Study mode selectors
- `components/study/DeckCard.tsx` & `DeckTreeItem.tsx`: Deck card presentation & tree nesting
- `__tests__/study.test.js`: Comprehensive automated test suites (Suites 1 through 32)
