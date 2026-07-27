# FinScholar Release Process Documentation

This document outlines the standard operating procedure for preparing, building, and deploying FinScholar to the Google Play Store.

## 1. Versioning Strategy
We follow semantic versioning rules (`MAJOR.MINOR.PATCH`) for `app.json`:
- **PATCH (1.0.x):** Bug fixes, minor UI tweaks (e.g., padding adjustments).
- **MINOR (1.x.0):** New backward-compatible features (e.g., Early Bird paywall).
- **MAJOR (x.0.0):** Massive redesigns or breaking architecture changes.

> [!NOTE]
> When building for Android with EAS, the internal `versionCode` (which Google Play requires to be strictly incremented) is automatically managed by the cloud build servers thanks to `"autoIncrement": true` in `eas.json`. You only need to bump the semantic `"version"` string.

## 2. Pre-Release Checklist
Before triggering a production build, verify the following:
- [ ] You have run `npx tsc --noEmit` to ensure there are no TypeScript errors.
- [ ] `app.json` semantic version is properly bumped.
- [ ] If there are new database schema changes, they are pushed to Supabase (`npx supabase db push --include-all`).
- [ ] Supabase `app_versions` table is updated with the new `latest_version` string to trigger update warnings for older clients.
- [ ] All changes are fully committed to Git (EAS requires a clean working tree).

## 3. Building for Production (AAB)
To generate the Android App Bundle (`.aab`) required by the Google Play Console:

```bash
eas build --platform android --profile production
```
1. Wait for the build to queue and finish on the Expo cloud servers.
2. Download the resulting `.aab` file from the Expo dashboard link provided in the terminal.

## 4. Google Play Deployment
1. Log in to the [Google Play Console](https://play.google.com/console).
2. Navigate to **FinScholar**.
3. Select your track:
   - **Internal Testing:** For QA and fast distribution to authorized testers.
   - **Closed Testing:** For a broader pool of beta testers.
   - **Production:** For public release.
4. Create a new release, upload the `.aab` file, and paste your release notes.
5. Save and send for review.

## 5. Handling Mandatory/Soft Updates
FinScholar has a built-in soft update warning system.
To notify users of a new update:
1. Go to the Supabase SQL Editor.
2. Run the following command with the new version:
```sql
UPDATE public.app_versions
SET latest_version = '1.0.2',
    update_message = 'A critical new update is available!'
WHERE id = 1;
```
Users on an older semantic version will now see a friendly modal prompting them to update when they launch the app.
