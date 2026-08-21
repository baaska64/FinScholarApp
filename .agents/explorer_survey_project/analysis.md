# FinScholarApp — Project Survey & Architecture Analysis

## 1. Executive Summary
This report provides a comprehensive architectural survey of the FinScholarApp project, covering its tech stack, dependencies, TypeScript compilation status, testing infrastructure, navigation and authentication lifecycle, Android widget configuration, and file structure.

---

## 2. Project Architecture & Dependencies

### Tech Stack
- **Framework:** React Native `0.81.5` on Expo SDK `~54.0.0`
- **Routing:** Expo Router `~6.0.24` with typed routes enabled (`experiments.typedRoutes: true`)
- **Language / Compiler:** TypeScript `^5.3.3`
- **Styling:** NativeWind `^4.2.6` (Tailwind CSS `^3.4.19`) with custom design tokens in `constants/Theme.ts`
- **Backend / Authentication:** Supabase (`@supabase/supabase-js: ^2.110.5`) + `@react-native-async-storage/async-storage: 2.2.0`
- **OAuth Integration:** `@react-native-google-signin/google-signin: ^16.1.4`
- **Android Home Screen Widget:** `react-native-android-widget: ^0.21.0`
- **Monetization / Purchases:** RevenueCat (`react-native-purchases: ^10.4.4`)
- **Animation / UI:** `react-native-reanimated: ~4.1.1`, `react-native-screens: ~4.16.0`, `react-native-safe-area-context: ~5.6.0`, `react-native-svg: 15.12.1`, `react-native-view-shot: 4.0.3`

### TypeScript Configuration (`tsconfig.json`)
- Extends: `expo/tsconfig.base`
- Target module: `esnext`
- Strict type-checking: `strict: true`
- Path mapping: `@/*` mapped to `./*`
- Includes: `**/*.ts`, `**/*.tsx`, `.expo/types/**/*.ts`, `expo-env.d.ts`, `nativewind-env.d.ts`
- Excludes: `node_modules`, `supabase`

### App Configuration (`app.json`)
- App Name: `FinScholarApp`
- Package Name: `com.lalex.finscholar`
- Scheme: `finscholarapp`
- Version: `1.0.4` (Version code: `19`)
- Plugins configured:
  - `expo-router`
  - `expo-splash-screen`
  - `expo-media-library`
  - `expo-notifications`
  - `react-native-android-widget` (configured with `FinScholarWidget`)
  - `expo-build-properties`
  - `@react-native-google-signin/google-signin`

---

## 3. Build and Test Setup

### TypeScript Compilation Status
- Command executed: `npx tsc --noEmit`
- Result: **Passed cleanly with Exit Code 0 (0 errors, 0 warnings)**.

### Test Suite Execution
- Command: `npm test` (`node --experimental-strip-types scripts/run-tests.js`)
- Test Results:
  - **Suites:** 38 passed, 38 total
  - **Tests:** 133 passed, 0 failed, 133 total
  - **Duration:** ~0.90s
- Covered Modules:
  - Widget rendering, layout contracts, compaction, deep link handling (`__tests__/widget.test.js`, `__tests__/widgetTaskHandler.test.js`)
  - Subject styling, deterministic color hashing, theme tokens (`__tests__/subjectUtils.test.js`, `widget/subjectUtils.ts`)
  - Schedule & attendance calculations (`__tests__/schedule.test.js`, `__tests__/schedule-redesign-stress.test.js`)
  - Ledger & GWA computations (`__tests__/ledger.test.js`)
  - Multi-tier stress & boundary tests (Tiers 1–4, challenger stress tests)

---

## 4. Navigation Flow & Authentication Lifecycle

### Navigation Tree (`app/`)
```
app/
├── _layout.tsx           # Root provider wrapper & Stack navigator
├── index.tsx             # Auth gatekeeper (Session check -> /(tabs) or /welcome)
├── welcome.tsx           # Onboarding screen with Sign In / Sign Up / Guest CTA
├── login.tsx             # Auth form (Email/Password, Google Sign-in button, Guest link)
├── modal.tsx             # Generic presentation modal
└── (tabs)/               # Bottom tab navigator
    ├── _layout.tsx       # CustomTabBar layout
    ├── index.tsx         # Dashboard / Home
    ├── grades.tsx        # Grade Tracker & GWA ledger
    ├── schedule.tsx      # Timetable & attendance
    ├── calendar.tsx      # Visual month calendar & event manager
    ├── requirements.tsx  # Task manager / to-do
    ├── flashcards.tsx    # Study tool
    ├── profile.tsx       # Profile, Appearance, Settings & Logout (hidden tab)
    └── academic-manager.tsx # Academic terms management (hidden tab)
```

### Authentication Flow & State Listener
1. **App Launch (`app/index.tsx`):**
   - Retrieves active session via `supabase.auth.getSession()`.
   - Attaches `supabase.auth.onAuthStateChange()`.
   - If session exists: redirects to `/(tabs)`.
   - If no session (first launch / logged out): redirects to `/welcome`.

2. **Welcome Screen (`app/welcome.tsx`):**
   - Directs user to `/login?mode=signin` or `/login?mode=signup`.
   - Provides guest access button that redirects straight to `/(tabs)`.

3. **Login Screen (`app/login.tsx`):**
   - Email/password authentication via `supabase.auth.signInWithPassword` and `supabase.auth.signUp`.
   - Password reset via `supabase.auth.resetPasswordForEmail`.
   - **Google Sign-In Button status:** Currently wired to a placeholder dummy handler (`handleGoogleSignIn` at lines 139–142) logging to console. It requires `@react-native-google-signin/google-signin` initialization and `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`.

4. **Data Sync Lifecycle (`services/SyncService.ts` & `components/SyncProvider.tsx`):**
   - `SyncService` listens to Supabase auth events.
   - On `SIGNED_IN`, resets initial sync guard and triggers `sync()`.
   - Handles conflict resolution between local `AsyncStorage` (`grade_ledger_v2_data`) and Supabase table `user_ledgers`.
   - On logout in `app/(tabs)/profile.tsx`, clears local ledger cache and redirects to `/login`.

---

## 5. Android Home Screen Widget Architecture

### Native & JS Registration
- **JS Widget Component:** `widget/FinScholarWidget.tsx` (using `react-native-android-widget` primitives: `FlexWidget`, `TextWidget`, `SvgWidget`).
- **Background Task Handler:** `widget/WidgetTaskHandler.tsx` (reads `AsyncStorage`, parses active semester classes, calculates ongoing/upcoming classes, requests widget update).
- **Update Triggers:**
  - App launch (`app/_layout.tsx`)
  - System theme changes (`Appearance.addChangeListener` in `app/_layout.tsx`)
  - Data changes (`SyncService.pushLocalChanges`)
- **Native Configuration:**
  - `app.json`: `react-native-android-widget` plugin entry with widget dimensions and update interval.
  - `android/app/src/main/res/xml/widgetprovider_finscholarwidget.xml`: Native widget provider XML metadata.
  - Current configuration uses 4x5 grid (`targetCellWidth: 4`, `targetCellHeight: 5`, `minWidth: 250dp`, `minHeight: 320dp`), ready for optimization to 3x2 grid (`targetCellWidth: 3`, `targetCellHeight: 2`, `minHeight: 110dp`) as specified in R2.

---

## 6. Key Source Paths Reference Table

| Category | File Path | Purpose |
|---|---|---|
| **Root Layout** | `app/_layout.tsx` | Fonts, splash screen, providers, root Stack navigation, widget initial sync |
| **Auth Gateway** | `app/index.tsx` | Root session check and redirect |
| **Welcome Screen** | `app/welcome.tsx` | Landing screen, onboarding, guest bypass |
| **Login Screen** | `app/login.tsx` | Authentication UI (Email/Password, Google OAuth button) |
| **Tab Layout** | `app/(tabs)/_layout.tsx` | Tab navigation definition and custom tab bar |
| **Profile & Settings**| `app/(tabs)/profile.tsx` | Theme toggle, widget preview modal, account logout |
| **Supabase Client** | `services/supabaseClient.js` | Supabase SDK client initialization & SafeStorage adapter |
| **Sync Service** | `services/SyncService.ts` | Offline/online synchronization, conflict detection & resolution |
| **Notifications** | `services/NotificationService.ts` | Local notification scheduling for upcoming classes |
| **Widget UI** | `widget/FinScholarWidget.tsx` | Native Android widget layout tree |
| **Widget Handler** | `widget/WidgetTaskHandler.tsx` | Schedule query, countdown computation, widget update invocation |
| **Subject Utils** | `widget/subjectUtils.ts` | Subject color hashing, subject icons, dark/light theme tokens |
| **Theme Constants** | `constants/Theme.ts` | Light/Dark color palette, typography, spacing, radius |
| **Android Manifest** | `android/app/src/main/AndroidManifest.xml` | App permissions, deep linking intent-filters, widget receiver |
| **Widget Provider XML** | `android/app/src/main/res/xml/widgetprovider_finscholarwidget.xml` | Android AppWidgetProvider configuration |
| **Test Runner** | `scripts/run-tests.js` | Custom test execution harness |
