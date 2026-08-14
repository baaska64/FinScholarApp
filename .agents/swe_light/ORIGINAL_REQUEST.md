# Original User Request

## Initial Request — 2026-08-14T14:02:18Z

## Task Summary:
Redesign the Android home screen widget in the FinScholar app to match the specified visual requirements, set default grid size to 4x5, and preserve existing data binding and conditional rendering functionalities.

### R1. Widget Configuration:
Update `app.json` to configure the `FinScholarWidget` with a default size of 4x5 cells (`targetCellWidth: 4`, `targetCellHeight: 5`) and `minHeight: 250dp`.

### R2. Visual Redesign:
Completely rewrite the UI layout in `widget/FinScholarWidget.tsx` to precisely match the target design:
- The main widget has a blue/purple gradient background with rounded corners.
- Top section: A calendar icon and a translucent panel for the "Next Class".
- Middle section: A wavy SVG divider separating the top blue background from the bottom.
- Bottom section: A solid white container (with rounded corners) that holds the upcoming classes list.
- Upcoming list items: Pill shapes with circular slots on the left (avatar) and right (time remaining).
- Do not include the fin mascot.
- Retain the exact same data binding and conditional rendering logic (handling empty states, passing `classes` props).

### Acceptance Criteria:
- `app.json` contains `targetCellWidth: 4` and `targetCellHeight: 5` for the widget.
- `widget/FinScholarWidget.tsx` compiles successfully without any TypeScript errors (`npx tsc --noEmit`).
- The layout structurally matches the visual requirement (blue top section, wavy divider, solid white bottom container holding list items).
