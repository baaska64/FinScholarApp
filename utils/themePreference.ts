/**
 * The student's theme choice, kept pure so the harness can check it.
 * `services/ThemeService.ts` stores it and applies it.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCE_KEY = '@theme_preference_v1';

/**
 * Light unless the student picks otherwise. The app used to follow the
 * device, so anyone with a dark phone got dark mode without ever choosing it.
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'light';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
];

/** Anything unreadable (missing, corrupted, from a future build) falls back to the default. */
export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : DEFAULT_THEME_PREFERENCE;
}
