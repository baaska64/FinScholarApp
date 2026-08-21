# Orchestration Plan: FinScholarApp Google Auth & Widget 3x4

## 1. Survey Phase
- Spawn Explorer 1: Investigate Google Authentication flow, Supabase integration, native Android config, error handling, redirect flow.
- Spawn Explorer 2: Investigate Android Widget configuration (`app.json`, `widget/FinScholarWidget.tsx`, 3x4 dimensions, adaptive colors/theming, layout).
- Spawn Explorer 3: Investigate project structure, dependencies, TypeScript setup, tests, and build configurations.

## 2. Global Project Blueprint (`PROJECT.md`)
- Aggregate findings into Feature Inventory, Interface Contracts, and Milestone Decomposition.

## 3. Milestones Execution
- **Milestone 1 (Google Authentication)**:
  - Fix `@react-native-google-signin/google-signin` initialization & auth flow.
  - Fix Supabase OAuth token exchange and session handling.
  - Ensure redirection to main dashboard on login success.
  - Provide fallback/clear error messaging if external Google Cloud Console Web Client ID is missing.
- **Milestone 2 (Android Widget 3x4 & Adaptive Theming)**:
  - Configure `app.json` for 3x4 grid (`targetCellWidth: 3`, `targetCellHeight: 4`, appropriate minHeight/minWidth).
  - Optimize layout in `widget/FinScholarWidget.tsx` to fit "Next Class" and upcoming classes without clipping.
  - Implement adaptive light/dark mode theming dynamically based on system / app color scheme.
- **Milestone 3 (Verification & Hardening)**:
  - Run `npx tsc --noEmit` to verify type safety.
  - Verify all acceptance criteria.
  - Independent review, challenge, and forensic audit.

## 4. Final Handoff
- Produce comprehensive `handoff.md`.
