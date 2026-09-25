import { Flashcard, NoteKind, FaceSegment, OcclusionData } from './types';
import { occlusionOrds, validateOcclusion, groupLabel, groupOfOrd, isLocateOrd, occlusionGroups } from './occlusion';

// ─── Note types ───────────────────────────────────────────────────────────────

export const NOTE_KINDS: { kind: NoteKind; label: string; icon: string; desc: string }[] = [
  { kind: 'basic', label: 'Basic', icon: 'document-text-outline', desc: 'One card: front, then back' },
  { kind: 'reversed', label: 'Both ways', icon: 'swap-horizontal-outline', desc: 'Two cards: front → back and back → front' },
  { kind: 'cloze', label: 'Cloze', icon: 'eye-off-outline', desc: 'Hide words in a sentence — one card per blank' },
  { kind: 'typein', label: 'Type answer', icon: 'create-outline', desc: 'Type the answer, then check it' },
  { kind: 'occlusion', label: 'Image', icon: 'image-outline', desc: 'Cover parts of a picture — one card per box' },
];

export function kindOf(card: Flashcard | null | undefined): NoteKind {
  const k = card?.kind;
  return k === 'reversed' || k === 'cloze' || k === 'typein' || k === 'occlusion' ? k : 'basic';
}

export function kindLabel(kind: NoteKind): string {
  return NOTE_KINDS.find((k) => k.kind === kind)?.label || 'Basic';
}

// ─── Cloze ────────────────────────────────────────────────────────────────────

type ClozeNode = { t: 'text'; text: string } | { t: 'cloze'; ord: number; hint?: string; children: ClozeNode[] };

const OPEN = /^\{\{c(\d+)::/;

/**
 * Parses Anki cloze syntax — `{{c1::answer}}`, `{{c1::answer::hint}}` — including
 * nested deletions (`{{c1::Canberra was {{c2::founded}}}}`). Anything malformed,
 * such as an opener that never closes, is kept as literal text rather than
 * swallowing the rest of the note.
 */
export function parseCloze(src: string): ClozeNode[] {
  const s = typeof src === 'string' ? src : '';

  const parse = (start: number, inside: boolean): { nodes: ClozeNode[]; end: number; hint?: string; closed: boolean } => {
    const nodes: ClozeNode[] = [];
    let buf = '';
    let i = start;
    const flush = () => {
      if (buf) nodes.push({ t: 'text', text: buf });
      buf = '';
    };
    while (i < s.length) {
      const m = OPEN.exec(s.slice(i, i + 12));
      if (m) {
        const inner = parse(i + m[0].length, true);
        if (inner.closed) {
          flush();
          nodes.push({ t: 'cloze', ord: Math.max(1, parseInt(m[1], 10)), hint: inner.hint, children: inner.nodes });
          i = inner.end;
          continue;
        }
        buf += m[0];
        i += m[0].length;
        continue;
      }
      if (inside && s.startsWith('}}', i)) {
        flush();
        return { nodes, end: i + 2, closed: true };
      }
      if (inside && s.startsWith('::', i)) {
        const close = s.indexOf('}}', i + 2);
        if (close === -1) break;
        flush();
        return { nodes, end: close + 2, hint: s.slice(i + 2, close).trim() || undefined, closed: true };
      }
      buf += s[i++];
    }
    flush();
    return { nodes, end: i, closed: !inside };
  };

  return parse(0, false).nodes;
}

/** Cloze numbers present in a note, ascending. Each one becomes a card. */
export function clozeNumbers(src: string): number[] {
  const out = new Set<number>();
  const walk = (nodes: ClozeNode[]) => {
    for (const n of nodes) {
      if (n.t === 'cloze') {
        out.add(n.ord);
        walk(n.children);
      }
    }
  };
  walk(parseCloze(src));
  return Array.from(out).sort((a, b) => a - b);
}

function flatten(nodes: ClozeNode[]): string {
  return nodes.map((n) => (n.t === 'text' ? n.text : flatten(n.children))).join('');
}

/**
 * One face of cloze card `ord`. On the question side the active deletion shows
 * as `[...]` (or `[hint]`) and every other deletion reads as plain text; on the
 * answer side the active deletion is highlighted in place, so the student sees
 * the fact in the sentence it belongs to.
 */
export function renderCloze(src: string, ord: number, side: 'question' | 'answer'): FaceSegment[] {
  const out: FaceSegment[] = [];
  const push = (text: string, style: FaceSegment['style']) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.style === style && style === 'plain') last.text += text;
    else out.push({ text, style });
  };
  const walk = (nodes: ClozeNode[]) => {
    for (const n of nodes) {
      if (n.t === 'text') push(n.text, 'plain');
      else if (n.ord === ord) {
        if (side === 'question') push(n.hint ? `[${n.hint}]` : '[...]', 'blank');
        else push(flatten(n.children), 'hl');
      } else walk(n.children);
    }
  };
  walk(parseCloze(src));
  return out;
}

/** The text hidden by cloze `ord`, for practice modes that need an answer string. */
export function clozeAnswer(src: string, ord: number): string {
  const found: string[] = [];
  const walk = (nodes: ClozeNode[]) => {
    for (const n of nodes) {
      if (n.t !== 'cloze') continue;
      if (n.ord === ord) found.push(flatten(n.children));
      else walk(n.children);
    }
  };
  walk(parseCloze(src));
  return found.join(', ');
}

/** The note's text with every deletion shown and highlighted, for the card browser. */
export function clozeOverview(src: string): FaceSegment[] {
  const out: FaceSegment[] = [];
  for (const n of parseCloze(src)) {
    if (n.t === 'text') out.push({ text: n.text, style: 'plain' });
    else out.push({ text: flatten(n.children), style: 'hl' });
  }
  return out;
}

/** The note's text with every deletion shown, for lists and search. */
export function clozePlain(src: string): string {
  return flatten(parseCloze(src));
}

/**
 * Wraps `text[start..end)` in a deletion. `same` reuses the highest number
 * already in the note so both words disappear on one card; otherwise the next
 * free number starts a new card — the two meanings of Anki's cloze shortcut.
 */
export function wrapCloze(
  text: string,
  start: number,
  end: number,
  same: boolean = false
): { text: string; ord: number; caret: number } {
  const src = text || '';
  const a = Math.max(0, Math.min(start, end, src.length));
  const b = Math.max(0, Math.min(Math.max(start, end), src.length));
  const nums = clozeNumbers(src);
  const max = nums.length ? nums[nums.length - 1] : 0;
  const ord = same && max > 0 ? max : max + 1;
  const open = `{{c${ord}::`;
  const inner = src.slice(a, b);
  const next = src.slice(0, a) + open + inner + '}}' + src.slice(b);
  return { text: next, ord, caret: a + open.length + inner.length + (inner ? 2 : 0) };
}

// ─── Faces ────────────────────────────────────────────────────────────────────

export interface CardFaces {
  question: FaceSegment[];
  answer: FaceSegment[];
  /** Shown under the answer: the Extra field on a cloze. */
  extra: string;
  /** The string to type, for type-in cards. */
  typeTarget: string | null;
}

const plain = (text: string): FaceSegment[] => (text ? [{ text, style: 'plain' }] : []);

/**
 * What the student sees for a card. `flip` swaps sides for Basic-style cards —
 * the session's "answer first" toggle — and is ignored for Cloze, where the
 * two sides are the same sentence.
 */
export function cardFaces(card: Flashcard, flip: boolean = false): CardFaces {
  const kind = kindOf(card);
  const front = card?.front || '';
  const back = card?.back || '';
  if (kind === 'occlusion') {
    // The picture carries the question; these are the words around it. A
    // locate card asks for the label, every other card answers with it.
    const label = groupLabel(card.occlusion?.masks || [], groupOfOrd(card.ord));
    if (isLocateOrd(card.ord)) {
      return { question: plain(`Where is ${label || 'it'}?`), answer: plain(label), extra: back, typeTarget: null };
    }
    return { question: plain(front), answer: plain(label), extra: back, typeTarget: null };
  }
  if (kind === 'cloze') {
    const ord = card.ord && card.ord > 0 ? card.ord : clozeNumbers(front)[0] || 1;
    return { question: renderCloze(front, ord, 'question'), answer: renderCloze(front, ord, 'answer'), extra: back, typeTarget: null };
  }
  let q = front;
  let a = back;
  if (kind === 'reversed' && card.ord === 1) [q, a] = [a, q];
  if (flip) [q, a] = [a, q];
  return { question: plain(q), answer: plain(a), extra: '', typeTarget: kind === 'typein' ? a : null };
}

const segText = (segs: FaceSegment[]) => segs.map((s) => s.text).join('');

/**
 * Question and answer as plain strings, for the practice test, speed match and
 * export — the modes that were built for two-sided cards.
 */
export function cardQA(card: Flashcard): { question: string; answer: string } {
  // A picture cannot become a multiple-choice string; empty strings keep image
  // cards out of the practice test and speed match.
  if (kindOf(card) === 'occlusion') return { question: '', answer: '' };
  if (kindOf(card) === 'cloze') {
    const ord = card.ord && card.ord > 0 ? card.ord : clozeNumbers(card.front)[0] || 1;
    return { question: segText(renderCloze(card.front, ord, 'question')), answer: clozeAnswer(card.front, ord) };
  }
  const f = cardFaces(card);
  return { question: segText(f.question), answer: segText(f.answer) };
}

// ─── Type-in ──────────────────────────────────────────────────────────────────

export interface DiffPart {
  text: string;
  kind: 'good' | 'bad' | 'missed';
}

const norm = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

export function typedMatches(typed: string, target: string): boolean {
  return norm(typed).length > 0 && norm(typed) === norm(target);
}

/**
 * Anki's type-answer comparison: what you typed, with the characters that
 * match the answer in green and the rest in red, plus the answer with the
 * characters you missed marked. A character-level LCS, compared ignoring case.
 */
export function typeDiff(typed: string, target: string): { typed: DiffPart[]; expected: DiffPart[] } {
  const a = (typed || '').trim().slice(0, 300);
  const b = (target || '').trim().slice(0, 300);
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  const n = A.length;
  const m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const typedParts: DiffPart[] = [];
  const expectedParts: DiffPart[] = [];
  const add = (list: DiffPart[], text: string, kind: DiffPart['kind']) => {
    const last = list[list.length - 1];
    if (last && last.kind === kind) last.text += text;
    else list.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      add(typedParts, a[i], 'good');
      add(expectedParts, b[j], 'good');
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      add(typedParts, a[i++], 'bad');
    } else {
      add(expectedParts, b[j++], 'missed');
    }
  }
  while (i < n) add(typedParts, a[i++], 'bad');
  while (j < m) add(expectedParts, b[j++], 'missed');
  return { typed: typedParts, expected: expectedParts };
}

// ─── Notes → cards ────────────────────────────────────────────────────────────

export interface NoteDraft {
  kind: NoteKind;
  /** Front, or the cloze text. */
  front: string;
  /** Back, or the cloze Extra field. For image occlusion: the header and the back extra. */
  back: string;
  tags?: string[];
  occlusion?: OcclusionData;
}

export function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      (raw || '')
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

/** Why a draft cannot be saved, or null when it can. */
export function validateNote(draft: NoteDraft): string | null {
  const front = (draft.front || '').trim();
  const back = (draft.back || '').trim();
  if (draft.kind === 'occlusion') return validateOcclusion(draft.occlusion);
  if (draft.kind === 'cloze') {
    if (!front) return 'Write the sentence first.';
    if (clozeNumbers(front).length === 0) return 'Hide at least one word: select it and tap Cloze.';
    return null;
  }
  if (!front || !back) return 'Fill in both the front and the back.';
  return null;
}

/** The card ords a draft produces. */
export function ordsFor(draft: NoteDraft): number[] {
  if (draft.kind === 'reversed') return [0, 1];
  if (draft.kind === 'cloze') return clozeNumbers(draft.front);
  if (draft.kind === 'occlusion') return occlusionOrds(draft.occlusion);
  return [0];
}

export function blankCard(id: string, now: number): Flashcard {
  return {
    id,
    front: '',
    back: '',
    interval: 0,
    easeFactor: 2.5,
    nextDue: now,
    reviewCount: 0,
    stepIndex: 0,
    state: 'new',
    createdAt: now,
  };
}

/**
 * Turns a note into its cards, reusing the scheduling of any sibling whose ord
 * survives the edit. Adding `{{c3::}}` to a cloze adds one new card; deleting
 * `{{c2::}}` removes exactly that card; editing the wording keeps every
 * card's progress.
 */
export function buildNoteCards(
  draft: NoteDraft,
  existing: Flashcard[],
  makeId: () => string,
  now: number = Date.now()
): Flashcard[] {
  const ords = ordsFor(draft);
  const noteId = existing[0] ? existing[0].noteId || existing[0].id : makeId();
  const front = (draft.front || '').trim();
  const back = (draft.back || '').trim();
  const tags = draft.tags && draft.tags.length ? draft.tags : undefined;
  // Ords only mean the same thing within a family: cloze numbers, mask groups,
  // or the 0/1 of basic-style notes.
  const family = (k: NoteKind) => (k === 'cloze' ? 'cloze' : k === 'occlusion' ? 'occlusion' : 'plain');
  const sameFamily = (c: Flashcard) => family(kindOf(c)) === family(draft.kind);

  return ords.map((ord) => {
    const prev = existing.find((c) => sameFamily(c) && (c.ord || 0) === ord);
    const base = prev || blankCard(makeId(), now);
    const card: Flashcard = { ...base, front, back, noteId, kind: draft.kind, ord };
    if (tags) card.tags = tags;
    else delete card.tags;
    if (draft.kind === 'occlusion' && draft.occlusion) card.occlusion = draft.occlusion;
    else delete card.occlusion;
    return card;
  });
}

/** Replaces a note's cards inside a deck's card list, keeping list order stable. */
export function replaceNote(cards: Flashcard[], noteId: string, next: Flashcard[]): Flashcard[] {
  const list = Array.isArray(cards) ? cards : [];
  const at = list.findIndex((c) => c && (c.noteId || c.id) === noteId);
  const rest = list.filter((c) => c && (c.noteId || c.id) !== noteId);
  if (at < 0) return [...rest, ...next];
  const before = list.slice(0, at).filter((c) => c && (c.noteId || c.id) !== noteId).length;
  return [...rest.slice(0, before), ...next, ...rest.slice(before)];
}

export interface NoteRow {
  noteId: string;
  kind: NoteKind;
  cards: Flashcard[];
  front: string;
  back: string;
  tags: string[];
}

/** Groups a deck's cards into notes, in list order, for the card browser. */
export function groupNotes(cards: Flashcard[]): NoteRow[] {
  const map = new Map<string, NoteRow>();
  for (const c of cards || []) {
    if (!c) continue;
    const id = c.noteId || c.id;
    const row = map.get(id);
    if (row) row.cards.push(c);
    else map.set(id, { noteId: id, kind: kindOf(c), cards: [c], front: c.front || '', back: c.back || '', tags: c.tags || [] });
  }
  return Array.from(map.values()).map((r) => ({ ...r, cards: r.cards.sort((a, b) => (a.ord || 0) - (b.ord || 0)) }));
}

/** Plain text for a note row: the cloze with deletions shown, or the front. */
export function notePreview(row: NoteRow): { title: string; sub: string } {
  if (row.kind === 'cloze') return { title: clozePlain(row.front), sub: row.back };
  if (row.kind === 'occlusion') {
    const occ = row.cards[0]?.occlusion;
    const n = occ ? occlusionGroups(occ.masks).length : 0;
    return { title: row.front || 'Image occlusion', sub: `${n} hidden part${n !== 1 ? 's' : ''}${occ?.mode === 'hideOne' ? ' · hide one' : ''}${row.back ? ` · ${row.back}` : ''}` };
  }
  return { title: row.front, sub: row.back };
}

// ─── Sample deck ──────────────────────────────────────────────────────────────

/**
 * A first deck that teaches the note types by being made of them. An empty
 * study tab asks a student to understand decks, notes, cloze and scheduling
 * before they have seen a single card; this lets them review first and read
 * the manual never.
 */
export const SAMPLE_NOTES: NoteDraft[] = [
  { kind: 'basic', front: 'What does spaced repetition do?', back: 'Shows a card right before you would forget it, so each review counts.' },
  { kind: 'basic', front: 'Which button should you press most?', back: 'Good. Save Again for answers you got wrong, and Easy for ones that took no effort.' },
  { kind: 'cloze', front: 'A {{c1::cloze}} card hides part of a sentence and asks you to fill the gap.', back: 'Select words in the editor and tap Cloze to make one.' },
  { kind: 'cloze', front: 'The mitochondria is the {{c1::powerhouse}} of the {{c2::cell}}.', back: 'Two numbers, two cards: each blank is tested on its own.' },
  { kind: 'reversed', front: 'Photosynthesis', back: 'How plants turn light, water and CO2 into glucose and oxygen' },
  { kind: 'typein', front: 'Capital of Japan?', back: 'Tokyo' },
];
