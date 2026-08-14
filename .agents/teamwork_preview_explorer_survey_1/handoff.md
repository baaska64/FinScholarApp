# FinScholar Android Widget Redesign — Investigation & Survey Report

## 1. Observation

Direct observations and file inspect results across the codebase:

### 1.1 Existing Widget Files & Architecture
- **`widget/FinScholarWidget.tsx`** (Lines 1–162):
  - Imports `FlexWidget`, `TextWidget`, `ImageWidget` from `react-native-android-widget`.
  - Defines interface `WidgetClassData`:
    ```ts
    export interface WidgetClassData {
      courseName: string;
      room: string;
      timeStr: string;
      timeRemainingStr: string;
      isOngoing: boolean;
    }
    ```
  - Receives `classes?: WidgetClassData[]` as props.
  - Queries system color scheme using `Appearance.getColorScheme() === 'dark'`.
  - Color Tokens: `bgColor` (`#0f172a` dark / `#f8fafc` light), `cardColor` (`#1e293b` dark / `#ffffff` light), `cardBorder` (`#334155` dark / `#e2e8f0` light), `textColor` (`#f8fafc` dark / `#0f172a` light), `textSecondary` (`#cbd5e1` dark / `#475569` light), `textTertiary` (`#64748b` dark / `#94a3b8` light), `primaryColor` (`#818cf8` dark / `#4f46e5` light), `successColor` (`#34d399` dark / `#10b981` light), `successBg` (`#134e3a` dark / `#d1fae5` light), `upcomingBg` (`#1e1b4b` dark / `#e0e7ff` light).
  - Deep Link URI: `finscholarapp://schedule?viewMode=attendance&targetDate=${todayStr}&trigger=${Date.now()}` with `clickAction="OPEN_APP"`.
  - Empty State (Lines 36–64): If `!classes || classes.length === 0`, renders centered fallback with `require('../assets/images/studying_small.png')` (48x48), "No upcoming classes!", "Enjoy your free time ☀️".

- **`widget/WidgetTaskHandler.tsx`** (Lines 1–175):
  - Reads `grade_ledger_v2_data` from `AsyncStorage`.
  - Determines active year via `@selectedYear` and semester via `@selectedSemester`.
  - Converts JS date day (`0=Sun..6=Sat`) to normalized day (`0=Mon..6=Sun`).
  - Helper `formatTimeStr(startHour: number)` (Lines 9–15): Converts decimal hour (e.g. 13.5) to 12-hour string (e.g. `"1:30 PM"`).
  - Helper `formatCountdown(waitHours: number, isOngoing: boolean)` (Lines 17–30): Returns `"In progress"` for ongoing, `"In Xm"` if `<1h`, `"In Xh Ym"` or `"In Xh"` if `<24h`, `"In X day(s)"` if `>=24h`.
  - Helper `isValidClass(cls: any)` (Lines 32–39): Ensures valid `name`, `startHour` number, `day` number.
  - Step 1: Detects ongoing class on current day within `[startHour, startHour + duration)`.
  - Step 2: Detects next upcoming class sorted by `waitHours` ascending.
  - Passes up to 2 classes (1 ongoing + 1 upcoming, or 1-2 upcoming) to `requestWidgetUpdate`.
  - Try/Catch error boundary (Lines 166–173): On any error, calls `requestWidgetUpdate` with `<FinScholarWidget classes={[]} />`.

- **`widget/FinImageBase64.ts`**: Contains base64 encoded PNG string `FinImageBase64`.
- **`widget/test-widget.js`**: Standalone unit test harness testing 7 scenario variants.
- **`index.js`**: Registers widget task handler `registerWidgetTaskHandler(widgetTaskHandler)`.
- **`app.json`** (Lines 64–78): Plugin configuration for `react-native-android-widget`:
  - `name`: `"FinScholarWidget"`, `label`: `"FinScholar Schedule"`, `minWidth`: `"180dp"`, `minHeight`: `"170dp"`, `targetCellWidth`: 3, `targetCellHeight`: 3, `resizeMode`: `"horizontal|vertical"`, `updatePeriodMillis`: 1800000.
- **Native Android Files**:
  - `android/app/src/main/res/xml/widgetprovider_finscholarwidget.xml`: XML provider definition.
  - `android/app/src/main/java/com/lalex/finscholar/widget/FinScholarWidget.java`: Native Java class extending `RNWidgetProvider`.

### 1.2 Asset & Design Resources
- Mascot Asset: `assets/images/finwidget.png` exists at `c:\Projects\FinScholarApp\assets\images\finwidget.png` (high-res PNG featuring dolphin mascot with graduation cap).
- Design Tokens (`constants/Theme.ts` & `constants/Colors.ts`): Palette tokens for light and dark modes.

### 1.3 Available Primitive Components in `react-native-android-widget`
- `FlexWidget`: supports `flexDirection`, `alignItems`, `justifyContent`, `flex`, `flexGap`, `backgroundColor`, `backgroundGradient: { from, to, orientation }`, `borderRadius`, `overflow: 'hidden'`.
- `TextWidget`: supports `text`, `maxLines`, `style` (`fontSize`, `fontWeight`, `color`).
- `ImageWidget`: supports `image` (`require(...)` or base64 URI), `imageWidth`, `imageHeight`, `style`.
- `IconWidget`: supports `icon`, `size`, `font`, `style`.
- `SvgWidget`: supports `svg` (XML string or `require(...)`), `style`.
- `OverlapWidget`: supports relative overlapping children stack.

---

## 2. Logic Chain

From the observations, the step-by-step logic chain for the redesign is as follows:

1. **Top Blue Gradient Section**:
   - `FlexWidget` with `backgroundGradient`:
     ```ts
     backgroundGradient: {
       from: '#3b82f6',
       to: '#1d4ed8',
       orientation: 'TL_BR'
     }
     ```
   - Must remain blue in both light mode AND dark mode. The outer/inner container for the top section will fix the gradient to blue regardless of `isDark`.
   - Embeds `ImageWidget` with `require('../assets/images/finwidget.png')` for the mascot.
   - Displays the active / main class (either `ONGOING` or `NEXT`) with title, room, time, and status badge.

2. **Wavy Divider**:
   - `SvgWidget` or `OverlapWidget` placed between top blue section and bottom upcoming classes section.
   - Using `SvgWidget` with inline SVG path (fill matching the bottom section background color) produces a clean, crisp vector wave transition.

3. **Bottom Section (Upcoming Classes List)**:
   - `FlexWidget` with `backgroundColor` adapting dynamically to dark mode:
     - Light Mode: `#ffffff` or `#f8fafc`.
     - Dark Mode: `#0f172a` or `#1e293b`.
   - Iterates over upcoming classes (excluding the top featured active class).
   - Renders white/dark rounded card containers for each upcoming class.

4. **Dynamic Subject Colors & Icons Mapping**:
   - Dynamic colors/icons based on class name must be **deterministic** across widget update cycles.
   - Deterministic Hash Algorithm:
     ```ts
     function getSubjectStyle(courseName: string) {
       let hash = 0;
       const name = (courseName || '').trim();
       for (let i = 0; i < name.length; i++) {
         hash = name.charCodeAt(i) + ((hash << 5) - hash);
       }
       const colorIdx = Math.abs(hash) % PALETTE.length;
       return PALETTE[colorIdx];
     }
     ```
   - Icon selection uses course name keyword matching (e.g. `CS`/`IT` -> code/laptop, `MATH`/`CALC` -> calculator, `PHYS`/`CHEM` -> science, default -> school/book).

5. **Flexbox Layout vs Hardcoded Heights**:
   - Hardcoded heights (e.g., `height: 350`) cause clipping when resized to 3x2, 3x3, 4x4 or tall cell dimensions.
   - Root `FlexWidget` must use `style={{ flex: 1, width: 'match_parent' }}`.
   - Top section uses `flex: 0.45` or `height: 'wrap_content'`.
   - Bottom section uses `flex: 1` with `overflow: 'hidden'`.
   - Text elements use `maxLines={1}` or `maxLines={2}` to prevent truncation crashes or line overflow.

6. **Preservation of Business & Edge Case Logic**:
   - `isOngoing` badge (`● ONGOING` vs `◎ NEXT`).
   - `timeRemainingStr` countdown calculations (`In progress`, `In Xm`, `In Xh Ym`, `In X day(s)`).
   - 12-hour `timeStr` formatting.
   - Deep link URL generation for app launch on click (`finscholarapp://schedule?viewMode=attendance...`).
   - Empty state fallback (`!classes || classes.length === 0`).
   - Defensive null checks for missing class fields (`courseName`, `room`, `timeStr`).

---

## 3. Caveats

- **Widget Render Limits**: `react-native-android-widget` converts React component trees into native Android `RemoteViews`. Complex SVG filters or un-supported CSS properties (e.g. `boxShadow`, `backdropFilter`) are not supported in native RemoteViews. All styling must use supported `FlexWidgetStyle` properties (`backgroundGradient`, `borderRadius`, `padding`, `backgroundColor`, etc.).
- **Asset Loading**: PNG assets in `react-native-android-widget` loaded via `require()` must exist at relative path during Metro bundling. `require('../assets/images/finwidget.png')` is valid and verified.

---

## 4. Conclusion

The existing Android widget implementation (`FinScholarWidget.tsx`, `WidgetTaskHandler.tsx`) has robust data handling, countdown logic, and error boundaries, but uses a basic single-container flat layout.

The redesign to match the tall mockup can be fully achieved using `react-native-android-widget` primitives without breaking native Android layout rules:
1. **Top Section**: Vibrant blue gradient (`TL_BR`) featuring `finwidget.png` mascot and active class info, static across light/dark modes.
2. **Wavy Divider**: Integrated via `SvgWidget` wave path vector overlay.
3. **Bottom Section**: Theme-aware upcoming class list (`#ffffff` light / `#0f172a` dark).
4. **Dynamic Subjects**: Deterministic string hash function for subject color themes and keyword mapping for icons.
5. **Flexbox Architecture**: `flex: 1` root wrapper, eliminating hardcoded container heights for seamless resizing.
6. **Zero Regression**: 100% preservation of `WidgetClassData` interface, `WidgetTaskHandler` storage queries, countdown logic, deep linking, and empty state fallbacks.

---

## 5. Verification Method

To independently verify the investigation findings and test suite:

1. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: Exits with code 0 and 0 errors.

2. **Project Test Suite**:
   ```bash
   npm test
   ```
   *Expected result*: All 71 tests across 20 suites pass.

3. **Widget Files Checklist**:
   - `widget/FinScholarWidget.tsx` (Widget component)
   - `widget/WidgetTaskHandler.tsx` (Data loader & task handler)
   - `assets/images/finwidget.png` (Mascot asset)
   - `index.js` (Task handler registration)
   - `app.json` (Widget manifest plugin configuration)

4. **Invalidation Conditions**:
   - If hardcoded absolute heights (e.g. `height: 400`) are used in top/bottom containers.
   - If top gradient switches to light/dark background instead of remaining blue.
   - If class colors change randomly between widget refresh cycles instead of being deterministic based on class name.
