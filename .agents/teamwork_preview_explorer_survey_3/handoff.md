# Test Setup & Coverage Strategy Report: FinScholar Widget Redesign

## 1. Observation

### Existing Test Setup & Infrastructure
- **Test Engine**: Custom Node.js 24+ native ES module test runner using `--experimental-strip-types` (`package.json:59`, `scripts/run-tests.js:1-129`).
- **Path Resolution & Mocks**: `scripts/test-loader.js:1-25` handles `@/*` path alias resolution and mocks `react-native` by delegating to `scripts/mocks/react-native.js`.
- **Framework Dependencies**: Neither `jest` nor `@testing-library/react-native` are listed in `package.json` dependencies or devDependencies (`package.json:47-52`). The project intentionally relies on Node's native runner with zero heavy test dependencies.
- **Current Test Results**: Running `npm test` (or `node --experimental-strip-types scripts/run-tests.js`) executes **20 Test Suites with 71 Test Cases** in **~0.35 seconds**, with **0 failures (100% pass)**.

### TypeScript Configuration & Status
- **Configuration**: `tsconfig.json:1-23` extends `expo/tsconfig.base`, sets `"strict": true`, `"module": "esnext"`, and path alias `"@/*": ["./*"]`. Includes `**/*.ts` and `**/*.tsx`, excludes `node_modules` and `supabase`.
- **Typecheck Execution**: Running `npx tsc --noEmit` completes with **Exit Code 0 and 0 errors**.

### Widget Test Status & Artifacts
- **Existing Widget Implementation**:
  - `widget/FinScholarWidget.tsx` (162 lines): Widget UI component using `react-native-android-widget` primitives (`FlexWidget`, `TextWidget`, `ImageWidget`).
  - `widget/WidgetTaskHandler.tsx` (175 lines): Background task handler querying `AsyncStorage` (`grade_ledger_v2_data`), formatting time strings and countdowns, selecting ongoing/upcoming classes, and calling `requestWidgetUpdate`.
  - `widget/FinImageBase64.ts`: Embedded base64 image asset string.
- **Standalone Widget Test**:
  - `widget/test-widget.js` (124 lines): Standalone Node script attempting to test `FinScholarWidget.tsx` by transforming TypeScript with Babel (`widget/test-widget.js:45-48`).
  - **Verbatim Execution Error**: Running `node widget/test-widget.js` fails with:
    ```
    Error: Cannot find module '@babel/preset-env'
    Require stack:
    - C:\Projects\FinScholarApp\node_modules\@babel\core\lib\config\files\plugins.js
    - C:\Projects\FinScholarApp\node_modules\@babel\core\lib\config\files\index.js
    - C:\Projects\FinScholarApp\node_modules\@babel\core\lib\index.js
    - C:\Projects\FinScholarApp\widget\test-widget.js
    ```
  - **Integration Status**: `widget/test-widget.js` is **NOT** included in `scripts/run-tests.js` or `npm test`.

### Linting & Formatting Commands
- **Linter Status**: No linter (ESLint, Prettier) is installed or configured in `package.json` scripts or root configs.

---

## 2. Logic Chain

1. **Test Runner Choice**: The project architecture documented in `TEST_INFRA.md` deliberately avoids Jest/RNTL overhead by leveraging Node 24 `--experimental-strip-types` and a lightweight test harness in `scripts/run-tests.js`.
2. **Widget Test Broken Link**: `widget/test-widget.js` was created as an isolated experiment using `@babel/core` and `@babel/preset-env`. Because `@babel/preset-env` is not in `package.json`, the script crashes on execution. Furthermore, because it was not registered in `scripts/run-tests.js`, widget changes currently have 0 continuous integration / automated test coverage in `npm test`.
3. **Coverage Gaps in Widget Redesign**:
   - The planned widget redesign introduces a tall layout with a top blue gradient section, mascot graphic (`assets/images/finwidget.png`), wavy divider, and bottom upcoming classes adapting to dark mode.
   - Helper logic in `WidgetTaskHandler.tsx` (`formatTimeStr`, `formatCountdown`, `isValidClass`, ongoing vs upcoming class sorting) has no unit tests in `__tests__/`.
   - New requirements for deterministic subject colors, deterministic subject icons, countdown accuracy, and empty state rendering lack test harnesses in `scripts/run-tests.js`.
4. **Conclusion**: To ensure robust delivery of the widget redesign without breaking changes, we must repair `test-widget.js` (or replace Babel with Node 24 native ES loading/type stripping), integrate widget tests directly into `scripts/run-tests.js`, and add thorough unit tests for `WidgetTaskHandler` calculations and `FinScholarWidget` element structure.

---

## 3. Caveats

- **No Device/Emulator E2E Framework**: Detox / Maestro / Appium are not configured in this repository. All UI tests for `react-native-android-widget` run headlessly in Node.js by asserting on the returned React element hierarchy (type, props, text content, styles).
- **Native Android Binding Boundary**: Node.js unit tests verify the TSX component output and data selection logic, but cannot verify the Android system launcher's native rendering of `RemoteViews`. Native rendering must be spot-checked on an Android device or emulator.
- **No Linter Configured**: Repository relies exclusively on `npx tsc --noEmit` and unit test assertions for code hygiene.

---

## 4. Conclusion & Test Strategy Recommendations

### Command Reference Summary
| Task | Execution Command | Status |
|---|---|---|
| **Typecheck** | `npx tsc --noEmit` | ✅ 0 errors |
| **Run Unit Tests** | `npm test` or `node --experimental-strip-types scripts/run-tests.js` | ✅ 71/71 tests passing (0.35s) |
| **Standalone Widget Test** | `node widget/test-widget.js` | ❌ Fails (`MODULE_NOT_FOUND: @babel/preset-env`) |
| **Lint Check** | N/A (No linter configured) | N/A |

### Recommended Testing Plan for Widget Redesign

1. **Fix & Wire Widget Unit Tests in Main Runner**:
   - Refactor `widget/test-widget.js` (or create `__tests__/widget.test.js`) to import `FinScholarWidget` using Node's native module loader (`scripts/test-loader.js`) without needing `@babel/preset-env`.
   - Register `runWidgetTests` in `scripts/run-tests.js` so `npm test` automatically executes all widget tests.

2. **Unit Test Coverage for `WidgetTaskHandler.tsx` Helpers**:
   - **Time & Countdown Formatters**: Test `formatTimeStr` (AM/PM conversion, exact hours, half hours) and `formatCountdown` ("In progress", "In 15m", "In 2h 30m", "In 1 day").
   - **Class Filtering & Validation**: Test `isValidClass` with missing/empty names, invalid start hours, or null values.
   - **Ongoing vs. Upcoming Selection Logic**:
     - Single ongoing class active during current hour.
     - Ongoing class + next upcoming class today.
     - No class remaining today -> select soonest class on next day / future semester.
     - Multi-class sorting by wait time.
   - **Deterministic Color & Icon Utilities**: Test hashing function for subject colors and subject icon mapping.

3. **Widget Component UI & Layout Contract Tests (`FinScholarWidget.tsx`)**:
   - **Tall Widget Layout**: Verify top section (gradient, mascot asset `assets/images/finwidget.png`, wavy divider) and bottom section (upcoming list).
   - **Dark Mode Adaptivity**: Verify color token selection in light mode (`Appearance.getColorScheme() === 'light'`) vs dark mode (`'dark'`).
   - **Badge Logic**: Verify ONGOING badge (`● ONGOING` / green) vs NEXT badge (`◎ NEXT` / primary).
   - **Empty / Fallback State**: Verify render output when `classes` array is empty or undefined.
   - **Deep Link Data Contract**: Verify `clickActionData.uri` contains valid `finscholarapp://schedule` schema and query parameters.

---

## 5. Verification Method

To independently verify the status and recommendations in this report:

1. **TypeScript Typecheck**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected Result*: Exit code 0, no errors reported.

2. **Main Test Suite Execution**:
   ```powershell
   npm test
   ```
   *Expected Result*: 20 test suites passed, 71 tests passed, 0 failed, execution time ~0.35s.

3. **Reproduce Standalone Widget Test Failure**:
   ```powershell
   node widget/test-widget.js
   ```
   *Expected Result*: Throws `Cannot find module '@babel/preset-env'`.

4. **Invalidation Conditions**:
   - If `npx tsc --noEmit` produces type errors.
   - If `npm test` fails any existing test case.
   - If widget redesign is implemented without adding widget test suites to `scripts/run-tests.js`.
