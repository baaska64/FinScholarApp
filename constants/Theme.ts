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
    background: '#f4f5fb',
    surface: '#ffffff',
    surfaceSecondary: '#eef0f8',
    card: '#ffffff',
    cardBorder: '#e3e5f0',
    lip: '#d8dbea',
    text: '#1e293b',
    textSecondary: '#525f78',
    textTertiary: '#646d87',
    textInverse: '#ffffff',
    tabBg: '#ffffff',
    tabBorder: '#e3e5f0',
    tabActive: '#4f46e5',
    tabInactive: '#646d87',
    overlay: 'rgba(15, 23, 42, 0.5)',
    skeleton: '#e3e5f0',
    skeletonHighlight: '#eef0f8',
    inputBg: '#fafbfe',
    inputBorder: '#e3e5f0',
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
    background: '#12132b',
    surface: '#1b1d3a',
    surfaceSecondary: '#262a4d',
    card: '#1b1d3a',
    cardBorder: '#32365c',
    lip: '#0d0e21',
    text: '#f1f2f9',
    textSecondary: '#c2c6dc',
    textTertiary: '#8a90b0',
    textInverse: '#12132b',
    tabBg: '#171936',
    tabBorder: '#32365c',
    tabActive: '#818cf8',
    tabInactive: '#8a90b0',
    overlay: 'rgba(0, 0, 0, 0.7)',
    skeleton: '#262a4d',
    skeletonHighlight: '#32365c',
    inputBg: '#12132b',
    inputBorder: '#32365c',
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

// ─── Domain Tints ─────────────────────────────────────────────────────────────

/**
 * One colour per area of the app, so a student learns the code once: violet is
 * grades, emerald is attendance, amber is tasks, indigo is schedule, sky is
 * tools. `fill` is a wash for panels, `line` an inner border, `ink` the
 * foreground that stays legible on `fill`.
 *
 * Use these for identity and state — never to decorate a surface that has no
 * meaning attached.
 */
export const Tints = {
  light: {
    grades:     { fill: '#efeaff', line: '#ddd2fb', ink: '#5b3fd1', solid: '#6d4aec' },
    attendance: { fill: '#e3f6ec', line: '#c4ead6', ink: '#12795a', solid: '#10a37a' },
    tasks:      { fill: '#fdf0dc', line: '#f6dcb4', ink: '#9a6108', solid: '#e08b12' },
    schedule:   { fill: '#e8ebfd', line: '#d2d9fa', ink: '#3b41c4', solid: '#4f46e5' },
    tools:      { fill: '#e2f2fb', line: '#c5e4f6', ink: '#116691', solid: '#0e8ac2' },
    danger:     { fill: '#fdeae7', line: '#f8ccc5', ink: '#b23227', solid: '#dc4436' },
  },
  dark: {
    grades:     { fill: 'rgba(139,105,255,0.14)', line: 'rgba(139,105,255,0.30)', ink: '#b9a3ff', solid: '#8b69ff' },
    attendance: { fill: 'rgba(45,197,151,0.14)',  line: 'rgba(45,197,151,0.30)',  ink: '#6fe0bb', solid: '#2dc597' },
    tasks:      { fill: 'rgba(232,155,42,0.14)',  line: 'rgba(232,155,42,0.30)',  ink: '#f5c37a', solid: '#e89b2a' },
    schedule:   { fill: 'rgba(129,140,248,0.14)', line: 'rgba(129,140,248,0.30)', ink: '#a9b2fb', solid: '#818cf8' },
    tools:      { fill: 'rgba(56,189,248,0.14)',  line: 'rgba(56,189,248,0.30)',  ink: '#84d3f7', solid: '#38bdf8' },
    danger:     { fill: 'rgba(248,113,113,0.14)', line: 'rgba(248,113,113,0.32)', ink: '#f7a099', solid: '#f87171' },
  },
};

/**
 * Solid fills for class blocks, indexed by a class's `colorIdx`.
 *
 * Blocks are painted solid rather than a translucent wash: on the timetable a
 * 20%-alpha fill over a grid line reads as a smudge, and the text on it has to
 * fight the lines showing through. Solid + white text is legible at any zoom,
 * and `edge` gives the same bottom lip the rest of the app uses instead of a
 * cast shadow.
 */
export const ClassPalette = {
  light: [
    { solid: '#4f46e5', edge: '#3730a3' },
    { solid: '#10a37a', edge: '#0c7a5b' },
    { solid: '#0e8ac2', edge: '#0a6892' },
    { solid: '#e08b12', edge: '#a9670c' },
    { solid: '#8b5cf6', edge: '#6a41c8' },
    { solid: '#e0524a', edge: '#ad3d37' },
  ],
  // Deeper than the light fills, not the same hues reused. The bright versions
  // glared against the #0f172a grid and left white block text at ~2.2:1; these
  // sit at ~5:1 for the text while staying ~3.5:1 against the background.
  dark: [
    { solid: '#5a5ec8', edge: '#3b3e8c' },
    { solid: '#177a5e', edge: '#0f5341' },
    { solid: '#24779f', edge: '#164e69' },
    { solid: '#99651a', edge: '#6a4512' },
    { solid: '#7860c9', edge: '#54419a' },
    { solid: '#b54b45', edge: '#7c322d' },
  ],
};

export function getClassColor(colorIdx: number | undefined | null, isDark: boolean) {
  const palette = isDark ? ClassPalette.dark : ClassPalette.light;
  const i = (((Math.floor(Number(colorIdx) || 0)) % palette.length) + palette.length) % palette.length;
  return palette[i];
}

export type TintName = keyof typeof Tints.light;

export function getTints(isDark: boolean) {
  return isDark ? Tints.dark : Tints.light;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export function getTheme(isDark: boolean) {
  return isDark ? Colors.dark : Colors.light;
}

// ─── Brand ────────────────────────────────────────────────────────────────────

/**
 * The azure the app is actually branded in — Fin sits on a `#3991f6` field in
 * the launcher icon and on the splash screen, and until now that blue appeared
 * nowhere inside the app.
 *
 * This is deliberately *not* `primary`. `primary` is the indigo every other
 * screen is wired through; repainting it would restyle the whole app. These
 * tokens carry identity instead of state, and are spent where the product
 * should feel like FinScholar rather than like a generic tracker: the
 * dashboard's header, its highlights, its accents.
 *
 * `base` is the icon's literal azure and is what the washes are mixed from.
 * `heroFrom`/`heroTo` are deliberately a few steps deeper: white on the raw
 * `#3991f6` measures 2.8:1, and the band carries 10–12px labels. `#2470e0` is
 * the same hue family and clears 4.7:1, so every piece of white type on the
 * band — not just the greeting — is legible, and the gradient only gets darker
 * from there. Do not lighten `heroFrom` back toward the icon value.
 */
export const Brand = {
  light: {
    base: '#3991f6',
    heroFrom: '#2470e0',
    heroTo: '#123f8f',
    /** Sheen and bubbles painted over the gradient. */
    glow: '#7fc0ff',
    /**
     * Translucent wells that sit *on* the band. Sized for icons and tracks,
     * which only owe 3:1 as graphical objects — small white text goes straight
     * on the band, never on a well, because a light well lifts the local
     * background out of contrast.
     */
    well: 'rgba(255,255,255,0.16)',
    wellStrong: 'rgba(255,255,255,0.26)',
    wellLine: 'rgba(255,255,255,0.32)',
    onHero: '#ffffff',
    onHeroMuted: 'rgba(255,255,255,0.88)',
    /** Pale wash for brand-tinted panels sitting on the page, not on the band. */
    wash: '#e9f2fe',
    washLine: '#cde2fc',
    ink: '#125aad',
    solid: '#2e86f0',
  },
  dark: {
    base: '#5aa6fb',
    heroFrom: '#27508f',
    heroTo: '#142a54',
    glow: '#5f9de0',
    well: 'rgba(255,255,255,0.10)',
    wellStrong: 'rgba(255,255,255,0.18)',
    wellLine: 'rgba(255,255,255,0.18)',
    onHero: '#ffffff',
    onHeroMuted: 'rgba(255,255,255,0.82)',
    wash: 'rgba(90,166,251,0.13)',
    washLine: 'rgba(90,166,251,0.28)',
    ink: '#8fc3fd',
    solid: '#4a97f5',
  },
};

export function getBrand(isDark: boolean) {
  return isDark ? Brand.dark : Brand.light;
}
