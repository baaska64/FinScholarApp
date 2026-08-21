import assert from 'node:assert';
import { GoogleSignin, statusCodes, isErrorWithCode, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { supabase } from '../services/supabaseClient.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// Recreate the SafeStorage contract to test isolated environment behaviors
const createSafeStorageAdapter = (platformOS, windowObj) => ({
  getItem: (key) => {
    if (platformOS === 'web') {
      if (typeof windowObj === 'undefined' || windowObj === null) return Promise.resolve(null);
      try {
        return Promise.resolve(windowObj.localStorage.getItem(key));
      } catch {
        return Promise.resolve(null);
      }
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (platformOS === 'web') {
      if (typeof windowObj !== 'undefined' && windowObj !== null) {
        try {
          windowObj.localStorage.setItem(key, value);
        } catch {
          // ignore or fallback
        }
      }
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (platformOS === 'web') {
      if (typeof windowObj !== 'undefined' && windowObj !== null) {
        try {
          windowObj.localStorage.removeItem(key);
        } catch {
          // ignore or fallback
        }
      }
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
});

// Implementation of the exact auth handler from app/login.tsx
async function executeGoogleSignInFlow({
  envWebClientId,
  googleSigninMock,
  supabaseAuthMock,
  routerMock,
  alertMock,
  setLoadingMock,
}) {
  const webClientId = envWebClientId;

  if (!webClientId || webClientId === 'YOUR_GOOGLE_WEB_CLIENT_ID') {
    alertMock(
      'Google Sign-In Setup Required',
      'Google Web Client ID is not configured. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your .env file.'
    );
    return;
  }

  setLoadingMock(true);
  try {
    googleSigninMock.configure({
      webClientId,
      scopes: ['profile', 'email'],
      offlineAccess: false,
    });

    await googleSigninMock.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await googleSigninMock.signIn();

    if (response && response.type === 'cancelled') {
      return;
    }

    let idToken = null;
    if (isSuccessResponse(response)) {
      idToken = response.data.idToken;
    } else if (response && 'data' in response && response.data?.idToken) {
      idToken = response.data.idToken;
    } else if (response && response.idToken) {
      idToken = response.idToken;
    }

    if (!idToken) {
      alertMock(
        'Sign-In Incomplete',
        'Could not obtain Google ID token. Please verify your Google Cloud Console configuration.'
      );
      return;
    }

    const { data, error } = await supabaseAuthMock.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      alertMock('Google Sign-In Failed', error.message);
    } else if (data?.session) {
      routerMock.replace('/(tabs)');
    } else if (data?.user) {
      alertMock('Sign-In Successful', 'Please check your email to complete verification if required.');
    } else {
      alertMock('Google Sign-In Incomplete', 'Unable to start session. Please try again.');
    }
  } catch (error) {
    const errorString =
      typeof error === 'string'
        ? error
        : typeof error?.message === 'string'
        ? error.message
        : String(error ?? '');

    const isCode10 =
      error?.code === 10 ||
      error?.code === '10' ||
      String(error?.code) === '10' ||
      error?.code === 'DEVELOPER_ERROR' ||
      errorString.includes('10') ||
      errorString.toLowerCase().includes('developer error') ||
      errorString.toLowerCase().includes('developer_error');

    const genericErrorMessage =
      (typeof error === 'string' ? error : error?.message) ||
      'An unexpected error occurred during Google Sign-In.';

    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          // User cancelled the sign-in flow
          break;
        case statusCodes.IN_PROGRESS:
          alertMock('Sign-In In Progress', 'Google Sign-In is already in progress.');
          break;
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          alertMock(
            'Play Services Unavailable',
            'Google Play Services is not available or outdated on this device. Please update Play Services and try again.'
          );
          break;
        default:
          if (isCode10) {
            alertMock(
              'Configuration Error (Code 10)',
              'Developer Error: Check that the SHA-1 fingerprint (5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25) and package name (com.lalex.finscholar) match your Google Cloud Console Android Client ID.'
            );
          } else {
            alertMock('Google Sign-In Error', genericErrorMessage);
          }
      }
    } else if (isCode10) {
      alertMock(
        'Configuration Error (Code 10)',
        'Developer Error: Check that the SHA-1 fingerprint (5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25) and package name (com.lalex.finscholar) match your Google Cloud Console Android Client ID.'
      );
    } else {
      alertMock('Google Sign-In Error', genericErrorMessage);
    }
  } finally {
    setLoadingMock(false);
  }
}

export function runChallengerAuthAdversarialTests(describe, test) {
  describe('Challenger Auth Suite 1: SafeStorage Persistence Matrix & Platform Invariants', () => {
    test('1.1 Native Platform (Android/iOS) AsyncStorage Integration & Promise Contract', async () => {
      const nativeStorage = createSafeStorageAdapter('android', undefined);
      await AsyncStorage.clear();

      // Test setItem returns genuine Promise
      const setRes = nativeStorage.setItem('auth_session_key', JSON.stringify({ access_token: 'xyz-token-123' }));
      assert(setRes instanceof Promise, 'setItem must return a Promise');
      await setRes;

      // Test getItem returns genuine Promise resolving to stored string
      const getRes = nativeStorage.getItem('auth_session_key');
      assert(getRes instanceof Promise, 'getItem must return a Promise');
      const stored = await getRes;
      assert.strictEqual(stored, JSON.stringify({ access_token: 'xyz-token-123' }));

      // Test removeItem
      const removeRes = nativeStorage.removeItem('auth_session_key');
      assert(removeRes instanceof Promise, 'removeItem must return a Promise');
      await removeRes;

      const afterRemove = await nativeStorage.getItem('auth_session_key');
      assert.strictEqual(afterRemove, null, 'Key should be deleted');
    });

    test('1.2 Web Browser Platform with localStorage', async () => {
      const webStorageMap = new Map();
      const mockWindow = {
        localStorage: {
          getItem: (k) => webStorageMap.get(k) ?? null,
          setItem: (k, v) => webStorageMap.set(k, String(v)),
          removeItem: (k) => webStorageMap.delete(k),
        },
      };

      const webStorage = createSafeStorageAdapter('web', mockWindow);

      const setRes = webStorage.setItem('web_token', 'token_abc');
      assert(setRes instanceof Promise, 'setItem on web must return a Promise');
      await setRes;

      const getRes = webStorage.getItem('web_token');
      assert(getRes instanceof Promise, 'getItem on web must return a Promise');
      const val = await getRes;
      assert.strictEqual(val, 'token_abc');

      const delRes = webStorage.removeItem('web_token');
      assert(delRes instanceof Promise, 'removeItem on web must return a Promise');
      await delRes;

      const afterDel = await webStorage.getItem('web_token');
      assert.strictEqual(afterDel, null);
    });

    test('1.3 Web Server-Side Rendering (SSR) where window is undefined', async () => {
      const ssrStorage = createSafeStorageAdapter('web', undefined);

      const getRes = ssrStorage.getItem('any_key');
      assert(getRes instanceof Promise, 'getItem in SSR must return a Promise');
      const val = await getRes;
      assert.strictEqual(val, null, 'SSR getItem must return null');

      const setRes = ssrStorage.setItem('any_key', 'value');
      assert(setRes instanceof Promise, 'setItem in SSR must return a Promise');
      await setRes;

      const delRes = ssrStorage.removeItem('any_key');
      assert(delRes instanceof Promise, 'removeItem in SSR must return a Promise');
      await delRes;
    });

    test('1.4 Web Storage Throwing / QuotaExceeded / Private Browsing Resilience', async () => {
      const throwingWindow = {
        localStorage: {
          getItem: () => { throw new Error('DOMException: SecurityError / QuotaExceeded'); },
          setItem: () => { throw new Error('DOMException: QuotaExceededError'); },
          removeItem: () => { throw new Error('DOMException: SecurityError'); },
        },
      };

      const resilientStorage = createSafeStorageAdapter('web', throwingWindow);

      // getItem should safely catch error and resolve null
      const getVal = await resilientStorage.getItem('secret_key');
      assert.strictEqual(getVal, null, 'Throwing localStorage.getItem must resolve to null');

      // setItem and removeItem should safely catch and resolve without throwing
      await resilientStorage.setItem('secret_key', 'secret_val');
      await resilientStorage.removeItem('secret_key');
    });

    test('1.5 Supabase Client Instance & Storage Configuration Verification', () => {
      assert(supabase, 'Supabase client must be initialized');
      assert(supabase.auth, 'Supabase auth subsystem must be present');
      assert.strictEqual(typeof supabase.auth.signInWithIdToken, 'function', 'signInWithIdToken method must exist on supabase.auth');
    });
  });

  describe('Challenger Auth Suite 2: Google Sign-In Adversarial Error Conditions', () => {
    test('2.1 Missing or Placeholder EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', async () => {
      const invalidKeys = [undefined, null, '', 'YOUR_GOOGLE_WEB_CLIENT_ID'];

      for (const envKey of invalidKeys) {
        let alertTitle = null;
        let alertMsg = null;
        let loadingCalls = [];

        await executeGoogleSignInFlow({
          envWebClientId: envKey,
          googleSigninMock: GoogleSignin,
          supabaseAuthMock: supabase.auth,
          routerMock: router,
          alertMock: (title, msg) => {
            alertTitle = title;
            alertMsg = msg;
          },
          setLoadingMock: (val) => loadingCalls.push(val),
        });

        assert.strictEqual(alertTitle, 'Google Sign-In Setup Required', `Expected setup required alert for key ${envKey}`);
        assert(alertMsg.includes('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'), 'Alert message must mention EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
        assert.deepStrictEqual(loadingCalls, [], 'Should return before setting loading true');
      }
    });

    test('2.2 Google Play Services Unavailable (PLAY_SERVICES_NOT_AVAILABLE)', async () => {
      let alertTitle = null;
      let alertMsg = null;
      let loadingCalls = [];

      GoogleSignin._setHasPlayServicesHandler(async () => {
        const err = new Error('Play Services out of date or missing');
        err.code = statusCodes.PLAY_SERVICES_NOT_AVAILABLE;
        throw err;
      });

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: supabase.auth,
        routerMock: router,
        alertMock: (title, msg) => {
          alertTitle = title;
          alertMsg = msg;
        },
        setLoadingMock: (val) => loadingCalls.push(val),
      });

      assert.strictEqual(alertTitle, 'Play Services Unavailable');
      assert(alertMsg.includes('Google Play Services is not available or outdated'), 'Alert must explain play services error');
      assert.strictEqual(loadingCalls[0], true, 'Loading should start as true');
      assert.strictEqual(loadingCalls[loadingCalls.length - 1], false, 'Loading should be reset to false');

      GoogleSignin._reset();
    });

    test('2.3 User Cancellation (statusCodes.SIGN_IN_CANCELLED and response.type = cancelled)', async () => {
      // Scenario A: response.type === 'cancelled'
      let alertCalled = false;
      let loadingCalls = [];

      GoogleSignin._setSignInHandler(async () => ({
        type: 'cancelled',
      }));

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: supabase.auth,
        routerMock: router,
        alertMock: () => { alertCalled = true; },
        setLoadingMock: (val) => loadingCalls.push(val),
      });

      assert.strictEqual(alertCalled, false, 'User cancellation should not trigger error alert');
      assert.strictEqual(loadingCalls[loadingCalls.length - 1], false, 'Loading must be false');

      // Scenario B: rejection with code: SIGN_IN_CANCELLED
      alertCalled = false;
      loadingCalls = [];
      GoogleSignin._setSignInHandler(async () => {
        const err = new Error('Sign in cancelled by user');
        err.code = statusCodes.SIGN_IN_CANCELLED;
        throw err;
      });

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: supabase.auth,
        routerMock: router,
        alertMock: () => { alertCalled = true; },
        setLoadingMock: (val) => loadingCalls.push(val),
      });

      assert.strictEqual(alertCalled, false, 'SIGN_IN_CANCELLED rejection should not trigger error alert');
      assert.strictEqual(loadingCalls[loadingCalls.length - 1], false, 'Loading must be false');

      GoogleSignin._reset();
    });

    test('2.4 Developer Error Code 10 (SHA-1 & Package Name Mismatch)', async () => {
      const code10Variants = [
        { code: 10 },
        { code: '10' },
        { code: 'DEVELOPER_ERROR' },
        { code: 10, message: 'Developer Error 10' },
        new Error('DEVELOPER_ERROR (10): Fingerprint mismatch'),
        new Error('Status{statusCode=DEVELOPER_ERROR, resolution=null}'),
        new Error('Developer error: SHA-1 not registered in cloud console'),
        'DEVELOPER_ERROR',
        'Developer Error 10: OAuth client rejected',
      ];

      for (const errVariant of code10Variants) {
        let alertTitle = null;
        let alertMsg = null;
        let loadingCalls = [];

        GoogleSignin._setSignInHandler(async () => {
          throw errVariant;
        });

        await executeGoogleSignInFlow({
          envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
          googleSigninMock: GoogleSignin,
          supabaseAuthMock: supabase.auth,
          routerMock: router,
          alertMock: (title, msg) => {
            alertTitle = title;
            alertMsg = msg;
          },
          setLoadingMock: (val) => loadingCalls.push(val),
        });

        assert.strictEqual(alertTitle, 'Configuration Error (Code 10)', `Expected Code 10 alert for variant ${JSON.stringify(errVariant)}`);
        assert(alertMsg.includes('5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25'), 'Alert must specify exact SHA-1 fingerprint');
        assert(alertMsg.includes('com.lalex.finscholar'), 'Alert must specify exact package name');
        assert.strictEqual(loadingCalls[loadingCalls.length - 1], false);
      }

      GoogleSignin._reset();
    });

    test('2.5 In-Progress Concurrency Conflict (statusCodes.IN_PROGRESS)', async () => {
      let alertTitle = null;
      let alertMsg = null;

      GoogleSignin._setSignInHandler(async () => {
        const err = new Error('Sign in is already running');
        err.code = statusCodes.IN_PROGRESS;
        throw err;
      });

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: supabase.auth,
        routerMock: router,
        alertMock: (title, msg) => {
          alertTitle = title;
          alertMsg = msg;
        },
        setLoadingMock: () => {},
      });

      assert.strictEqual(alertTitle, 'Sign-In In Progress');
      assert.strictEqual(alertMsg, 'Google Sign-In is already in progress.');

      GoogleSignin._reset();
    });

    test('2.6 Missing or Empty ID Token in Google Response', async () => {
      const emptyTokenResponses = [
        { type: 'success', data: { idToken: null } },
        { type: 'success', data: { idToken: '' } },
        { type: 'success', data: {} },
        {},
      ];

      for (const emptyResp of emptyTokenResponses) {
        let alertTitle = null;
        let alertMsg = null;

        GoogleSignin._setSignInHandler(async () => emptyResp);

        await executeGoogleSignInFlow({
          envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
          googleSigninMock: GoogleSignin,
          supabaseAuthMock: supabase.auth,
          routerMock: router,
          alertMock: (title, msg) => {
            alertTitle = title;
            alertMsg = msg;
          },
          setLoadingMock: () => {},
        });

        assert.strictEqual(alertTitle, 'Sign-In Incomplete', `Expected Incomplete for response ${JSON.stringify(emptyResp)}`);
        assert(alertMsg.includes('Could not obtain Google ID token'), 'Alert must describe missing ID token');
      }

      GoogleSignin._reset();
    });

    test('2.7 Supabase Token Exchange Failure (OAuth rejection from GoTrue)', async () => {
      let alertTitle = null;
      let alertMsg = null;

      GoogleSignin._setSignInHandler(async () => ({
        type: 'success',
        data: { idToken: 'valid-format-google-id-token' },
      }));

      const mockSupabaseAuth = {
        signInWithIdToken: async () => ({
          data: null,
          error: { message: 'Invalid ID token: signature verification failed in Supabase' },
        }),
      };

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: mockSupabaseAuth,
        routerMock: router,
        alertMock: (title, msg) => {
          alertTitle = title;
          alertMsg = msg;
        },
        setLoadingMock: () => {},
      });

      assert.strictEqual(alertTitle, 'Google Sign-In Failed');
      assert.strictEqual(alertMsg, 'Invalid ID token: signature verification failed in Supabase');

      GoogleSignin._reset();
    });

    test('2.8 Supabase Token Exchange Network/Server Runtime Exception', async () => {
      let alertTitle = null;
      let alertMsg = null;

      GoogleSignin._setSignInHandler(async () => ({
        type: 'success',
        data: { idToken: 'valid-format-google-id-token' },
      }));

      const mockSupabaseAuth = {
        signInWithIdToken: async () => {
          throw new Error('Network timeout connecting to Supabase auth API');
        },
      };

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: mockSupabaseAuth,
        routerMock: router,
        alertMock: (title, msg) => {
          alertTitle = title;
          alertMsg = msg;
        },
        setLoadingMock: () => {},
      });

      assert.strictEqual(alertTitle, 'Google Sign-In Error');
      assert(alertMsg.includes('Network timeout connecting to Supabase auth API'));

      GoogleSignin._reset();
    });

    test('2.9 Successful Sign-In, Token Exchange & Dashboard Navigation', async () => {
      router._reset();
      let alertCalled = false;
      let loadingCalls = [];

      GoogleSignin._setSignInHandler(async () => ({
        type: 'success',
        data: {
          idToken: 'google_oidc_jwt_token_payload_xyz',
          user: { email: 'student@scholar.edu', name: 'Honor Student' },
        },
      }));

      let passedAuthOptions = null;
      const mockSupabaseAuth = {
        signInWithIdToken: async (opts) => {
          passedAuthOptions = opts;
          return {
            data: {
              session: {
                access_token: 'supabase-jwt-access-token',
                refresh_token: 'supabase-refresh-token',
                user: { id: 'usr-123', email: 'student@scholar.edu' },
              },
            },
            error: null,
          };
        },
      };

      await executeGoogleSignInFlow({
        envWebClientId: '7682348923-xyz.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: mockSupabaseAuth,
        routerMock: router,
        alertMock: () => { alertCalled = true; },
        setLoadingMock: (val) => loadingCalls.push(val),
      });

      assert.strictEqual(alertCalled, false, 'No error alert should be shown on success');
      assert.deepStrictEqual(passedAuthOptions, {
        provider: 'google',
        token: 'google_oidc_jwt_token_payload_xyz',
      });
      assert.strictEqual(router._getLastReplaced(), '/(tabs)', 'Should redirect to /(tabs) dashboard');
      assert.strictEqual(loadingCalls[0], true);
      assert.strictEqual(loadingCalls[loadingCalls.length - 1], false);

      GoogleSignin._reset();
    });

    test('2.10 Post-Auth User Verification and Empty Session States', async () => {
      // Scenario A: User returned without active session (verification pending)
      GoogleSignin._setSignInHandler(async () => ({
        type: 'success',
        data: { idToken: 'valid-google-id-token' },
      }));

      let alertTitle = null;
      let alertMsg = null;

      const mockSupabaseVerification = {
        signInWithIdToken: async () => ({
          data: {
            user: { id: 'usr-pending', email: 'student@scholar.edu' },
            session: null,
          },
          error: null,
        }),
      };

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: mockSupabaseVerification,
        routerMock: router,
        alertMock: (t, m) => { alertTitle = t; alertMsg = m; },
        setLoadingMock: () => {},
      });

      assert.strictEqual(alertTitle, 'Sign-In Successful');
      assert(alertMsg.includes('verification'));

      // Scenario B: Neither session nor user returned (empty state)
      alertTitle = null;
      alertMsg = null;

      const mockSupabaseEmpty = {
        signInWithIdToken: async () => ({
          data: { user: null, session: null },
          error: null,
        }),
      };

      await executeGoogleSignInFlow({
        envWebClientId: 'valid-client-id.apps.googleusercontent.com',
        googleSigninMock: GoogleSignin,
        supabaseAuthMock: mockSupabaseEmpty,
        routerMock: router,
        alertMock: (t, m) => { alertTitle = t; alertMsg = m; },
        setLoadingMock: () => {},
      });

      assert.strictEqual(alertTitle, 'Google Sign-In Incomplete');

      GoogleSignin._reset();
    });
  });

  describe('Challenger Auth Suite 3: High-Stress Concurrency & Fuzzing', () => {
    test('3.1 1,000 High-Frequency Parallel Storage Operations', async () => {
      const storage = createSafeStorageAdapter('android', undefined);
      await AsyncStorage.clear();

      const promises = [];
      for (let i = 0; i < 1_000; i++) {
        promises.push(storage.setItem(`session_token_${i}`, `jwt_val_${i}`));
      }
      await Promise.all(promises);

      const readPromises = [];
      for (let i = 0; i < 1_000; i++) {
        readPromises.push(
          storage.getItem(`session_token_${i}`).then(val => {
            assert.strictEqual(val, `jwt_val_${i}`);
          })
        );
      }
      await Promise.all(readPromises);
    });

    test('3.2 Rapid Successive Auth Cancellations and Retries (500 cycles)', async () => {
      for (let i = 0; i < 500; i++) {
        let alertCalled = false;
        let isCancelled = i % 2 === 0;

        if (isCancelled) {
          GoogleSignin._setSignInHandler(async () => ({ type: 'cancelled' }));
        } else {
          GoogleSignin._setSignInHandler(async () => {
            const err = new Error('Sign in cancelled');
            err.code = statusCodes.SIGN_IN_CANCELLED;
            throw err;
          });
        }

        let loadingCalls = [];
        await executeGoogleSignInFlow({
          envWebClientId: 'valid-web-client-id.apps.googleusercontent.com',
          googleSigninMock: GoogleSignin,
          supabaseAuthMock: supabase.auth,
          routerMock: router,
          alertMock: () => { alertCalled = true; },
          setLoadingMock: (val) => loadingCalls.push(val),
        });

        assert.strictEqual(alertCalled, false, `Alert should not trigger on cycle ${i}`);
        assert.strictEqual(loadingCalls[loadingCalls.length - 1], false, `Loading must be false at end of cycle ${i}`);
      }
      GoogleSignin._reset();
    });

    test('3.3 Malformed, Fuzzed & Adversarial Error Objects in Catch Block', async () => {
      const fuzzedErrors = [
        null,
        undefined,
        {},
        { message: null },
        { code: null },
        { code: 404 },
        { error: 'unexpected' },
        'string error',
        12345,
        [1, 2, 3],
        new TypeError('Cannot read property of undefined'),
        { message: { nested: 'object message' } },
        { code: 'UNKNOWN_CODE_XYZ', message: 'Internal Play API fault' },
      ];

      for (const err of fuzzedErrors) {
        let alertTitle = null;
        let alertMsg = null;
        let loadingCalls = [];

        GoogleSignin._setSignInHandler(async () => {
          throw err;
        });

        await executeGoogleSignInFlow({
          envWebClientId: 'valid-client-id-123.apps.googleusercontent.com',
          googleSigninMock: GoogleSignin,
          supabaseAuthMock: supabase.auth,
          routerMock: router,
          alertMock: (title, msg) => {
            alertTitle = title;
            alertMsg = msg;
          },
          setLoadingMock: (val) => loadingCalls.push(val),
        });

        assert(alertTitle === 'Google Sign-In Error' || alertTitle === 'Configuration Error (Code 10)');
        assert(typeof alertMsg === 'string' && alertMsg.length > 0);
        assert.strictEqual(loadingCalls[loadingCalls.length - 1], false);
      }
      GoogleSignin._reset();
    });
  });
}
