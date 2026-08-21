import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rkoeciiwqolgcjduhdqz.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mB9EQATPU3C641O0_XbC2w_oWzrn8Pb';

// Provide a safe storage adapter that won't crash Node.js (Expo bundler) and returns Promises for all operations
const SafeStorage = {
  getItem: (key) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return Promise.resolve(null);
      try {
        return Promise.resolve(window.localStorage.getItem(key));
      } catch {
        return Promise.resolve(null);
      }
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // ignore or fallback
        }
      }
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // ignore or fallback
        }
      }
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Tells Supabase to auto-refresh the token when the app comes back to the foreground
import { AppState } from 'react-native';
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
