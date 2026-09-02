import { normalizeScheduleDays } from '@/utils/scheduleParsing';

/**
 * Turning on-device OCR output into schedule rows.
 *
 * ML Kit hands back text lines with bounding boxes and no idea what they mean.
 * A study load is a table, so the structure is recoverable from geometry: lines
 * that share a horizontal band are one subject's row, and within that row the
 * course code, the day code, the time range and the room appear in some order.
 *
 * This does the reconstruction and nothing else — the day and time strings it
 * pulls out are handed to `scheduleParsing.ts` exactly as printed, the same
 * contract the AI scanner uses. That keeps one conversion path for both
 * scanners instead of two that can disagree.
 *
 * Deliberately geometric and heuristic: it is good at printed tables and weak
 * at grid timetables, which is why the UI presents it as the fast option rather
 * than the accurate one.
 */

export interface OcrFrame {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface OcrLine {
  text: string;
  frame?: OcrFrame;
}

export interface OcrBlock {
  text?: string;
  frame?: OcrFrame;
  lines?: OcrLine[];
}

export interface OcrResult {
  text?: string;
  blocks?: OcrBlock[];
}

/** The shape both scanners emit, and both `handleScannedClasses` accept. */
export interface ScannedClass {
  name: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  instructor: string;
}

/**
 * One meeting pattern: a day code immediately followed by a time range.
 * A real study load packs several of these into one Schedule cell —
 * `TH 08:00 AM - 10:00 AM, M 07:30 AM - 10:30 AM` — so the row parser looks
 * for every occurrence rather than assuming one day and one range.
 */
const SEGMENT = /([A-Za-z]{1,8})\s*(\d{1,2}[:.]?\d{2}\s*(?:[ap]\.?\s?m\.?)?)\s*(?:[-–—]|\bto\b)\s*(\d{1,2}[:.]?\d{2}\s*(?:[ap]\.?\s?m\.?)?)/gi;

/**
 * Repairs the two digit confusions OCR reliably makes on small text: a capital
 * O read for a zero, and a lowercase l for a one. Only applied inside tokens
 * that are otherwise numeric, so "ONLINE" and "GLE203" are never touched.
 */
export function repairOcrDigits(text: string): string {
  const fix = (t: string) => t.replace(/[Oo]/g, '0').replace(/[lI]/g, '1');
  return text.replace(/\b[A-Za-z0-9OolI:.]{3,}\b/g, (token) => {
    // Wholly numeric-ish ("O1:00", "l2:30") — every character is fair game.
    if (/^[0-9OolI:.]+$/.test(token) && /\d/.test(token)) return fix(token);
    // A short prefix then digits ("GLE203") — repair only the numeric tail, so
    // the letters of a room or course code are never touched.
    const m = token.match(/^([A-Za-z]{1,4})([0-9OolI:.]{3,})$/);
    if (m && /\d/.test(m[2])) return m[1] + fix(m[2]);
    return token;
  });
}

/** A course code as printed: letters then digits — CSIT227, SDG031, PE205. */
const COURSE_CODE = /^[A-Za-z]{2,}[A-Za-z0-9]*\d{2,}$/;

/** A section or cluster tag — G2, B2, E3/D4, G4/G8. */
const SECTION_TAG = /^[A-Za-z]{1,2}\d{1,2}(?:\/[A-Za-z]{0,2}\d{1,2})*$/;

/**
 * Delivery modes that trail the room column. "Online" is deliberately absent:
 * a study load uses it as a real room value ("Room: ONLINE") as well as a mode,
 * and taking only the first token of each comma part already drops the trailing
 * mode word — so filtering it here would blank a legitimate room.
 */
const NON_ROOM = new Set(['in-person', 'inperson', 'hybrid', 'f2f', 'face-to-face', 'async', 'asynchronous']);

/** Words that are never part of a class row, however confidently OCR reads them. */
const NOISE = new Set([
  'subject', 'subjects', 'course', 'courses', 'code', 'description', 'descriptive',
  'title', 'units', 'unit', 'day', 'days', 'time', 'room', 'section', 'schedule',
  'instructor', 'teacher', 'professor', 'total', 'lec', 'lab', 'student', 'name',
  'year', 'semester', 'sem', 'load', 'study', 'enrollment', 'enrolment', 'no',
  'cluster', 'taken', 'mode', 'delivery', 'remarks',
]);

/** Flattens the nested OCR result into lines that carry a usable frame. */
export function collectOcrLines(result: OcrResult | null | undefined): OcrLine[] {
  if (!result || !Array.isArray(result.blocks)) return [];
  const lines: OcrLine[] = [];
  for (const block of result.blocks) {
    const blockLines = Array.isArray(block?.lines) ? block.lines : [];
    if (blockLines.length > 0) {
      for (const line of blockLines) {
        if (line?.text && line.frame) lines.push({ text: line.text, frame: line.frame });
      }
    } else if (block?.text && block.frame) {
      lines.push({ text: block.text, frame: block.frame });
    }
  }
  return lines;
}

/**
 * Groups lines that sit in the same horizontal band into one row, then orders
 * each row left to right. The tolerance scales with the median line height so
 * it holds up on both a phone screenshot and a photographed printout.
 */
export function groupLinesIntoRows(lines: OcrLine[]): string[] {
  const usable = lines.filter((l) => l.frame && l.text?.trim());
  if (usable.length === 0) return [];

  const heights = usable.map((l) => l.frame!.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 1;
  const tolerance = Math.max(medianHeight * 0.6, 1);

  const byTop = [...usable].sort(
    (a, b) => (a.frame!.top + a.frame!.height / 2) - (b.frame!.top + b.frame!.height / 2),
  );

  const rows: OcrLine[][] = [];
  let current: OcrLine[] = [];
  let currentCenter = Number.NaN;

  for (const line of byTop) {
    const center = line.frame!.top + line.frame!.height / 2;
    if (current.length === 0 || Math.abs(center - currentCenter) <= tolerance) {
      current.push(line);
      // Track the running centre so a tall row does not drift away from itself.
      currentCenter = Number.isNaN(currentCenter)
        ? center
        : (currentCenter * (current.length - 1) + center) / current.length;
    } else {
      rows.push(current);
      current = [line];
      currentCenter = center;
    }
  }
  if (current.length > 0) rows.push(current);

  const banded = rows.map((row) =>
    row
      .sort((a, b) => a.frame!.left - b.frame!.left)
      .map((l) => l.text.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  return mergeContinuationRows(banded);
}

/**
 * Folds continuation lines back into the row they belong to.
 *
 * One table row is not one text line: a Description can wrap over four lines
 * and a Schedule cell routinely holds two meeting patterns stacked vertically.
 * Grouping purely by horizontal band splits those apart, which strands the
 * second pattern in a row of its own with no subject attached. A band that
 * introduces no new course code is treated as a continuation of the last one
 * that did.
 */
export function mergeContinuationRows(rows: string[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    // Only the FIRST token counts. The Course Code column is leftmost, so a
    // real subject row opens with it; a continuation line opens with a day, a
    // time or prose. Testing the whole row instead matched room codes like
    // "NGE105", which look identical to course codes and start no new subject.
    const firstToken = row.split(/[\s|]+/).filter(Boolean)[0] || '';
    const startsSubject = COURSE_CODE.test(firstToken.replace(/[^A-Za-z0-9]/g, ''));
    if (startsSubject || out.length === 0) {
      out.push(row);
    } else {
      out[out.length - 1] = `${out[out.length - 1]} ${row}`.replace(/\s+/g, ' ').trim();
    }
  }
  return out;
}

/**
 * The subject name for a row: the course code, plus its section tag when one
 * follows. Everything after that is the Description column, which is prose and
 * would otherwise end up inside the block label.
 */
function subjectNameFrom(before: string): string {
  const tokens = before.split(/[\s|]+/).filter(Boolean);
  const codeIndex = tokens.findIndex((t) => COURSE_CODE.test(t.replace(/[^A-Za-z0-9/]/g, '')));

  if (codeIndex === -1) {
    // No recognisable code — fall back to the first non-noise word so the block
    // is still labelled with something from the row.
    const first = tokens.find((t) => !NOISE.has(t.replace(/[^a-zA-Z]/g, '').toLowerCase()));
    return (first || '').trim();
  }

  const code = tokens[codeIndex].replace(/[^A-Za-z0-9/-]/g, '');
  const next = tokens[codeIndex + 1]?.replace(/[^A-Za-z0-9/]/g, '') || '';
  // "C0" is the cluster column and repeats on every row, so it is not a section.
  if (next && SECTION_TAG.test(next) && next.toUpperCase() !== 'C0') {
    return `${code} ${next}`.trim();
  }
  return code;
}

/**
 * Rooms for a row, in the order the schedule segments appear. A study load
 * lists them comma-separated and trailed by the delivery mode, so each part
 * contributes only its first token.
 */
function roomsFrom(after: string): string[] {
  return after
    .split(',')
    .map((part) => {
      const token = part.trim().split(/\s+/).filter(Boolean)[0] || '';
      const cleaned = token.replace(/[^A-Za-z0-9-]/g, '');
      if (!cleaned) return '';
      return NON_ROOM.has(cleaned.toLowerCase()) ? '' : cleaned;
    })
    .filter((r, i, arr) => r !== '' || i < arr.length);
}

/**
 * Every class a reconstructed row describes. A row with two meeting patterns
 * yields two entries; a header, a total or a line of prose yields none.
 */
export function extractClassesFromRow(row: string): ScannedClass[] {
  const text = (row || '').trim();
  if (!text) return [];

  const repaired = repairOcrDigits(text);
  SEGMENT.lastIndex = 0;
  const segments: { day: string; start: string; end: string; index: number; length: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = SEGMENT.exec(repaired)) !== null) {
    const day = match[1];
    // Only a token that resolves to real days counts, so "Programming 1 2.0"
    // and other prose cannot masquerade as a meeting pattern.
    if (normalizeScheduleDays(day).length === 0) continue;
    segments.push({ day, start: match[2].trim(), end: match[3].trim(), index: match.index, length: match[0].length });
  }
  if (segments.length === 0) return [];

  const first = segments[0];
  const last = segments[segments.length - 1];
  const name = subjectNameFrom(repaired.slice(0, first.index));
  if (!name) return [];

  const rooms = roomsFrom(repaired.slice(last.index + last.length));

  return segments.map((seg, i) => ({
    name,
    day: seg.day,
    startTime: seg.start,
    endTime: seg.end,
    // Rooms line up with segments when the row lists one per pattern;
    // otherwise every session shares the single room given.
    room: rooms[i] || (rooms.length === 1 ? rooms[0] : '') || '',
    instructor: '',
  }));
}

/** Back-compat single-class form. */
export function extractClassFromRow(row: string): ScannedClass | null {
  return extractClassesFromRow(row)[0] || null;
}

/**
 * The whole on-device path: OCR result in, scanned classes out, in the same
 * shape the AI scanner returns so both feed the identical import handler.
 */
export function parseOcrToClasses(result: OcrResult | null | undefined): ScannedClass[] {
  const rows = groupLinesIntoRows(collectOcrLines(result));
  const classes: ScannedClass[] = [];
  for (const row of rows) {
    for (const parsed of extractClassesFromRow(row)) {
      if (normalizeScheduleDays(parsed.day).length > 0) classes.push(parsed);
    }
  }
  return classes;
}
