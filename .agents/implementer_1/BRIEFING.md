# Implementer 1 Briefing

## Task
Decrease font sizes and padding in FinScholarWidget so all information fits compactly without requiring manual resizing, and permanently fix the Android widget registration so it defaults to a 4x5 grid instead of a 3x2 grid.

## Plan
1. UI Compaction in `widget/FinScholarWidget.tsx`:
   - Reduce top padding, next class panel padding, and bottom padding.
   - Reduce course title font size (22 -> 15), status font size (11 -> 9), subtitle font size (13 -> 10), time badge font size (12 -> 9.5).
   - Reduce upcoming item avatar/badge dimensions (44x44 -> 28x28), item padding (8 -> 5), margin bottom (8 -> 4), title font size (14 -> 11.5), subtitle font size (12 -> 9.5), countdown font size (11 -> 8.5).
   - Reduce wave divider height (24 -> 14).
   - Ensure up to 3 upcoming classes fit effortlessly in standard widget height.
2. Native Widget Registration Fix in `app.json` and `android/app/src/main/res/xml/widgetprovider_finscholarwidget.xml`:
   - Change `minWidth` from `180dp` (3 cols) to `250dp` (4 cols).
   - Change `minHeight` from `250dp` (3-4 rows) to `330dp` (5 rows).
   - Verify `targetCellWidth: 4` and `targetCellHeight: 5`.
3. Verification:
   - Run `npm test` across all 35 test suites.
   - Run `npx tsc --noEmit` to ensure zero type errors.
   - Verify native XML provider attributes.
