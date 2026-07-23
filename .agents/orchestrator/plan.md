# Project Plan: FinScholarApp Cute Companion Overhaul

## Classification
- **Orchestration Pattern**: Project
- **Problem Category**: Project (Greenfield Build / Feature Addition)

## Architecture & Scope
The goal is to completely overhaul the FinScholar React Native companion mobile app, integrating a cute UI, mascot integration, porting the Tasks/Requirements feature, preserving core features, adding autonomous companion features, and running E2E testing.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Exploration & Plan Verification | Explore existing codebase, packages, build/test commands, verify supabase table schema for tasks/requirements, locate mascot images, and define technical strategy. | None | DONE |
| 2 | M2: Cute UI/UX Overhaul & Mascot Integration | Redesign Dashboard, Calendar, Schedule, Grades, and Profile screens to feel native and playful. Embed mascot images (Fin) in at least 3 distinct contextual states. | M1 | DONE |
| 3 | M3: Tasks Feature Port & Companion Features | Implement Tasks/Requirements tab with CRUD operations connecting to AsyncStorage and Supabase. Add an autonomous feature (e.g., daily quotes from Fin, or focus timer). Also fixes calendar wrapping/timezone bugs. | M2 | DONE |
| 4 | M4: Final Testing & Adversarial Hardening | Run comprehensive unit/E2E tests, verify offline/online data syncing, AI scanning mock functions, perform white-box and adversarial testing, and execute Forensic Audit. Also resolves additional bugs (shifting components duplication, positive timezone shifts). | M3 | IN_PROGRESS |

## Interface Contracts
- **Mascot Images**: Standard poses are loaded from `assets/images/` (`happy.png`, `confused.png`, `studying.png`, `sleeping.png`, `FinDashboard.png`, `FinLogo.png`, `FinSights.png`).
- **Tasks Schema**: Table schema on Supabase/AsyncStorage must be matched. Need to sync user's tasks locally and upload/download to/from Supabase when online.
- **Sync status**: Toggle online/offline status correctly, saving to `AsyncStorage` first then syncing with `Supabase`.

## Code Layout
- `app/(tabs)/index.tsx`: Dashboard with Mascot welcome and status cards.
- `app/(tabs)/calendar.tsx` & `components/calendar/*`: Calendar views with cute styling.
- `app/(tabs)/schedule.tsx` & `components/schedule/*`: Timetable grid, schedule scanner modal.
- `app/(tabs)/grades.tsx` & `components/ledger/*`: Grades/academic ledger views.
- `app/(tabs)/profile.tsx`: Settings, theme toggle, mascot interactions.
- `app/(tabs)/requirements.tsx`: Newly ported Tasks/Requirements view.
- `assets/images/`: Location for mascot PNG assets.
