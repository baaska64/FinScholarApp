/**
 * Turning what a schedule *prints* into what the ledger *stores*.
 *
 * The AI scanner reads two very different documents: a visual timetable (a
 * grid, one cell per session) and a study load / enrollment form (one row per
 * subject, with the days compressed into a code like `MWF` and the time as a
 * printed range). The second shape is where the work is — one row becomes
 * three classes, and `8:00 AM - 9:30 AM` becomes `startHour: 8, duration: 1.5`.
 *
 * That conversion lives here, in deterministic tested code, rather than being
 * asked of the model. Two reasons: it is arithmetic, which a language model
 * does with unnecessary variance, and it used to be duplicated in two screens
 * that had drifted apart — the Schedule tab collapsed `MWF` to a single Monday
 * class while the dashboard expanded it correctly, so the same scan produced
 * different timetables depending on which button started it.
 *
 * Day indices are the ledger's own convention: 0 = Monday … 6 = Sunday.
 */

/** Every spelling we accept for a single day, lowercased and letters-only. */
const DAY_WORDS: Record<string, number> = {
  m: 0, mo: 0, mon: 0, mond: 0, monday: 0, mondays: 0, lunes: 0,
  t: 1, tu: 1, tue: 1, tues: 1, tuesday: 1, tuesdays: 1, martes: 1,
  w: 2, we: 2, wed: 2, weds: 2, wednesday: 2, wednesdays: 2, miercoles: 2,
  r: 3, h: 3, th: 3, thu: 3, thur: 3, thurs: 3, thursday: 3, thursdays: 3, jueves: 3,
  f: 4, fr: 4, fri: 4, friday: 4, fridays: 4, viernes: 4,
  s: 5, sa: 5, sat: 5, satur: 5, saturday: 5, saturdays: 5, sabado: 5,
  u: 6, su: 6, sun: 6, sunday: 6, sundays: 6, domingo: 6,
};

/**
 * Two-letter prefixes tried before single letters when walking a compressed
 * code. This ordering is what makes `TTh` read as Tue+Thu rather than
 * Tue+Tue+Hmm, and `MTWThF` read as five distinct days.
 */
const COMPRESSED_TWO: Record<string, number> = {
  mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6,
};

/** Single letters, including the `R`/`H` shorthands for Thursday. */
const COMPRESSED_ONE: Record<string, number> = {
  m: 0, t: 1, w: 2, r: 3, h: 3, f: 4, s: 5, u: 6,
};

/** Codes whose letters are genuinely ambiguous, so they get resolved outright. */
const WHOLE_TOKEN_OVERRIDES: Record<string, number[]> = {
  ss: [5, 6],
  sasu: [5, 6],
  daily: [0, 1, 2, 3, 4],
  everyday: [0, 1, 2, 3, 4],
  weekdays: [0, 1, 2, 3, 4],
  weekends: [5, 6],
};

const clampDay = (n: number) => Math.max(0, Math.min(6, Math.floor(n)));

/** Letters only, lowercased — strips the punctuation schedules are printed with. */
const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Walks a run-together code (`MWF`, `TTh`, `MTWThF`) left to right, preferring
 * two-letter matches so `Th` is never mistaken for `T` followed by `H`.
 */
function expandCompressed(token: string): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < token.length) {
    const two = token.slice(i, i + 2);
    if (two.length === 2 && COMPRESSED_TWO[two] !== undefined) {
      out.push(COMPRESSED_TWO[two]);
      i += 2;
      continue;
    }
    const one = token[i];
    if (COMPRESSED_ONE[one] !== undefined) {
      out.push(COMPRESSED_ONE[one]);
      i += 1;
      continue;
    }
    // All or nothing. Skipping unknown letters instead would mine day codes out
    // of ordinary words — "TBA" would yield Tuesday and "nonsense" Saturday —
    // so one stray character from a bad OCR read invents a whole class.
    return [];
  }
  return out;
}

/** A token that names exactly one day, or null. Used for range endpoints. */
function singleDay(token: string): number | null {
  const cleaned = lettersOnly(token);
  if (!cleaned) return null;
  if (DAY_WORDS[cleaned] !== undefined) return DAY_WORDS[cleaned];
  const expanded = expandCompressed(cleaned);
  return expanded.length === 1 ? expanded[0] : null;
}

/**
 * Every day a schedule entry refers to, as ledger indices (0 = Mon).
 *
 * Handles numbers, arrays, full names, abbreviations, run-together codes,
 * separated lists and inclusive ranges — in any mix and any case:
 *
 *   3 · [1, 3] · "Monday" · "mon tue wed thur" · "Tues & Thurs"
 *   "MWF" · "TTh" · "MTWThF" · "M/W/F" · "M-F" · "Mon-Fri" · "SS"
 *
 * Returns a sorted, de-duplicated list; `[]` when nothing is recognisable, so
 * callers can tell "no days" apart from "defaulted to Monday".
 */
export function normalizeScheduleDays(input: unknown): number[] {
  if (typeof input === 'number' && Number.isFinite(input)) return [clampDay(input)];

  if (Array.isArray(input)) {
    const all = input.flatMap((entry) => normalizeScheduleDays(entry));
    return Array.from(new Set(all)).sort((a, b) => a - b);
  }

  if (typeof input !== 'string') return [];

  const raw = input.toLowerCase().trim();
  if (!raw) return [];

  // A bare number that arrived as a string ("3").
  if (/^\d+$/.test(raw)) return [clampDay(parseInt(raw, 10))];

  const override = WHOLE_TOKEN_OVERRIDES[lettersOnly(raw)];
  if (override) return [...override];

  // Inclusive range: "M-F", "Mon - Fri", "Tue to Thu".
  const range = raw.split(/\s*(?:-|–|—|\bto\b|\bthru\b|\bthrough\b)\s*/).filter(Boolean);
  if (range.length === 2) {
    const from = singleDay(range[0]);
    const to = singleDay(range[1]);
    if (from !== null && to !== null && from <= to) {
      const out: number[] = [];
      for (let d = from; d <= to; d++) out.push(d);
      return out;
    }
  }

  // Otherwise a list, a run-together code, or a single day.
  const tokens = raw.split(/[,/&+;|\s]+/).filter(Boolean);
  const days: number[] = [];
  for (const token of tokens) {
    const cleaned = lettersOnly(token);
    if (!cleaned) continue;

    const tokenOverride = WHOLE_TOKEN_OVERRIDES[cleaned];
    if (tokenOverride) {
      days.push(...tokenOverride);
      continue;
    }
    if (DAY_WORDS[cleaned] !== undefined) {
      days.push(DAY_WORDS[cleaned]);
      continue;
    }
    days.push(...expandCompressed(cleaned));
  }

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

/** Back-compat single-day form: the first day, or Monday when unreadable. */
export function normalizeScheduleDay(input: unknown): number {
  const days = normalizeScheduleDays(input);
  return days.length > 0 ? days[0] : 0;
}

/**
 * A printed clock time as a 24-hour float — `"8:15 AM"` -> `8.25`,
 * `"1:30 PM"` -> `13.5`, `"13:30"` -> `13.5`. Numbers pass through.
 *
 * `fallback` is returned when nothing parses, so a caller can distinguish an
 * unreadable end time from a real midnight.
 */
export function parseClassHour(raw: unknown, fallback = 8): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return fallback;

  const text = raw.toLowerCase().trim();
  if (!text) return fallback;

  const match = text.match(/(\d{1,2})\s*[:.]?\s*(\d{2})?/);
  if (!match) return fallback;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) / 60 : 0;
  if (!Number.isFinite(hours)) return fallback;

  // Only apply meridiem when it is actually printed; "13:30" is already 24h.
  const isPm = /p\.?\s*m\.?/.test(text);
  const isAm = /a\.?\s*m\.?/.test(text);
  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;

  const value = hours + minutes;
  return value >= 0 && value < 24 ? value : fallback;
}

/**
 * Class length in hours. Prefers an explicit duration, otherwise derives it
 * from the printed start and end, wrapping past midnight rather than
 * returning a negative span. Falls back to one hour.
 */
export function parseClassDuration(duration: unknown, startHour: number, endRaw?: unknown): number {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) return duration;

  if (typeof duration === 'string') {
    const match = duration.match(/(\d+(\.\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  if (endRaw !== undefined && endRaw !== null && endRaw !== '') {
    const end = parseClassHour(endRaw, NaN);
    if (Number.isFinite(end)) {
      let span = end - startHour;
      if (span < 0) span += 24; // an evening class printed as crossing midnight
      if (span > 0) return span;
    }
  }

  return 1;
}
