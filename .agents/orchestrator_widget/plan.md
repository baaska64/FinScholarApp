# FinScholar Android Home Screen Widget Redesign — Project Plan

## Architecture & Overview

The FinScholar Android Home Screen Widget is built with `react-native-android-widget`. It renders native Android `RemoteViews` from React component trees.

```
┌─────────────────────────────────────────────────────────┐
│ Top Section (Vibrant Blue Gradient)                      │
│ - backgroundGradient: #3b82f6 -> #1d4ed8 (TL_BR)       │
│ - Mascot asset: require('../assets/images/finwidget.png')│
│ - Active/Next class title, room, time, countdown        │
│ - ONGOING badge (green) or NEXT badge (blue)            │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Wavy Divider (SvgWidget)                                │
│ - Crisp vector path filled with bottom section bg color │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Bottom Section (Upcoming Classes List)                  │
│ - Dynamic background: Light (#ffffff) / Dark (#0f172a)  │
│ - Class items with deterministic subject colors & icons │
│ - Rounded cards, time badges, room numbers              │
└─────────────────────────────────────────────────────────┘
```

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Tall Widget Flexbox Layout | Responsive flex container (`flex: 1`, `match_parent`, no hardcoded heights) | M2 | ORIGINAL_REQUEST §1 |
| 2 | Top Blue Gradient Section | Vibrant blue gradient top card displaying active/next class & mascot | M2 | ORIGINAL_REQUEST §1 |
| 3 | Mascot Asset Integration | Integration of `assets/images/finwidget.png` mascot image | M2 | ORIGINAL_REQUEST §1 |
| 4 | Wavy SVG Divider | Vector wave transition between blue top card and bottom section | M2 | ORIGINAL_REQUEST §1 |
| 5 | Dark Mode Adaptation | Bottom section adapts background (`#ffffff` light / `#0f172a` dark) | M2 | ORIGINAL_REQUEST §1 |
| 6 | Deterministic Subject Colors | Hashing algorithm mapping course name to fixed palette color | M1 | ORIGINAL_REQUEST §2 |
| 7 | Keyword Subject Icons | Course name keyword matching for subject icon selection | M1 | ORIGINAL_REQUEST §2 |
| 8 | Dynamic Asset Responsiveness | Flexbox layout scaling cleanly across cell dimensions (3x2, 3x3, 4x4) | M2 | ORIGINAL_REQUEST §2 |
| 9 | ONGOING / NEXT Badge Logic | Active class status badge preservation and rendering | M3 | ORIGINAL_REQUEST §3 |
| 10| Countdown & Time Strings | Accurate `formatCountdown` and 12-hour `formatTimeStr` preservation | M3 | ORIGINAL_REQUEST §3 |
| 11| Empty State Fallback | Centered fallback card when no classes exist for current/next day | M2 | ORIGINAL_REQUEST §3 |
| 12| Deep Linking | OPEN_APP click action redirecting to app schedule screen | M3 | ORIGINAL_REQUEST §3 |
| 13| 0 TypeScript Errors | `npx tsc --noEmit` clean compilation | M4 | ORIGINAL_REQUEST §4 |
| 14| Widget Test Suite | Comprehensive unit test suite integrated into `npm test` | M4 | ORIGINAL_REQUEST §4 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Dynamic Subject Assets & Helper Utilities | `widget/subjectUtils.ts` & `__tests__/subjectUtils.test.js` | None | DONE |
| M2 | Tall Widget Layout & Component Redesign | `widget/FinScholarWidget.tsx` | M1 | DONE |
| M3 | Data Integration & Task Handler Update | `widget/WidgetTaskHandler.tsx` | M2 | DONE |
| M4 | Test Suite Integration & Gate Verification | `__tests__/widget.test.js`, typecheck, `npm test`, Gate verification | M3 | DONE |

---

## Code Layout & File Boundaries

- **`widget/subjectUtils.ts`** (New): Deterministic subject color hashing, icon keyword resolver, dark mode theme helper.
- **`widget/FinScholarWidget.tsx`** (Modified): Widget UI component tree (`FlexWidget`, `SvgWidget`, `ImageWidget`, `TextWidget`).
- **`widget/WidgetTaskHandler.tsx`** (Modified): Data processing, schedule lookup, time formatters, fallback error handling.
- **`__tests__/subjectUtils.test.js`** (New): Unit tests for subject color/icon hashing and theme tokens.
- **`__tests__/widget.test.js`** (New): Unit tests for widget props, layout calculation, class sorting, and empty states integrated into `scripts/run-tests.js`.

---

## Verification Strategy & Gate Criteria

1. **TypeScript Typecheck**: `npx tsc --noEmit` must return 0 errors.
2. **Test Suite**: `npm test` must run all test suites (including new widget test suites) with 100% pass rate.
3. **Reviewer Gate**: 2 independent Reviewers (`teamwork_preview_reviewer`) approve code quality, component structure, and edge case handling.
4. **Challenger Gate**: 2 independent Challengers (`teamwork_preview_challenger`) stress test dynamic subject hashing, dark mode toggling, empty state rendering, and layout scaling.
5. **Forensic Integrity Audit**: 1 Forensic Auditor (`teamwork_preview_auditor`) verifies authenticity of implementation (no hardcoded test outputs or dummy facades).
