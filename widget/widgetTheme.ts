/**
 * Design tokens for the home-screen widget family.
 *
 * Widgets are drawn as Android RemoteViews from a headless JS context, so they
 * cannot use NativeWind or read `useColorScheme()`. These tokens mirror
 * `constants/Theme.ts` by hand — `__tests__/widget.test.js` asserts the class
 * palette stays in step with `ClassPalette` there, so the colour a student
 * picks for a class looks the same on the home screen as in the timetable.
 *
 * Colours are 6- or 8-digit hex (`#rrggbb` / `#rrggbbaa`); the library converts
 * both to Android's #aarrggbb. Deliberately not `rgba()` strings — those widen
 * to `string` and stop type-checking against the library's `ColorProp`.
 */

export type WidgetColor = `#${string}`;

/**
 * Nunito, matching the app. Resolved from `android/app/src/main/assets/fonts`
 * by the `fonts` array in app.json's react-native-android-widget plugin block;
 * a missing file falls back to the system typeface rather than failing.
 */
export const WidgetFont = {
  regular: 'Nunito_400Regular',
  bold: 'Nunito_700Bold',
  black: 'Nunito_800ExtraBold',
} as const;

export interface WidgetPalette {
  isDark: boolean;
  /** Card surface. `surfaceTo` is the gradient end — a barely-there fall-off. */
  surface: WidgetColor;
  surfaceTo: WidgetColor;
  /** Inset rows and metric tiles sitting on `surface`. */
  sunken: WidgetColor;
  line: WidgetColor;
  text: WidgetColor;
  textDim: WidgetColor;
  textFaint: WidgetColor;
  /** Brand gradient, used only when no per-class colour applies. */
  brand: WidgetColor;
  brandTo: WidgetColor;
  onBrand: WidgetColor;
  onBrandDim: WidgetColor;
  /** Progress track drawn on top of a coloured hero panel. */
  onBrandTrack: WidgetColor;
  track: WidgetColor;
  success: WidgetColor;
  successSoft: WidgetColor;
  warning: WidgetColor;
  warningSoft: WidgetColor;
  danger: WidgetColor;
  dangerSoft: WidgetColor;
}

const LIGHT: WidgetPalette = {
  isDark: false,
  surface: '#ffffff',
  surfaceTo: '#f5f6fc',
  sunken: '#f2f3fa',
  line: '#e5e7f2',
  text: '#171a2e',
  textDim: '#585f78',
  textFaint: '#878ea6',
  brand: '#4f46e5',
  brandTo: '#7c3aed',
  onBrand: '#ffffff',
  onBrandDim: '#ffffffd1',
  onBrandTrack: '#ffffff3d',
  track: '#e7e9f4',
  success: '#0e9f74',
  successSoft: '#e3f6ec',
  warning: '#c07708',
  warningSoft: '#fdf0dc',
  danger: '#d94436',
  dangerSoft: '#fdeae7',
};

const DARK: WidgetPalette = {
  isDark: true,
  surface: '#191b3b',
  surfaceTo: '#111328',
  sunken: '#232750',
  line: '#343961',
  text: '#f1f2f9',
  textDim: '#b6bcd6',
  textFaint: '#858bab',
  brand: '#6366f1',
  brandTo: '#8b5cf6',
  onBrand: '#ffffff',
  onBrandDim: '#ffffffd1',
  onBrandTrack: '#ffffff33',
  track: '#2c3059',
  success: '#2dc597',
  successSoft: '#123329',
  warning: '#e89b2a',
  warningSoft: '#3a2b12',
  danger: '#f87171',
  dangerSoft: '#3f2020',
};

export function getWidgetPalette(isDark?: boolean): WidgetPalette {
  return isDark ? DARK : LIGHT;
}

/**
 * Solid fills for class blocks, indexed by a class's `colorIdx`. Kept identical
 * to `ClassPalette` in constants/Theme.ts — see the note at the top of the file.
 */
export const WidgetClassPalette: Record<'light' | 'dark', { solid: WidgetColor; edge: WidgetColor }[]> = {
  light: [
    { solid: '#4f46e5', edge: '#3730a3' },
    { solid: '#10a37a', edge: '#0c7a5b' },
    { solid: '#0e8ac2', edge: '#0a6892' },
    { solid: '#e08b12', edge: '#a9670c' },
    { solid: '#8b5cf6', edge: '#6a41c8' },
    { solid: '#e0524a', edge: '#ad3d37' },
  ],
  dark: [
    { solid: '#5a5ec8', edge: '#3b3e8c' },
    { solid: '#177a5e', edge: '#0f5341' },
    { solid: '#24779f', edge: '#164e69' },
    { solid: '#99651a', edge: '#6a4512' },
    { solid: '#7860c9', edge: '#54419a' },
    { solid: '#b54b45', edge: '#7c322d' },
  ],
};

export interface WidgetAccent {
  /** Hero panel fill / rail colour. */
  solid: WidgetColor;
  /** Darker end of the hero gradient. */
  edge: WidgetColor;
  /** Translucent wash for chips laid on the card surface. */
  soft: WidgetColor;
  /** Foreground that stays legible on `solid`. */
  on: WidgetColor;
}

/**
 * Stable string hash, same shape as the one in subjectUtils, used only when a
 * class predates `colorIdx` so an untinted row still gets a consistent colour
 * instead of everything collapsing onto palette slot 0.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function resolveAccentIndex(colorIdx?: number | null, name?: string | null): number {
  const len = WidgetClassPalette.light.length;
  const raw = Number(colorIdx);
  if (Number.isFinite(raw)) {
    return (((Math.floor(raw) % len) + len) % len);
  }
  const clean = typeof name === 'string' ? name.trim() : '';
  return clean ? hashString(clean) % len : 0;
}

export function getWidgetAccent(
  colorIdx: number | null | undefined,
  isDark: boolean,
  name?: string | null
): WidgetAccent {
  const palette = isDark ? WidgetClassPalette.dark : WidgetClassPalette.light;
  const entry = palette[resolveAccentIndex(colorIdx, name)] ?? palette[0];
  return {
    solid: entry.solid,
    edge: entry.edge,
    // Two-digit alpha suffix: the wash needs more opacity on a dark card to
    // register at all, less on white before it turns muddy.
    soft: `${entry.solid}${isDark ? '33' : '1c'}`,
    on: '#ffffff',
  };
}

export type WidgetTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/** Chip colours by meaning — `fg` on `bg`, both already contrast-checked. */
export function getToneColors(palette: WidgetPalette, tone: WidgetTone): { fg: WidgetColor; bg: WidgetColor } {
  switch (tone) {
    case 'brand':
      return { fg: palette.isDark ? '#a9b2fb' : palette.brand, bg: palette.isDark ? '#818cf826' : '#4f46e514' };
    case 'success':
      return { fg: palette.success, bg: palette.successSoft };
    case 'warning':
      return { fg: palette.warning, bg: palette.warningSoft };
    case 'danger':
      return { fg: palette.danger, bg: palette.dangerSoft };
    default:
      return { fg: palette.textDim, bg: palette.sunken };
  }
}
