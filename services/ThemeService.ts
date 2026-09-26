import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import {
    DEFAULT_THEME_PREFERENCE,
    THEME_PREFERENCE_KEY,
    ThemePreference,
    parseThemePreference,
} from '@/utils/themePreference';

/**
 * ThemeService
 *
 * Stores the theme choice and hands it to NativeWind, whose `colorScheme.set`
 * calls `Appearance.setColorScheme` — so every `useColorScheme()` in the app
 * and the native pieces (dialogs, pickers) follow it. 'system' hands control
 * back to the device.
 *
 * Local-only on purpose, like the onboarding flags: it is a property of this
 * phone, not of the ledger, and must apply before any data has loaded.
 */

let current: ThemePreference = DEFAULT_THEME_PREFERENCE;
const listeners = new Set<(preference: ThemePreference) => void>();

export const ThemeService = {
    get(): ThemePreference {
        return current;
    },

    /** Reads the stored choice and applies it. Call once, before the first screen renders. */
    async load(): Promise<ThemePreference> {
        let stored: string | null = null;
        try {
            stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        } catch {}
        current = parseThemePreference(stored);
        colorScheme.set(current);
        listeners.forEach((l) => l(current));
        return current;
    },

    async set(preference: ThemePreference): Promise<void> {
        current = preference;
        colorScheme.set(preference);
        listeners.forEach((l) => l(preference));
        try {
            await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
        } catch {}
    },

    subscribe(listener: (preference: ThemePreference) => void) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },
};
