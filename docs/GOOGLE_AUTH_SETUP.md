# Google Authentication Setup Guide for FinScholarApp

This document details the step-by-step procedure for setting up **Google Authentication** in FinScholarApp using `@react-native-google-signin/google-signin` and **Supabase GoTrue** (`signInWithIdToken`).

---

## 1. Architecture Overview

FinScholarApp uses native Google Sign-In via Google Play Services on Android to obtain an OpenID Connect (OIDC) ID Token, which is then passed directly to Supabase Authentication:

1. **User taps "Continue with Google"** in `app/login.tsx`.
2. **Google Play Services** prompts the user with the native account picker.
3. **Google Sign-In SDK** returns an OIDC ID Token (`idToken`).
4. **Supabase Client** establishes an authenticated session via `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`.
5. **SyncService** detects the `SIGNED_IN` event and triggers automatic cloud ledger synchronization and premium entitlement verification.
6. The app navigates to `/(tabs)`.

---

## 2. Google Cloud Console Configuration

Both an **OAuth Web Client ID** and an **Android Client ID** must be created in the **same** Google Cloud Project.

### Step 2.1: Create / Select Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select your existing project for FinScholarApp.

### Step 2.2: Configure OAuth Consent Screen
1. Navigate to **APIs & Services** > **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required fields:
   - **App name**: `FinScholar`
   - **User support email**: Your support email address.
   - **Developer contact information**: Your developer email address.
4. Add Scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
5. Save and continue.

### Step 2.3: Create OAuth Web Application Client ID
*This Client ID is used by Supabase and the Expo application (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`).*

1. Navigate to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Application type**: `Web application`.
4. Name: `FinScholar Web Client`.
5. **Authorized JavaScript origins**:
   - `https://<your-supabase-project-id>.supabase.co` (e.g. `https://rkoeciiwqolgcjduhdqz.supabase.co`)
6. **Authorized redirect URIs**:
   - `https://<your-supabase-project-id>.supabase.co/auth/v1/callback` (e.g. `https://rkoeciiwqolgcjduhdqz.supabase.co/auth/v1/callback`)
7. Click **Create**.
8. **Note down**:
   - **Client ID** (e.g., `1234567890-abc123xyz.apps.googleusercontent.com`)
   - **Client Secret**

### Step 2.4: Create OAuth Android Application Client ID
*This registers the native Android app identity with Google Play Services.*

1. In **APIs & Services** > **Credentials**, click **Create Credentials** > **OAuth client ID**.
2. Select **Application type**: `Android`.
3. Name: `FinScholar Android Client (Debug)`.
4. **Package name**: `com.lalex.finscholar`
5. **SHA-1 certificate fingerprint**:
   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```
6. Click **Create**.

> **Note for Production Builds**: When building a release APK or submitting to Google Play, generate the SHA-1 of your release keystore (or copy the App Signing key certificate SHA-1 from Google Play Console) and add a second Android OAuth Client ID in this same Google Cloud project.

---

## 3. Supabase Dashboard Configuration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project (e.g., `rkoeciiwqolgcjduhdqz`).
3. Navigate to **Authentication** > **Providers**.
4. Click on **Google** to expand its settings:
   - Toggle **Enable Google provider** to `ON`.
   - **Client ID**: Paste the **Web Application Client ID** from Step 2.3.
   - **Client Secret**: Paste the **Web Application Client Secret** from Step 2.3.
   - **Authorized Client IDs** (optional / recommended): Add the **Web Application Client ID**.
5. Click **Save**.

---

## 4. Local Environment Variables (`.env`)

Add the Web Client ID to your `.env` file in the project root:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://rkoeciiwqolgcjduhdqz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_mB9EQATPU3C641O0_XbC2w_oWzrn8Pb

# Google OAuth Configuration (Use the Web Client ID created in Step 2.3)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

---

## 5. Troubleshooting & Common Issues

| Error / Symptom | Root Cause | Solution |
|---|---|---|
| **Alert: "Google Sign-In Setup Required"** | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is missing from `.env` | Add your Web Client ID to `.env` and restart Expo bundler (`npx expo start -c`). |
| **Developer Error (Status Code 10)** | SHA-1 fingerprint or Package Name mismatch in Google Cloud Console | Verify that the Android Client ID in Google Cloud Console matches `com.lalex.finscholar` and debug SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. Also verify you are passing the **Web Client ID** (not Android Client ID) into `GoogleSignin.configure({ webClientId })`. |
| **Play Services Unavailable** | Google Play Services is missing or outdated on the device/emulator | Ensure the emulator has Google Play Store installed and updated. |
| **Supabase Error: Invalid ID Token / Audience mismatch** | Web Client ID configured in Supabase does not match the Web Client ID in the app | Ensure the exact same Web Client ID is used in Supabase Provider settings and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. |
