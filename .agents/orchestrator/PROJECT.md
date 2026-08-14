# Project: FinScholar App Grade Ledger Redesign

## Architecture
- Target Screen: `app/(tabs)/grades.tsx`
- Components: `components/ledger/GwaSummary.tsx`, `components/ledger/SubjectCard.tsx`, `components/ledger/Tabs.tsx`, `components/ledger/DonutChart.tsx`, `components/ledger/ActiveSubjectView.tsx`
- State & Utils: `components/SemesterContext.tsx`, `utils/calculator.js`, `utils/subjectRegistry.ts`, `constants/Theme.ts`
- Assets: `assets/images/FinDashboard.png`, `assets/images/happy.png`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Overall GWA Hero Banner | Top banner featuring Overall GWA score, quote/cheer, `FinDashboard.png` mascot, gradient styling | M1 | ORIGINAL_REQUEST R1 |
| 2 | Side-by-Side Semester & Year GWA | Condensed cards for Semester GWA and Year GWA positioned side-by-side underneath hero banner | M1 | ORIGINAL_REQUEST R2 |
| 3 | Donut / Progress Ring Refactoring | Donut chart or progress ring component adapted for condensed side-by-side cards | M1 | ORIGINAL_REQUEST R2 |
| 4 | Term Selector Pill Styling | `Tabs.tsx` updated with pill-shaped selector buttons, clear typography, soft drop shadows | M2 | ORIGINAL_REQUEST R3 |
| 5 | Subject Card Redesign | `SubjectCard.tsx` updated with soft drop shadows, pill badges, clear typography, well-padded card layout | M2 | ORIGINAL_REQUEST R3 |
| 6 | Main Screen Layout Integration | `app/(tabs)/grades.tsx` refactored to integrate new components, hero header, and polished background | M3 | ORIGINAL_REQUEST R3 |
| 7 | Add Subject Action & Modal | Add subject trigger button and modal with pill/shadow styling maintaining exact creation handler | M3 | ORIGINAL_REQUEST R4 |
| 8 | Grade Tracking Toggle | Interactive tracking toggle (`eye`/`eye-off`) excluding/including subject from GWA calculation | M3 | ORIGINAL_REQUEST R4 |
| 9 | Edit Mode & Batch Actions | Selection mode header, select-all, batch delete toolbar with full parity | M3 | ORIGINAL_REQUEST R4 |
| 10 | Subject Delete & Duplicate | Single delete action and duplicate action preserving unique ID assignment and registry sync | M3 | ORIGINAL_REQUEST R4 |
| 11 | Empty State Handling | Polished empty state cards for semesters with 0 subjects or 0 tracked subjects | M3 | ORIGINAL_REQUEST R4 |
| 12 | Grade Ledger Test Suite & Integrity Audit | E2E/unit test suite covering GWA calculation, card actions, and forensic audit verification | M4 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Hero Header & Condensed GWA Cards | `GwaSummary.tsx`, `DonutChart.tsx` (R1, R2) | none | DONE |
| M2 | Term Selector & Subject Cards Redesign | `Tabs.tsx`, `SubjectCard.tsx` (R3) | none | DONE |
| M3 | Main Screen Integration & Feature Parity | `app/(tabs)/grades.tsx` (R3, R4) | M1, M2 | DONE |
| M4 | Test Suite & Integrity Verification | `__tests__/ledger.test.js`, `npx tsc`, Forensic Audit | M3 | DONE |

## Interface Contracts
### GwaSummary ↔ grades.tsx
- Props: `GwaSummaryProps = { semGwa: string; yearGwa: string; cumGwa: string; semPercent: number; yearPercent: number; cumPercent: number; system: GradingSystem }`
- Output: Renders Hero Banner with `cumGwa`/`cumPercent` and side-by-side cards for `semGwa` and `yearGwa`.

### SubjectCard ↔ grades.tsx
- Props: `SubjectCardProps = { subject: Subject; system: GradingSystem; onSelect: () => void; isEditMode?: boolean; isSelected?: boolean; onToggleSelect?: () => void; onToggleTracking: () => void; onDelete: () => void; onDuplicate: () => void; }`
- Output: Subject card with pill status badges, progress indicator, soft drop shadow, and action handlers.

### Tabs ↔ grades.tsx
- Props: `TabsProps = { activeTab: 'all' | 'tracked'; setActiveTab: (t: 'all' | 'tracked') => void; }` (Uses `SemesterContext` for year/sem selection)
- Output: Pill buttons for tab filtering and dropdown trigger for year/semester switcher modal.

## Code Layout
- `app/(tabs)/grades.tsx` — Main screen container
- `components/ledger/GwaSummary.tsx` — Hero Banner + Side-by-side GWA cards
- `components/ledger/DonutChart.tsx` — Progress ring / Donut visualizer
- `components/ledger/SubjectCard.tsx` — Subject list item card
- `components/ledger/Tabs.tsx` — Term selector & view tab bar
- `__tests__/ledger.test.js` — Test suite for Grade Ledger features
