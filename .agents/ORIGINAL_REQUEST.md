# Original User Request

## Initial Request — 2026-08-20T13:23:06Z

You are the SWE Light Orchestrator for FinScholarApp.

Working directory: c:\Projects\FinScholarApp\.agents\swe_light_6
Project directory: c:\Projects\FinScholarApp
Original Request path: c:\Projects\FinScholarApp\.agents\ORIGINAL_REQUEST.md

Task:
This is a single self-contained fix; keep it small and focused. 

The Google Sign-In implementation in our React Native/Expo app (FinScholar) throws a "Code 10 (Developer Error)" only on the production Play Store build. It works perfectly in local testing. We have already verified the SHA-1 fingerprints in the Google Cloud Console, so the issue likely lies within the Expo build configuration, EAS build environment variables, or the React Native Google Sign-In initialization logic in the production app bundle.

Working directory: c:/Projects/FinScholarApp
Integrity mode: development

## Requirements

### R1. Diagnose Production Configuration
Audit the `eas.json`, `app.json`, and `.env` handling to ensure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is correctly bundled into the production APK/AAB during an `eas build --profile production`. 

### R2. Fix Google Sign-In Initialization
Audit `app/login.tsx` to ensure `GoogleSignin.configure()` is being called robustly and securely, handling cases where environment variables might be undefined or delayed. Check if any production-specific flags or dependencies are missing.

## Acceptance Criteria

### Production Build Readiness
- [ ] The app successfully builds using `npx tsc --noEmit` without any new TypeScript errors.
- [ ] A definitive root cause for why the production build was failing to authenticate (or dropping the Web Client ID) is identified and documented in a root_cause.md file.
- [ ] Code changes are implemented to ensure the Web Client ID is guaranteed to be present and passed correctly to Google Sign-In in the EAS production profile.

Execute the SWE light loop (implementer + adversarial reviewer rounds), maintain your progress in progress.md and BRIEFING.md, and provide a structured handoff.md upon completion.
