# Root Cause Analysis: Google Sign-In "Code 10 (Developer Error)" in Production Play Store Builds

## Executive Summary
Google Sign-In on Android failed exclusively on production Google Play Store builds with **"Code 10 (Developer Error)"** (`CommonStatusCodes.DEVELOPER_ERROR` = 10) while succeeding in local development. Our comprehensive architectural and native code audit revealed three contributing failure mechanisms:

1. **Missing Fallback & Environment Variable Dropping in Standalone/EAS Builds**: `.env` is gitignored and omitted from EAS cloud build archives; `eas.json` only declared `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` for the `production` profile (leaving `preview` and `development` unconfigured), and standalone Gradle release builds (`export:embed`) do not parse `eas.json`. In `app/login.tsx`, `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` lacked any fallback constant or `Constants.expoConfig` integration, resulting in `undefined` or `""` (empty string) being passed to native Google Sign-In options.
2. **Unnecessary `offlineAccess: true` Triggering Server Auth Code Developer Error**: `app/login.tsx` requested `offlineAccess: true`. In native Android (`RNGoogleSigninModule.java` and `Utils.java`), this triggers `googleSignInOptionsBuilder.requestServerAuthCode(webClientId)`. FinScholar uses Supabase Auth via OpenID Connect ID Token (`supabase.auth.signInWithIdToken`), which strictly consumes `idToken` and never needs a server auth code. Requesting server auth code without explicit backend server OAuth redirect URI authorization causes Google Play Services to reject the request with Developer Error (Code 10).
3. **Poisoned Client Initialization via Empty String on Screen Mount**: In `app/login.tsx`, `useEffect` called `GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '', ... })`. When the environment variable was undefined at mount time, it initialized the native `GoogleSignInClient` without calling `requestIdToken()`, causing subsequent sign-in flows to either race on re-configuration or fail to retrieve the ID token.

---

## Detailed Root Cause Breakdown

### 1. Environment Variable Lifecycle & Metro Bundling in Production
- **Local Dev vs. EAS/Production**:
  - In local development, Metro reads `.env` directly from the local disk workspace.
  - In EAS Cloud builds, `.env` is ignored by `.gitignore` (`.gitignore` line 34: `.env`). EAS build runners do not have access to `.env` unless configured via EAS Secrets or `eas.json`.
  - When building release bundles locally or via standard Gradle (`npx expo run:android --variant release` or `./gradlew bundleRelease`), Gradle executes `@expo/cli export:embed` directly. Gradle does NOT read `eas.json` (which is an EAS CLI-only specification).
  - Consequently, if `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` was not injected at bundle time, `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` was stripped/undefined.
- **Missing `expo.extra` and Fallback Constant**:
  - Unlike `services/supabaseClient.js` which implemented fallback strings (`const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rkoeciiwqolgcjduhdqz.supabase.co'`), `app/login.tsx` had NO fallback constant.
  - `app.json` had no `googleWebClientId` defined under `expo.extra`.

### 2. Native Android Behavior for Empty Web Client ID
In `node_modules/@react-native-google-signin/google-signin/android/src/main/java/com/reactnativegooglesignin/Utils.java` (lines 63–70):
```java
GoogleSignInOptions.Builder googleSignInOptionsBuilder = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestScopes(new Scope(Scopes.EMAIL), scopes);
if (webClientId != null && !webClientId.isEmpty()) {
    googleSignInOptionsBuilder.requestIdToken(webClientId);
    if (offlineAccess) {
        googleSignInOptionsBuilder.requestServerAuthCode(webClientId, forceCodeForRefreshToken);
    }
}
```
- If `webClientId` is empty (`""`) or `null`, `requestIdToken(webClientId)` is NOT called.
- When `GoogleSignIn.getClient()` runs without `requestIdToken()`, the Google account returned on sign-in contains `idToken = null`.
- If `login.tsx` subsequently attempts to configure and sign in, Google Play Services throws `DEVELOPER_ERROR (10)` or returns no ID token.

### 3. Server Auth Code Request with `offlineAccess: true`
- `GoogleSignin.configure({ ..., offlineAccess: true })` causes `RNGoogleSigninModule` to invoke `requestServerAuthCode(webClientId)`.
- Server auth codes are intended for backend web servers that perform authorization code exchanges with Google OAuth endpoints using a client secret.
- Supabase Auth's `signInWithIdToken({ provider: 'google', token: idToken })` uses the OIDC `idToken` directly.
- In production Play Store builds, when an app requests offline server auth code without a corresponding server-side OAuth flow configured in Google Cloud Console, Google Play Services throws Code 10 Developer Error.

### 4. SHA-1 Certificate Fingerprints & Google Play App Signing
- On the Google Play Store, Google Play App Signing re-signs the application bundle (AAB) with Google's production signing key.
- In Google Cloud Console, the project must have:
  1. An **Android OAuth 2.0 Client ID** configured with:
     - Package Name: `com.lalex.finscholar`
     - SHA-1: Google Play App Signing certificate SHA-1 fingerprint (from Play Console > App Integrity) AND the upload/debug keystore SHA-1.
  2. A **Web Application OAuth 2.0 Client ID** (`398238102082-q812a4ki3c7qg9mp19jqbpqq6hbv88ns.apps.googleusercontent.com`) within the *same* Google Cloud project.

---

## Implemented Fix Architecture

### 1. Centralized Google Auth Service (`services/googleAuth.ts`)
Created a dedicated module featuring a robust 3-tier fallback strategy:
1. **Tier 1 (Environment Variable)**: `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
2. **Tier 2 (Expo Constants)**: `Constants.expoConfig?.extra?.googleWebClientId`
3. **Tier 3 (Hardcoded Constant)**: `DEFAULT_GOOGLE_WEB_CLIENT_ID = '398238102082-q812a4ki3c7qg9mp19jqbpqq6hbv88ns.apps.googleusercontent.com'`

### 2. Configuration Sanitization
- `configureGoogleSignIn()` cleanly configures `GoogleSignin`:
  - `webClientId`: Guaranteed non-empty string.
  - `scopes`: `['profile', 'email']`.
  - `offlineAccess`: `false` (eliminates unnecessary server auth code request, preventing Code 10).

### 3. Build Profile Hardening (`eas.json` & `app.json`)
- `eas.json`: Injected `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` across all profiles (`production`, `preview`, `development`).
- `app.json`: Added `googleWebClientId` to `expo.extra` so it is permanently embedded in the application manifest.

### 4. Login Screen Hardening (`app/login.tsx`)
- Replaced direct `process.env` access with `configureGoogleSignIn()`.
- Initialized once on mount and verified idempotently before sign-in execution.
- Retained clean error reporting for Developer Error (Code 10), user cancellations, and Play Services availability.

---

## Verification Summary
- **TypeScript (`npx tsc --noEmit`)**: Passed with 0 errors.
- **Automated Test Suite (`npm test`)**: 98 test suites passed (341 tests, 0 failures), including dedicated production Google Auth configuration test suite (`__tests__/google-auth-production.test.js`).
