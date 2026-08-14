export interface SubjectStyle {
  color: string;
  lightBg: string;
  darkBg: string;
}

export interface ThemeTokens {
  bgColor: string;
  cardColor: string;
  cardBorder: string;
  textColor: string;
  textSecondary: string;
  textTertiary: string;
  primaryColor: string;
  successColor: string;
  successBg: string;
}

export const SUBJECT_PALETTE: SubjectStyle[] = [
  { color: '#4f46e5', lightBg: '#e0e7ff', darkBg: '#1e1b4b' }, // Indigo
  { color: '#10b981', lightBg: '#d1fae5', darkBg: '#064e3b' }, // Emerald
  { color: '#f59e0b', lightBg: '#fef3c7', darkBg: '#451a03' }, // Amber
  { color: '#e11d48', lightBg: '#ffe4e6', darkBg: '#4c0519' }, // Rose
  { color: '#8b5cf6', lightBg: '#ede9fe', darkBg: '#2e1065' }, // Violet
  { color: '#06b6d4', lightBg: '#cffafe', darkBg: '#164e63' }, // Cyan
  { color: '#0284c7', lightBg: '#e0f2fe', darkBg: '#0c4a6e' }, // Sky
  { color: '#d946ef', lightBg: '#fae8ff', darkBg: '#4a044e' }, // Fuchsia
];

/**
 * Deterministic string hash function.
 * Maps string to a non-negative integer.
 */
function hashString(str: string): number {
  if (!str) return 0;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Resolves deterministic subject style (color, lightBg, darkBg) for a given course name.
 * 100% deterministic (same input string always yields same palette index).
 * Handles empty / undefined gracefully.
 */
export function getSubjectStyle(courseName?: string | null): SubjectStyle {
  if (!courseName || typeof courseName !== 'string') {
    return SUBJECT_PALETTE[0];
  }
  const cleanName = courseName.trim();
  if (!cleanName) {
    return SUBJECT_PALETTE[0];
  }
  const index = hashString(cleanName) % SUBJECT_PALETTE.length;
  return SUBJECT_PALETTE[index];
}

/**
 * Resolves icon keyword based on course name keyword match.
 * (CS/IT -> code, MATH/CALC -> math, PHYS/CHEM/SCI -> science, ENG/LIT -> book, default -> school).
 * Handles empty / undefined gracefully.
 */
export function getSubjectIcon(courseName?: string | null): string {
  if (!courseName || typeof courseName !== 'string') {
    return 'school';
  }

  const clean = courseName.trim();
  if (!clean) {
    return 'school';
  }

  // CS / IT -> code
  if (
    /(^|[^A-Z])(CS|IT|CSIT|COMP|PROG|CODE|DEV|WEB|SYS)(?![A-Z])/i.test(clean) ||
    /\b(COMPUTER|PROGRAMMING|SOFTWARE|DATA|ALGORITHM|DATABASE|NETWORK|CYBER|DEVELOPMENT|TECH|TECHNOLOGY)\b/i.test(clean)
  ) {
    return 'code';
  }

  // MATH / CALC -> math
  if (
    /(^|[^A-Z])(MATH|CALC|STAT|ALG|GEOM|NUM)(?![A-Z])/i.test(clean) ||
    /\b(MATHEMATICS|CALCULUS|STATISTICS|ALGEBRA|GEOMETRY|TRIGONOMETRY|ARITHMETIC)\b/i.test(clean)
  ) {
    return 'math';
  }

  // PHYS / CHEM / SCI -> science
  if (
    /(^|[^A-Z])(PHYS|CHEM|SCI|BIO|LAB)(?![A-Z])/i.test(clean) ||
    /\b(PHYSICS|CHEMISTRY|SCIENCE|BIOLOGY|LABORATORY|ASTRONOMY|GEOLOGY)\b/i.test(clean)
  ) {
    return 'science';
  }

  // ENG / LIT -> book
  if (
    /(^|[^A-Z])(ENG|LIT|READ|WRIT|HIST|PHIL)(?![A-Z])/i.test(clean) ||
    /\b(ENGLISH|LITERATURE|HISTORY|PHILOSOPHY|READING|WRITING|HUMANITIES|COMMUNICATION)\b/i.test(clean)
  ) {
    return 'book';
  }

  return 'school';
}

/**
 * Resolves widget palette tokens for light and dark modes.
 */
export function getThemeTokens(isDark: boolean): ThemeTokens {
  return isDark
    ? {
        bgColor: '#0f172a',
        cardColor: '#1e293b',
        cardBorder: '#334155',
        textColor: '#f8fafc',
        textSecondary: '#cbd5e1',
        textTertiary: '#64748b',
        primaryColor: '#818cf8',
        successColor: '#34d399',
        successBg: '#134e3a',
      }
    : {
        bgColor: '#f8fafc',
        cardColor: '#ffffff',
        cardBorder: '#e2e8f0',
        textColor: '#0f172a',
        textSecondary: '#475569',
        textTertiary: '#94a3b8',
        primaryColor: '#4f46e5',
        successColor: '#10b981',
        successBg: '#d1fae5',
      };
}
