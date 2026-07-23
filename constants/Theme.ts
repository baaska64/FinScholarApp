import { Platform } from 'react-native';

// ─── Color Palette ────────────────────────────────────────────────────────────

export const Colors = {
  light: {
    primary: '#4f46e5',
    primaryLight: '#818cf8',
    primaryDark: '#3730a3',
    secondary: '#0ea5e9',
    secondaryLight: '#7dd3fc',
    accent: '#f472b6',
    accentLight: '#fbcfe8',
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceSecondary: '#f1f5f9',
    card: '#ffffff',
    cardBorder: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    textInverse: '#ffffff',
    tabBg: '#ffffff',
    tabBorder: '#e2e8f0',
    tabActive: '#4f46e5',
    tabInactive: '#94a3b8',
    overlay: 'rgba(15, 23, 42, 0.5)',
    skeleton: '#e2e8f0',
    skeletonHighlight: '#f1f5f9',
    inputBg: '#f8fafc',
    inputBorder: '#e2e8f0',
    inputFocus: '#818cf8',
  },
  dark: {
    primary: '#818cf8',
    primaryLight: '#a5b4fc',
    primaryDark: '#6366f1',
    secondary: '#38bdf8',
    secondaryLight: '#7dd3fc',
    accent: '#f472b6',
    accentLight: '#831843',
    success: '#34d399',
    successLight: '#065f46',
    warning: '#fbbf24',
    warningLight: '#b45309',
    error: '#f87171',
    errorLight: '#991b1b',
    background: '#0f172a',
    surface: '#1e293b',
    surfaceSecondary: '#334155',
    card: '#1e293b',
    cardBorder: '#334155',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textTertiary: '#64748b',
    textInverse: '#0f172a',
    tabBg: '#1e293b',
    tabBorder: '#334155',
    tabActive: '#818cf8',
    tabInactive: '#64748b',
    overlay: 'rgba(0, 0, 0, 0.7)',
    skeleton: '#334155',
    skeletonHighlight: '#475569',
    inputBg: '#0f172a',
    inputBorder: '#334155',
    inputFocus: '#818cf8',
  },
};

// ─── Spacing Scale ────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// ─── Border Radius Scale ──────────────────────────────────────────────────────

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  full: 9999,
};

// ─── Shadow Presets ───────────────────────────────────────────────────────────

export const Shadows = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    android: { elevation: 1 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
    android: { elevation: 3 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 },
    android: { elevation: 6 },
    default: {},
  }),
  xl: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 24 },
    android: { elevation: 10 },
    default: {},
  }),
};

// ─── Typography Scale ─────────────────────────────────────────────────────────

export const Typography = {
  display: { fontSize: 36, fontFamily: 'Nunito_900Black', lineHeight: 44 },
  heading: { fontSize: 28, fontFamily: 'Nunito_900Black', lineHeight: 34 },
  title: { fontSize: 22, fontFamily: 'Nunito_700Bold', lineHeight: 28 },
  subtitle: { fontSize: 18, fontFamily: 'Nunito_700Bold', lineHeight: 24 },
  body: { fontSize: 16, fontFamily: 'Nunito_400Regular', lineHeight: 24 },
  bodyBold: { fontSize: 16, fontFamily: 'Nunito_700Bold', lineHeight: 24 },
  caption: { fontSize: 13, fontFamily: 'Nunito_400Regular', lineHeight: 18 },
  captionBold: { fontSize: 13, fontFamily: 'Nunito_700Bold', lineHeight: 18 },
  label: { fontSize: 11, fontFamily: 'Nunito_700Bold', lineHeight: 16 },
};

// ─── Animation Durations ──────────────────────────────────────────────────────

export const Duration = {
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

export function getTheme(isDark: boolean) {
  return isDark ? Colors.dark : Colors.light;
}
