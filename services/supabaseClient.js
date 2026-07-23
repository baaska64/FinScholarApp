import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rkoeciiwqolgcjduhdqz.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mB9EQATPU3C641O0_XbC2w_oWzrn8Pb';

// Provide a safe storage adapter that won't crash Node.js (Expo bundler)
const SafeStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    return Platform.OS === 'web' ? window.localStorage.getItem(key) : AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined') {
      Platform.OS === 'web' ? window.localStorage.setItem(key, value) : AsyncStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') {
      Platform.OS === 'web' ? window.localStorage.removeItem(key) : AsyncStorage.removeItem(key);
    }
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
