# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm start              # Expo dev server (dev-client build required; Expo Go will not load native modules)
npm run android        # expo run:android — native build
npm run web            # expo start --web
npm test               # full suite (custom runner, ~415 assertions, ~2s)
npx tsc --noEmit       # the only static gate — there is no ESLint/Prettier config in this repo
```

Run `npx tsc --noEmit` and `npm test` before declaring work done. Both are fast.

### Running one test suite

`scripts/run-tests.js` has no filter flag. To run a single file, drive its exported entry point directly (from the repo root, since the loader resolves `@/` against `cwd`). The `EXPO_PUBLIC_SUPABASE_*` placeholders matter: `services/supabaseClient.js` throws without them, and some suites import it.

```bash
EXPO_PUBLIC_SUPABASE_URL=http://localhost/x EXPO_PUBLIC_SUPABASE_ANON_KEY=x node --experimental-strip-types --input-type=module -e "import { register } from 'node:module'; import { pathToFileURL } from 'node:url'; register('./scripts/test-loader.js', pathToFileURL(process.cwd() + '/')); globalThis.require ??= (s) => s; const mod = await import(pathToFileURL(process.cwd() + '/__tests__/spotlight.test.js').href); let p = 0, f = 0; Object.values(mod).find(v => typeof v === 'function')((n, fn) => { console.log('== ' + n); fn(); }, (n, fn) => { try { fn(); p++; } catch (e) { f++; console.log('FAIL ' + n + ': ' + e.message); } }); console.log(p + ' passed, ' + f + ' failed');"
```

## Testing architecture

Not Jest. `scripts/run-tests.js` is a hand-rolled harness that passes its own `describe`/`test` into each suite.

- Every suite file exports **one function** (`export function runFooTests(describe, test) { ... }`) using `node:assert`. A new suite does nothing until it is imported and invoked in `scripts/run-tests.js`. Test bodies may be `async`: the harness queues every suite and test onto one promise chain and awaits it before printing the summary, so they run in order and their assertions actually count.
- `scripts/test-loader.js` is a Node module-resolution hook that maps the `@/*` alias, strips TypeScript, and swaps `react-native`, `expo-router`, `expo-constants`, AsyncStorage, google-signin and the widget lib for stubs in `scripts/mocks/`.
- Consequence: **tests cover pure logic only** — calculators, date/urgency math, ledger mutations, scanner parsing, geometry. Nothing renders. A green suite says nothing about layout, so UI changes still need a device check. The one exception is the widget family: widgets are pure functions returning the library's element tree, so `__tests__/helpers/widgetTree.js` walks and *measures* that tree (`requiredHeight`) and the suites assert a widget never composes taller than the box it was handed.
- Logic that needs coverage is extracted out of screens: `utils/calculator.js`, `utils/onboardingProgress.ts`, `utils/spotlightGeometry.ts`, `utils/subjectRegistry.ts`, `utils/calendarModel.ts`, `utils/taskModel.ts`, `utils/gradeEntry.ts`, `__tests__/helpers/dashboardCalculations.js`. Put new testable logic there rather than inside a `.tsx` screen.

## The data model — read this first

The entire app is **one JSON document**, not a set of tables:

```
{ settings: { gradingSystem, taskThresholds, dailyGoal },
  flashcards: { decks, settings, stats },
  years: [ { id, name, semesters: [ { id, name, startDate, endDate,
                                     subjects: [ { id, name, code, units, colorIdx,
                                                   requirements: [...], gradeTrackingEnabled, hasSchedule } ],
                                     classes: [ { id, name, day, startHour, duration, room, subjectId, colorIdx } ],
                                     milestones: [...],
                                     attendanceLog: { "<YYYY-MM-DD>_<classId>": { status, isManual } } } ] } ] }
```

- Stored under AsyncStorage key **`grade_ledger_v2_data`**, mirrored to Supabase `user_ledgers.ledger_data` (one row per user).
- `day` is **0 = Monday … 6 = Sunday**, not JS `getDay()`. Screens convert with `getDay() === 0 ? 6 : getDay() - 1`.
- `startHour` is a **float** (13.5 = 1:30 PM); `duration` is in hours.
- The active term is **global state**, not props: `useSemesterContext()` gives `selectedYear` / `selectedSemester`, persisted under `@selectedYear` / `@selectedSemester`. Screens resolve `currentSem` by finding those ids in `data.years`.

### The write pattern

Every mutation follows this shape. Deep-clone, mutate the clone, set state, persist:

```ts
const nd = JSON.parse(JSON.stringify(data));
const sem = nd.years?.find(y => y.id === activeYearId)?.semesters?.find(s => s.id === activeSemId);
// ...mutate sem...
setData(nd);
SyncService.pushLocalChanges(nd);   // writes AsyncStorage AND pushes to Supabase
```

`pushLocalChanges` already writes AsyncStorage; some call sites also call `AsyncStorage.setItem` first, which is redundant but harmless. Never mutate `data` in place — several screens re-read from AsyncStorage on focus and will clobber unsaved in-place edits.

## Sync and auth

`services/SyncService.ts` is a singleton with subscriber lists (`subscribe` for state, `subscribeDataChange` for data, `subscribeConflict`). Non-obvious behaviour:

- **Login is guarded.** `initialSyncComplete` blocks all remote pushes until the first `sync()` after `SIGNED_IN` finishes, so a guest's local ledger cannot silently overwrite an existing cloud ledger. Do not push around this guard.
- **Conflicts are a UI state.** When local and remote both changed, state becomes `'conflict'` and `SyncProvider` shows a keep-local/keep-remote modal. `@last_synced_timestamp` is the arbiter.
- **Auth is optional throughout.** The app is fully functional as a guest; `syncStatus` is just `'offline'`. Never gate a feature on `user` being non-null unless it genuinely needs the server.
- Premium is `SyncService.getIsPremium()` (RevenueCat, cached in `@is_premium`) — that call, not a Supabase lookup, is the app-wide paywall gate.

## Routing and navigation

Expo Router file-based routes under `app/`. The `(tabs)` group holds eight screens, but `components/CustomTabBar.tsx` hardcodes only **six** in its `TABS` array (Home/Grades/Schedule/Calendar/Tasks/Study) — `academic-manager` and `profile` are tab routes reached only by `router.push`. Adding a tab file does not add a tab button.

Route names differ from their labels: **Tasks = `requirements`**, **Study = `flashcards`**, **Home = `index`**.

The tab bar is `position: 'absolute'`, so screens must reserve its height themselves (see the `tabBarHeight` calculation in `app/(tabs)/schedule.tsx`) rather than relying on the bottom safe-area inset.

Cross-screen deep links carry params: `/(tabs)/schedule?viewMode=attendance&targetDate=…&trigger=…`, `/(tabs)/requirements?subjectId=…`. The Android widget links in via the `finscholarapp://` scheme.

## Styling

Two systems coexist. Prefer the second for new code:

1. **NativeWind** `className` strings (Tailwind config in `tailwind.config.js`, `darkMode: 'class'`). Older screens.
2. **`constants/Theme.ts`** — `getTheme(isDark)` plus `Radius`, `Shadows`, `Spacing`, `Typography` tokens applied as inline styles. Newer screens and all shared UI.

**Never pass a function to a `style` prop.** `patches/react-native-css-interop+0.2.6.patch` wraps every RN component and remaps `style`; a `style={({ pressed }) => ({...})}` callback on `Pressable` is silently dropped, taking that element's layout with it. Use a static object plus `TouchableOpacity`'s `activeOpacity` — that is what every component in this repo does.

Dark mode comes from `useColorScheme()` **from `nativewind`**, not React Native. Fonts are Nunito only (`Nunito_400Regular` … `Nunito_900Black`), loaded in `app/_layout.tsx`; a missing weight silently falls back to the system font.

Shared primitives in `components/ui/` are the design system — `Card`, `ProgressBar`, `SectionHeader`, `Badge`, `AnimatedPressable`, `LoadingSkeleton`. Build from these instead of restyling a `View` by hand; `APP_CONTEXT.md` documents the intent behind each.

## Other subsystems

- **Calendar** (`app/(tabs)/calendar.tsx`, `components/calendar/`): the tab merges three sources into one dated stream — `sem.milestones` (events, from *every* term), `subject.requirements[].dueDate` (task deadlines) and `sem.classes` (derived per date). `utils/calendarModel.ts` owns all of that plus every date conversion; do the maths there, not in the screen, and never through `toISOString()` — it is UTC and shifts the day. `components/calendar/calendarTheme.ts` is the only event palette. Term `startDate`/`endDate` gate class derivation, so a date outside the term has no classes.
- **Grades** (`app/(tabs)/grades.tsx`, `components/ledger/`): the subject screen (`ActiveSubjectView`) shows periods as tabs and every score as a read-only row that opens `ScoreSheet`; periods/components edit in `GroupSheet`, subject fields in `SubjectSheet`. Sheets hold a draft and commit on Save — never wire a live `TextInput` to `onChange`, it pushes the whole ledger per keystroke. Tree edits go through `utils/gradeEntry.ts` (path-addressed, always return a new subject); `Calculator` stays the only grade maths. Every grade respects `settings.ungradedScores` (`readUngradedMode`) — pass it as `calculateSubject`'s 4th / `calculateSemester|Year|Cumulative`'s 3rd argument at any new call site, or that surface silently disagrees with the Grades tab.
- **Tasks** (`app/(tabs)/requirements.tsx`, `components/tasks/`): tasks are grouped by **due bucket** (overdue → today → tomorrow → this week → later → no date), never by status, and only non-empty groups render. `utils/taskModel.ts` owns the bucketing, counts, digest line, filtering and sorting — put new task logic there. Submitted/graded tasks leave the timeline for a collapsed Done section. The Pomodoro's state is `useFocusTimer` held by the *screen* so a session survives closing its sheet; `syncGradeItem` mirrors a graded task into the subject's grade ledger and must stay in step with the Grades tab.
- **Study** (`app/(tabs)/flashcards.tsx`, `components/study/`): Anki's model with FSRS-6 scheduling. `scheduler.ts` owns answering, daily limits, queues and the 4 AM study-day rollover; `notes.ts` owns note types (Basic, Both ways, Cloze, Type answer), cloze parsing and note → card generation. There is no notes array — siblings share `noteId` and carry the note's fields, so the ledger stays plain cards and legacy cards need no migration. Button intervals are previewed by running the real `answerCard`, and fuzz is seeded, so they always match. Saves go through `persist`, which serialises writes and ignores its own data-change echo — do not await `SyncService` between cards. `APP_CONTEXT.md` has the rationale.
- **Guided tour** (`components/spotlight/`): a provider at the root of `app/_layout.tsx` keeps a registry of measured targets. Wrap a control in `SpotlightTarget` with an id from `constants/tours.ts`, then reference that id from a step. Register each id from exactly one mounted place — that is why `Tabs` takes an optional `spotlightId`. A test asserts every step points at a known id. `APP_CONTEXT.md` has the full rationale, including performance traps not to reintroduce.
- **Android widgets** (`widget/`): a family of five, all reading the same ledger. `widgetData.ts` builds one pure `WidgetSnapshot` per update; `widgetLayout.ts` derives every dimension from the launcher's `widgetInfo`; `widgetTheme.ts` holds the tokens (and mirrors `ClassPalette` from `constants/Theme.ts`); `widgetUi.tsx` holds the shared pieces. `WidgetTaskHandler.tsx` renders each widget as `{ light, dark }` and its `WIDGET_REGISTRY` must match the `widgets` array in `app.json` — a test asserts it. Widget text is always `allowFontScaling={false}` and single-line, deep links use `OPEN_URI` (never `OPEN_APP`, which drops the uri), and copy stays inside Latin-1 because Nunito is loaded as a custom typeface with no per-glyph fallback. Adding or resizing a widget needs a native rebuild. `APP_CONTEXT.md` has the design rationale.
- **`patches/react-native-css-interop+0.2.6.patch`** is applied by a `postinstall` patch-package hook. Do not delete `patches/`; reinstalls depend on it.
- **Config** lives in `app.json` (scheme `finscholarapp`, package `com.lalex.finscholar`). `services/supabaseClient.js` **throws at startup** if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing — there are no fallbacks, so a misconfigured build fails instead of silently writing to production. Local runs read `.env` (copy `.env.example`); EAS builds read the `env` block in each `eas.json` profile; `scripts/run-tests.js` sets inert placeholders. `README.md` holds the RevenueCat/Play Console product-id setup and the release SHA-1.

## Conventions

- Path alias `@/*` → repo root, used by both app code and the test loader.
- Screens are large single files that hold their own data loading (`useFocusEffect` → read AsyncStorage) and their own logic. That is the existing shape; match it rather than introducing a store, and extract only pure logic into `utils/`.
- `AlertService.alert(...)` from `components/CustomAlert` replaces `Alert.alert` for themed dialogs.
- Comments in this codebase explain *why* a non-obvious choice was made (a guard, a performance trap, a platform quirk). Match that; skip comments that restate the code.
