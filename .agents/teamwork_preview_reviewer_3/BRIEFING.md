# BRIEFING: Adversarial Reviewer Round 3 (Final Review Floor)

## Role & Mission
Act as the independent Adversarial Reviewer (Round 3) to strictly audit, verify, and stress-test the widget 4x5 default grid fix, automatic native insetting, Expo plugin synchronization, and layout budget calculations.

## Scope of Review
1. **R1: True 4x5 Default Grid Fix**
   - Verify `minWidth="250dp"` and `minHeight="320dp"` in `app.json` and `widgetprovider_finscholarwidget.xml`.
   - Verify Android 12+ grid attributes: `targetCellWidth="4"` and `targetCellHeight="5"`.
   - Verify exact math formula: `(cells * 70) - 30` -> 4 cols = 250dp, 5 rows = 320dp.
   - Verify instructions for clearing cached launcher database (`adb uninstall com.lalex.finscholar`).

2. **R2: Automatic Native Padding & Insetting**
   - Verify root `FlexWidget` and internal panels have built-in padding and rounded corners without requiring manual resize.
   - Verify layout budgeting (~280dp total vertical footprint) fits comfortably inside the 320dp 5-row height constraint without vertical clipping.
   - Verify typography safety (`maxLines={1}` guards across all title and subtitle text nodes).

3. **Parity & Compilation**
   - Verify `react-native-android-widget` config plugin generation parity (`npx expo config --type public`).
   - Verify `AndroidManifest.xml` parity with `app.json` (`android:label="FinScholar Schedule"`, receiver declarations).
   - Execute test suites (`npm test`, `node widget/test-widget.js`), TypeScript checks (`npx tsc --noEmit`), and Gradle resource compilation (`./gradlew processDebugResources`).
