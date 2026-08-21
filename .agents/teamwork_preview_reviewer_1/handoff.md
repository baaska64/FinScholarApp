# Adversarial Review & Handoff Report: Tasks & Pomodoro UI Redesign

**Role**: Adversarial Improvement Worker (Review Round 1)  
**Target Path**: `app/(tabs)/requirements.tsx` & `components/tasks/`  
**Date**: 2026-08-16  

---

## 1. Summary of Adversarial Findings & Defect Fixes

### Issue 1: Background Timer State Preservation & Drift Mitigation (PomodoroCard.tsx)
- **Problem**: React Native's `setInterval` is heavily throttled/suspended by the native OS when the application enters the background or the screen locks. Resuming the application would lose countdown progress.
- **Root Cause**: The timer relied purely on incremental tick decrements (`timeLeft - 1`) rather than timestamp diffing against a target completion timestamp.
- **Fix**: 
  - Integrated `AppState` listener to detect transitions between `background`/`inactive` and `active`.
  - Stored `targetEndTimeRef.current = Date.now() + timeLeft * 1000`.
  - Recalculated exact remaining seconds upon foreground return: `Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000))`.
  - Added timestamp-synced `+5m` extension and duration bounding so progress percentages remain strictly in `[0, 100]` without underflow.

### Issue 2: Gesture Direction Lock & ScrollView Conflict Mitigation (TaskIslandCard.tsx)
- **Problem**: Horizontal swipe gesture triggers could interfere with vertical scrolling in the parent `ScrollView`.
- **Root Cause**: `onMoveShouldSetPanResponder` checked only fixed pixel thresholds (`Math.abs(dx) > 15 && Math.abs(dy) < 15`) without enforcing a dominant horizontal vector ratio or termination handling.
- **Fix**:
  - Implemented strict horizontal vector locking: `Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8`.
  - Added `onPanResponderTerminationRequest: () => false` and `onPanResponderTerminate` to smoothly spring the card back if interrupted.

### Issue 3: Urgency Calculation Substring Collision (TaskIslandCard.tsx)
- **Problem**: Urgency helper erroneously categorized `"3 hrs 10 mins left"` as short-term minutes urgency (`#f97316`) instead of hourly urgency (`#f59e0b`).
- **Root Cause**: Substring check evaluated `'m '` before `'hr'`, causing multi-hour strings with minute components to trigger the minutes branch prematurely.
- **Fix**: Re-ordered evaluation to check `'day'` and `'hr'` prior to minute/second sub-components.

### Issue 4: Dynamic Term Switching & Subject Filter Desynchronization (requirements.tsx)
- **Problem**: When a user switched academic terms (year/semester) or navigated with route params, if the previously selected subject filter ID did not exist in the new semester, the list rendered empty.
- **Root Cause**: No fallback mechanism existed when `selectedSubjectFilter !== 'ALL'` pointed to a subject outside the active semester.
- **Fix**: Added synchronization effect to automatically reset `selectedSubjectFilter` to `'ALL'` whenever the active filter is not found in the current semester's subjects. Also passed `initialSubjectId` to `TaskFormModal` for intuitive preselection.

### Issue 5: Pomodoro Control Button Label Consistency (PomodoroCard.tsx)
- **Problem**: When switched to Break mode, the play button read "Start Focus" instead of "Start Break".
- **Fix**: Dynamically rendered button label based on `timerMode` (`Start Focus` vs `Start Break`).

---

## 2. Verification Record

### Deep Verification (Ran Actual Tests & Bundlers)
- **Full Test Suite (`npm test`)**:
  - **182/182 tests PASSED** across all **51 test suites** (0 failures).
  - Validated all 7 Tasks & Pomodoro Redesign suites:
    1. Timer formatters, boundary clamping, and `+5m` extensions.
    2. Real-time urgency countdown tickers across ISO and legacy formats.
    3. Multi-criteria filtering (subject, search query, status, overdue) and sorting (due date, priority, title, status).
    4. Grade ledger item synchronization (`syncGradeItem` insertion, updating, removal, subject shifts).
    5. Interactive checklist subtask creation, toggling, counting, and deletion.
    6. Edge cases, invalid inputs, urgency colors, gesture predicates, and subject filter fallbacks.
    7. AppState background recovery math and timer mode switching invariants.
- **TypeScript Compilation Check (`npx tsc --noEmit`)**:
  - Exit code 0 (0 errors).
- **Expo Bundler Export (`npx expo export --platform android`)**:
  - Exit code 0 (1857 modules bundled successfully, Android bytecode generated at `_expo/static/js/android/index-*.hbc`).

### Shallow Verification (Code Review & Manual Logic Trace)
- Verified NativeWind theme tokens (`getTheme(isDark)`) across all island components.
- Verified Mascot image asset resolution (`assets/images/studying.png`, `happy.png`, `sleeping.png`).

---

## 3. Known Issues
- `Shallow Verification`: Visual inspection in physical simulator recommended to verify haptic touch feel.

---

## 4. Remaining Risk & Conclusion
All functional requirements (R1, R2, R3) and verification criteria are completely satisfied and rigorously tested. The task is fully complete.
