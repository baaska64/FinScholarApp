import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getGoogleWebClientId,
  configureGoogleSignIn,
  isGoogleSignInReady,
  DEFAULT_GOOGLE_WEB_CLIENT_ID,
} from '../services/googleAuth.ts';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export function runGoogleAuthProductionTests(describe, test) {
  describe('Google Auth Production Configuration Suite', () => {
    test('1.1 DEFAULT_GOOGLE_WEB_CLIENT_ID is valid production client id', () => {
      assert.strictEqual(
        DEFAULT_GOOGLE_WEB_CLIENT_ID,
        '398238102082-q812a4ki3c7qg9mp19jqbpqq6hbv88ns.apps.googleusercontent.com'
      );
      assert(DEFAULT_GOOGLE_WEB_CLIENT_ID.endsWith('.apps.googleusercontent.com'));
    });

    test('1.2 getGoogleWebClientId resolves from EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID env when present', () => {
      const origEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      try {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-env-id.apps.googleusercontent.com';
        const resolved = getGoogleWebClientId();
        assert.strictEqual(resolved, 'test-env-id.apps.googleusercontent.com');
      } finally {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = origEnv;
      }
    });

    test('1.3 getGoogleWebClientId ignores placeholder and falls back', () => {
      const origEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      try {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID';
        const resolved = getGoogleWebClientId();
        assert.strictEqual(resolved, DEFAULT_GOOGLE_WEB_CLIENT_ID);
      } finally {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = origEnv;
      }
    });

    test('1.4 getGoogleWebClientId falls back to Constants.expoConfig when env is empty', () => {
      const origEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      try {
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        // Constants in mock or fallback
        const resolved = getGoogleWebClientId();
        assert(resolved.endsWith('.apps.googleusercontent.com'));
      } finally {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = origEnv;
      }
    });

    test('1.5 configureGoogleSignIn configures with offlineAccess: false', () => {
      let capturedConfig = null;
      GoogleSignin.configure = (config) => {
        capturedConfig = config;
      };

      const clientId = configureGoogleSignIn();
      assert(clientId && clientId.length > 0);
      assert.strictEqual(capturedConfig.offlineAccess, false, 'offlineAccess must be false to avoid server auth code Developer Error (Code 10)');
      assert.deepStrictEqual(capturedConfig.scopes, ['profile', 'email']);
      assert.strictEqual(capturedConfig.webClientId, clientId);
      assert.strictEqual(isGoogleSignInReady(), true);
    });

    test('1.6 eas.json contains EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in production, preview, development profiles', () => {
      const easPath = path.resolve(process.cwd(), 'eas.json');
      assert(fs.existsSync(easPath), 'eas.json must exist');
      const easJson = JSON.parse(fs.readFileSync(easPath, 'utf8'));

      assert(easJson.build?.production?.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, 'production build profile must have EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
      assert(easJson.build?.preview?.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, 'preview build profile must have EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
      assert(easJson.build?.development?.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, 'development build profile must have EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');

      assert.strictEqual(
        easJson.build.production.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        DEFAULT_GOOGLE_WEB_CLIENT_ID
      );
    });

    test('1.7 app.json contains googleWebClientId in extra config', () => {
      const appJsonPath = path.resolve(process.cwd(), 'app.json');
      assert(fs.existsSync(appJsonPath), 'app.json must exist');
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

      assert(appJson.expo?.extra?.googleWebClientId, 'app.json expo.extra must have googleWebClientId');
      assert.strictEqual(appJson.expo.extra.googleWebClientId, DEFAULT_GOOGLE_WEB_CLIENT_ID);
    });

    test('1.8 getGoogleWebClientId handles whitespace, undefined, null strings, and placeholders correctly', () => {
      const origEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const invalidStrings = [
        '   ',
        'undefined',
        'UNDEFINED',
        'null',
        'Null',
        'None',
        'false',
        'true',
        'nil',
        'nan',
        '0',
        '[object Object]',
        'YOUR_GOOGLE_WEB_CLIENT_ID',
        'YOUR_CLIENT_ID',
        'YOUR_KEY',
        'placeholder_id',
        '',
      ];

      try {
        for (const invalid of invalidStrings) {
          process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = invalid;
          const resolved = getGoogleWebClientId();
          assert(
            resolved.endsWith('.apps.googleusercontent.com') && resolved !== invalid,
            `Expected fallback for invalid env value "${invalid}", got "${resolved}"`
          );
        }
      } finally {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = origEnv;
      }
    });

    test('1.9 getGoogleWebClientId resolves from Constants.manifest when expoConfig is absent', () => {
      const origEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const origExpoConfig = Constants.expoConfig;
      try {
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        delete Constants.expoConfig;
        Constants.manifest = {
          extra: {
            googleWebClientId: 'manifest-client-id.apps.googleusercontent.com',
          },
        };

        const resolved = getGoogleWebClientId();
        assert.strictEqual(resolved, 'manifest-client-id.apps.googleusercontent.com');
      } finally {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = origEnv;
        Constants.expoConfig = origExpoConfig;
        delete Constants.manifest;
      }
    });

    test('1.10 getGoogleWebClientId resolves from Constants.manifest2 when manifest is absent', () => {
      const origEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const origExpoConfig = Constants.expoConfig;
      try {
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        delete Constants.expoConfig;
        Constants.manifest2 = {
          extra: {
            expoClient: {
              extra: {
                googleWebClientId: 'manifest2-client-id.apps.googleusercontent.com',
              },
            },
          },
        };

        const resolved = getGoogleWebClientId();
        assert.strictEqual(resolved, 'manifest2-client-id.apps.googleusercontent.com');
      } finally {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = origEnv;
        Constants.expoConfig = origExpoConfig;
        delete Constants.manifest2;
      }
    });

    test('1.11 configureGoogleSignIn handles runtime exception from GoogleSignin.configure cleanly', () => {
      const origConfigure = GoogleSignin.configure;
      try {
        GoogleSignin.configure = () => {
          throw new Error('Native module not linked or platform unsupported');
        };

        const clientId = configureGoogleSignIn();
        assert.strictEqual(clientId, DEFAULT_GOOGLE_WEB_CLIENT_ID);
        assert.strictEqual(isGoogleSignInReady(), false);
      } finally {
        GoogleSignin.configure = origConfigure;
      }
    });

    test('1.12 Code 10 error detection recognizes all numeric, string, message, raw string, and enum variants', () => {
      const isCode10Error = (error) => {
        const errorString =
          typeof error === 'string'
            ? error
            : typeof error?.message === 'string'
            ? error.message
            : String(error ?? '');

        return (
          error?.code === 10 ||
          error?.code === '10' ||
          String(error?.code) === '10' ||
          error?.code === 'DEVELOPER_ERROR' ||
          errorString.includes('10') ||
          errorString.toLowerCase().includes('developer error') ||
          errorString.toLowerCase().includes('developer_error')
        );
      };

      assert.strictEqual(isCode10Error({ code: 10 }), true, 'Numeric 10 must match');
      assert.strictEqual(isCode10Error({ code: '10' }), true, 'String 10 must match');
      assert.strictEqual(isCode10Error({ code: 'DEVELOPER_ERROR' }), true, 'DEVELOPER_ERROR must match');
      assert.strictEqual(isCode10Error(new Error('DEVELOPER_ERROR (10): Keystore mismatch')), true, 'Error message containing 10 must match');
      assert.strictEqual(isCode10Error(new Error('Status{statusCode=DEVELOPER_ERROR, resolution=null}')), true, 'Status string DEVELOPER_ERROR must match');
      assert.strictEqual(isCode10Error(new Error('Developer error during Google token request')), true, 'Developer error text must match');
      assert.strictEqual(isCode10Error('DEVELOPER_ERROR'), true, 'Raw string DEVELOPER_ERROR must match');
      assert.strictEqual(isCode10Error('Developer Error 10: OAuth client rejected'), true, 'Raw string error with code 10 must match');
      assert.strictEqual(isCode10Error({ code: 'SIGN_IN_CANCELLED' }), false, 'Cancel code must not match');
      assert.strictEqual(isCode10Error(null), false, 'Null must not match');
      assert.strictEqual(isCode10Error(undefined), false, 'Undefined must not match');
    });

    test('1.13 getGoogleWebClientId strips enclosing single and double quotes from env and extra', () => {
      const origEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      try {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '"quoted-client-id.apps.googleusercontent.com"';
        assert.strictEqual(getGoogleWebClientId(), 'quoted-client-id.apps.googleusercontent.com');

        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "'single-quoted.apps.googleusercontent.com'";
        assert.strictEqual(getGoogleWebClientId(), 'single-quoted.apps.googleusercontent.com');

        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '  "nested-spaces.apps.googleusercontent.com"  ';
        assert.strictEqual(getGoogleWebClientId(), 'nested-spaces.apps.googleusercontent.com');
      } finally {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = origEnv;
      }
    });
  });
}
