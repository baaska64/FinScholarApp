# FinScholar Release Procedure & QA Guide

This document outlines the standard operating procedure for preparing, testing, and shipping new versions of the FinScholar app.

## 1. Version Bumping
Before generating an AAB/APK for release, ensure all internal version references are updated.

- [ ] Update `"version"` inside `package.json` (e.g. `"1.0.5"`).
- [ ] Update `"version"` inside `app.json` (e.g. `"1.0.5"`).
- [ ] Increment `"versionCode"` in `app.json` under `android` (e.g., from `19` to `20`).

## 2. Generating the Changelog Modal
When releasing new features, users should be notified on their first launch of the new version.
- [ ] Update the `CURRENT_VERSION` constant in `components/ChangelogModal.tsx` to match the new version.
- [ ] Update the `ChangelogItem` list inside `components/ChangelogModal.tsx` with the new release highlights.

## 3. Supabase Version Bump
We track the latest version in the Supabase backend (`app_versions` table) so older apps can display a forceful update warning.

- [ ] Create a new migration file inside `supabase/migrations/`:
  ```sql
  INSERT INTO public.app_versions (id, latest_version, update_message, store_url)
  VALUES (1, '1.0.5', 'Update message here', 'store_link')
  ON CONFLICT (id) DO UPDATE SET 
      latest_version = EXCLUDED.latest_version,
      update_message = EXCLUDED.update_message;
  ```
- [ ] Push the migration to the production remote project via:
  `npx supabase db push`
  *(Note: You can also copy/paste the SQL into the Supabase web dashboard SQL editor).*

## 4. Building the Production AAB
Once all files are updated and pushed to git:
- [ ] Run `eas build -p android --profile production` (or `npx expo build:android`).
- [ ] Download the generated `.aab` file from the Expo dashboard.

## 5. Closed Testing QA Checklist
Before rolling out to Production in Google Play Console, deploy the `.aab` to the Closed Testing track and have testers run through this checklist:

### A. Core Functionality
- [ ] Does the app launch without crashing?
- [ ] Does the new Changelog modal appear on the first launch?
- [ ] Does the Changelog modal NOT appear on the second launch?
- [ ] Is authentication (Google/Email login) working correctly?
- [ ] Can users create, edit, and delete Tasks?
- [ ] Does the Pomodoro timer properly start, pause, and log sessions?

### B. UI/UX Integrity
- [ ] Do all new UI elements scale correctly on small devices?
- [ ] Are there any text-wrapping issues or cut-off widgets?
- [ ] Does Dark Mode look correct for all new components?

### C. OS Integrations
- [ ] Does the Android Home Screen Widget update correctly when tasks change?
- [ ] Do local notifications fire correctly when the Pomodoro timer finishes in the background?
