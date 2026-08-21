import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

/**
 * Production OAuth 2.0 Web Client ID registered in Google Cloud Console.
 * Used for exchanging Google Auth ID tokens with Supabase Auth.
 */
export const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '398238102082-q812a4ki3c7qg9mp19jqbpqq6hbv88ns.apps.googleusercontent.com';

function cleanClientId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  let s = id.trim();
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function isValidClientId(id: unknown): id is string {
  const cleaned = cleanClientId(id);
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  return (
    lower !== '' &&
    !lower.startsWith('your_') &&
    !lower.includes('placeholder') &&
    lower !== 'undefined' &&
    lower !== 'null' &&
    lower !== 'none' &&
    lower !== 'false' &&
    lower !== 'true' &&
    lower !== 'nil' &&
    lower !== 'nan' &&
    lower !== '0' &&
    lower !== '[object object]'
  );
}

/**
 * Resolves the Google Web Client ID using a multi-tier fallback strategy:
 * 1. Process environment variable (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
 * 2. Expo Constants extra config (Constants.expoConfig / manifest / manifest2)
 * 3. Hardcoded verified Web Client ID constant
 */
export function getGoogleWebClientId(): string {
  const envId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (isValidClientId(envId)) {
    return cleanClientId(envId)!;
  }

  const extraId =
    Constants?.expoConfig?.extra?.googleWebClientId ??
    (Constants as any)?.manifest?.extra?.googleWebClientId ??
    (Constants as any)?.manifest2?.extra?.expoClient?.extra?.googleWebClientId;

  if (isValidClientId(extraId)) {
    return cleanClientId(extraId)!;
  }

  return DEFAULT_GOOGLE_WEB_CLIENT_ID;
}

let isConfigured = false;

/**
 * Robustly configures Google Sign-In with guaranteed Web Client ID.
 * - offlineAccess is set to false because Supabase signInWithIdToken only consumes the idToken,
 *   preventing Developer Error (Code 10) caused by unconfigured server auth code exchanges.
 * - scopes default to ['profile', 'email']
 */
export function configureGoogleSignIn(): string {
  const webClientId = getGoogleWebClientId();

  try {
    GoogleSignin.configure({
      webClientId,
      scopes: ['profile', 'email'],
      offlineAccess: false,
    });
    isConfigured = true;
  } catch (error) {
    isConfigured = false;
    console.warn('[FinScholar] GoogleSignin.configure error:', error);
  }

  return webClientId;
}

export function isGoogleSignInReady(): boolean {
  return isConfigured;
}

export function resetGoogleSignInConfig(): void {
  isConfigured = false;
}

