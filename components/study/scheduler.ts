import { Flashcard, FlashcardDeck, CardState, SRSettings, DeckDaily, Rating } from './types';

// ─── The study day ────────────────────────────────────────────────────────────

/**
 * A study day starts at 4 AM, not midnight — Anki's default, and for the same
 * reason: students study late. With a midnight cut-off a card answered at
 * 11:30 PM with a one-day interval comes due at 00:00 and is back in the queue
 * half an hour later, in what the student still thinks of as the same evening.
 */
export const ROLLOVER_HOUR = 4;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MIN_MS = 60 * 1000;

/** Learning cards due within this window are shown rather than ending the session. */
export const LEARN_AHEAD_MS = 20 * MIN_MS;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` of the study day `ts` falls in. */
export function studyDayKey(ts: number = Date.now()): string {
  const d = new Date(ts - ROLLOVER_HOUR * HOUR_MS);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole-day counter for the study day `ts` falls in. Differences are exact across DST. */
export function studyDayNumber(ts: number): number {
  const d = new Date(ts - ROLLOVER_HOUR * HOUR_MS);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** The instant the study day `days` after the one containing `ts` begins. */
export function studyDayStart(ts: number, days: number = 0): number {
  const d = new Date(ts - ROLLOVER_HOUR * HOUR_MS);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, ROLLOVER_HOUR, 0, 0, 0).getTime();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export const DEFAULT_SR_SETTINGS: SRSettings = {
  learningSteps: '1 10',
  relearningSteps: '10',
  graduatingInterval: 1,
  easyInterval: 4,
  desiredRetention: 0.9,
  newPerDay: 20,
  reviewsPerDay: 200,
  maximumInterval: 36500,
  burySiblings: true,
  studyTimeHour: 8,
  studyTimeMinute: 0,
};

function finite(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

/**
 * Steps are minutes, space-separated, as the options screen has always stored
 * them. `h`/`d` suffixes are accepted too, so "1 10 1h" means what it says.
 */
export function parseSteps(str: string | undefined, fallback: number[]): number[] {
  if (typeof str !== 'string') return fallback;
  const out: number[] = [];
  for (const raw of str.trim().split(/\s+/)) {
    const m = /^(\d+(?:\.\d+)?)([mhd]?)$/i.exec(raw);
    if (!m) continue;
    const n = parseFloat(m[1]);
    if (!(n > 0)) continue;
    const unit = m[2].toLowerCase();
    out.push(unit === 'd' ? n * 1440 : unit === 'h' ? n * 60 : n);
  }
  return out;
}

export function resolveSettings(sr?: Partial<SRSettings> | null): Required<SRSettings> {
  const s = sr || {};
  return {
    learningSteps: typeof s.learningSteps === 'string' ? s.learningSteps : DEFAULT_SR_SETTINGS.learningSteps!,
    relearningSteps: typeof s.relearningSteps === 'string' ? s.relearningSteps : DEFAULT_SR_SETTINGS.relearningSteps!,
    graduatingInterval: finite(s.graduatingInterval, 1),
    easyInterval: finite(s.easyInterval, 4),
    desiredRetention: Math.min(0.97, Math.max(0.7, finite(s.desiredRetention, 0.9))),
    newPerDay: Math.max(0, Math.floor(finite(s.newPerDay, 20))),
    reviewsPerDay: Math.max(0, Math.floor(finite(s.reviewsPerDay, 200))),
    maximumInterval: Math.max(1, Math.floor(finite(s.maximumInterval, 36500))),
    burySiblings: s.burySiblings !== false,
    studyTimeHour: finite(s.studyTimeHour, 8),
    studyTimeMinute: finite(s.studyTimeMinute, 0),
  };
}

// ─── FSRS-6 ───────────────────────────────────────────────────────────────────

/**
 * FSRS-6 default parameters — what Anki ships before a user has enough history
 * to optimise their own. Scheduling is FSRS rather than the SM-2 this tab used
 * to run because it is what Anki now recommends, and because it collapses the
 * knobs a student has to understand into one: how much they want to remember.
 */
export const FSRS_WEIGHTS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];
const W = FSRS_WEIGHTS;
const S_MIN = 0.001;
const DECAY = -W[20];
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const clampS = (s: number) => Math.max(S_MIN, s);

/** Probability of recall `t` days after a review, for a card of stability `s`. */
export function retrievability(t: number, s: number): number {
  if (!(s > 0)) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, t)) / s, DECAY);
}

const initStability = (g: Rating) => clampS(W[g - 1]);
const rawInitDifficulty = (g: Rating) => W[4] - Math.exp(W[5] * (g - 1)) + 1;
const initDifficulty = (g: Rating) => clampD(rawInitDifficulty(g));

function nextDifficulty(d: number, g: Rating): number {
  const delta = -W[6] * (g - 3);
  const damped = d + (delta * (10 - d)) / 9;
  return clampD(W[7] * rawInitDifficulty(4) + (1 - W[7]) * damped);
}

function recallStability(d: number, s: number, r: number, g: Rating): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return clampS(s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy));
}

function forgetStability(d: number, s: number, r: number): number {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
  return clampS(Math.min(sf, s / Math.exp(W[17] * W[18])));
}

function shortTermStability(s: number, g: Rating): number {
  let inc = Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(s, -W[19]);
  if (g >= 3) inc = Math.max(inc, 1);
  return clampS(s * inc);
}

function rawInterval(s: number, retention: number): number {
  return (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

/**
 * Converts an SM-2 card (interval + ease) into an FSRS memory state, the way
 * Anki does when FSRS is switched on for an existing collection. Cards made
 * before this scheduler keep their progress instead of starting over.
 */
export function memoryFromSm2(easeFactor: number, interval: number): { stability: number; difficulty: number } {
  const stability = clampS(Math.max(0.1, interval));
  const ease = Math.min(4, Math.max(1.3, finite(easeFactor, 2.5)));
  const denom = Math.exp(W[8]) * Math.pow(stability, -W[9]) * Math.expm1(0.1 * W[10]);
  return { stability, difficulty: clampD(11 - (ease - 1) / denom) };
}

// ─── Fuzz ─────────────────────────────────────────────────────────────────────

/** Deterministic 0..1 from a string, so a preview and the answer agree. */
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Spreads intervals of 3+ days by a few percent so cards added together do not
 * stay welded together forever. Seeded from the card, not `Math.random`, so the
 * interval printed on a button is the interval that button applies.
 */
function fuzzInterval(ivl: number, elapsedDays: number, maxIvl: number, seed: string): number {
  if (ivl < 2.5) return Math.round(ivl);
  const ranges = [
    { start: 2.5, end: 7, factor: 0.15 },
    { start: 7, end: 20, factor: 0.1 },
    { start: 20, end: Infinity, factor: 0.05 },
  ];
  let delta = 1;
  for (const r of ranges) delta += r.factor * Math.max(Math.min(ivl, r.end) - r.start, 0);
  let lo = Math.max(2, Math.round(ivl - delta));
  const hi = Math.min(Math.round(ivl + delta), maxIvl);
  if (ivl > elapsedDays) lo = Math.max(lo, elapsedDays + 1);
  lo = Math.min(lo, hi);
  return Math.floor(seededUnit(seed) * (hi - lo + 1) + lo);
}

function daysFrom(s: number, retention: number, maxIvl: number, elapsed: number, seed: string, fuzz = true): number {
  const ivl = Math.min(maxIvl, Math.max(1, rawInterval(s, retention)));
  const out = fuzz ? fuzzInterval(ivl, elapsed, maxIvl, seed) : Math.round(ivl);
  return Math.min(maxIvl, Math.max(1, out));
}

// ─── Card state ───────────────────────────────────────────────────────────────

/**
 * The card's queue. Cards written before this scheduler have no `state`; the
 * old fields map onto it exactly as the old status badges did.
 */
export function cardState(card: Flashcard): CardState {
  if (card.state === 'new' || card.state === 'learning' || card.state === 'review' || card.state === 'relearning') {
    return card.state;
  }
  if (!card.reviewCount) return 'new';
  if (!card.interval) return 'learning';
  return 'review';
}

export function isBuried(card: Flashcard, now: number = Date.now()): boolean {
  return typeof card.buriedUntil === 'string' && card.buriedUntil > studyDayKey(now);
}

/** Hidden from every queue: suspended, or buried until a later day. */
export function isSidelined(card: Flashcard, now: number = Date.now()): boolean {
  return Boolean(card.suspended) || isBuried(card, now);
}

export const noteIdOf = (card: Flashcard) => card.noteId || card.id;

function lastReviewOf(card: Flashcard, now: number): number {
  if (typeof card.lastReview === 'number' && Number.isFinite(card.lastReview)) return card.lastReview;
  // Pre-FSRS cards never recorded it. A review card was last seen one interval
  // before it came due; anything else, treat as seen just now.
  if (card.interval > 0 && Number.isFinite(card.nextDue)) return card.nextDue - card.interval * DAY_MS;
  return now;
}

// ─── Answering ────────────────────────────────────────────────────────────────

export interface AnswerResult {
  card: Flashcard;
  /** Minutes until due if it stays in (re)learning, otherwise null. */
  delayMins: number | null;
  /** Days until due once it is a review card, otherwise null. */
  intervalDays: number | null;
  graduated: boolean;
  lapsed: boolean;
  becameLeech: boolean;
}

export const LEECH_THRESHOLD = 8;

/**
 * Answers a card the way Anki does with FSRS switched on: new and forgotten
 * cards walk the (re)learning steps in minutes, then graduate into day-level
 * intervals that FSRS derives from the target retention.
 */
export interface AnswerContext {
  /** The owning deck's exam date (`YYYY-MM-DD`) while it is in exam mode. */
  examDate?: string | null;
}

export function answerCard(
  card: Flashcard,
  rating: Rating,
  sr?: Partial<SRSettings> | null,
  now: number = Date.now(),
  ctx: AnswerContext = {}
): AnswerResult {
  const s = resolveSettings(sr);
  const g = (rating >= 1 && rating <= 4 ? Math.round(rating) : 3) as Rating;
  const state = cardState(card);
  const seed = `${card.id}:${finite(card.reviewCount, 0)}`;
  const reps = Math.max(0, Math.floor(finite(card.reviewCount, 0)));

  let stability = finite(card.stability, NaN);
  let difficulty = finite(card.difficulty, NaN);
  const hadMemory = Number.isFinite(stability) && stability > 0 && Number.isFinite(difficulty);

  const last = lastReviewOf(card, now);
  const elapsedDays = Math.max(0, studyDayNumber(now) - studyDayNumber(last));

  // ── Memory state ──
  if (state === 'new' || (!hadMemory && state !== 'review')) {
    stability = initStability(g);
    difficulty = initDifficulty(g);
  } else {
    if (!hadMemory) {
      const m = memoryFromSm2(card.easeFactor, card.interval);
      stability = m.stability;
      difficulty = m.difficulty;
    }
    const r = retrievability(elapsedDays, stability);
    if (elapsedDays === 0) {
      stability = shortTermStability(stability, g);
    } else if (g === 1) {
      stability = forgetStability(difficulty, stability, r);
    } else {
      stability = recallStability(difficulty, stability, r, g);
    }
    difficulty = nextDifficulty(difficulty, g);
  }

  // ── Queue ──
  const learning = parseSteps(s.learningSteps, [1, 10]);
  const relearning = parseSteps(s.relearningSteps, [10]);
  let lapses = Math.max(0, Math.floor(finite(card.lapses, 0)));
  let nextState: CardState;
  let step = 0;
  let delayMins: number | null = null;
  let intervalDays: number | null = null;
  let lapsed = false;

  const stepped = (steps: number[], at: number) => {
    // Hard on the first step waits halfway to the second, as Anki does.
    if (g === 1) return { step: 0, delay: steps[0] };
    if (g === 2) {
      if (at === 0) {
        const delay = steps.length > 1 ? (steps[0] + steps[1]) / 2 : Math.min(steps[0] * 1.5, steps[0] + 1440);
        return { step: 0, delay };
      }
      return { step: at, delay: steps[at] };
    }
    if (g === 3 && at + 1 < steps.length) return { step: at + 1, delay: steps[at + 1] };
    return null; // graduates
  };

  const cap = intervalCap(s.maximumInterval, ctx.examDate, now);
  const graduate = () => {
    const ivl = daysFrom(stability, s.desiredRetention, cap, elapsedDays, seed);
    intervalDays = ivl;
    nextState = 'review';
  };

  if (state === 'review') {
    if (g === 1) {
      lapses += 1;
      lapsed = true;
      if (relearning.length > 0) {
        nextState = 'relearning';
        step = 0;
        delayMins = relearning[0];
      } else {
        graduate();
      }
    } else {
      // Keep Hard ≤ Good < Easy even when the model's raw numbers would cross.
      const base = hadMemory
        ? { stability: card.stability as number, difficulty: card.difficulty as number }
        : memoryFromSm2(card.easeFactor, card.interval);
      const r0 = retrievability(elapsedDays, base.stability);
      const pick = (gr: Rating) =>
        elapsedDays === 0 ? shortTermStability(base.stability, gr) : recallStability(base.difficulty, base.stability, r0, gr);
      const hardI = daysFrom(pick(2), s.desiredRetention, cap, elapsedDays, seed);
      const goodI = daysFrom(pick(3), s.desiredRetention, cap, elapsedDays, seed);
      const easyI = daysFrom(pick(4), s.desiredRetention, cap, elapsedDays, seed);
      const hard = Math.min(hardI, goodI);
      const good = Math.min(cap, Math.max(goodI, hard + 1));
      const easy = Math.min(cap, Math.max(easyI, good + 1));
      intervalDays = g === 2 ? hard : g === 3 ? good : easy;
      nextState = 'review';
    }
  } else {
    const steps = state === 'relearning' ? (relearning.length ? relearning : [10]) : learning.length ? learning : [1];
    const at = state === 'new' ? 0 : Math.min(steps.length - 1, Math.max(0, Math.floor(finite(card.step ?? card.stepIndex, 0))));
    const next = stepped(steps, at);
    if (next) {
      nextState = state === 'relearning' ? 'relearning' : 'learning';
      step = next.step;
      delayMins = next.delay;
    } else {
      graduate();
    }
  }

  const becameLeech = lapsed && lapses >= LEECH_THRESHOLD && (lapses - LEECH_THRESHOLD) % Math.ceil(LEECH_THRESHOLD / 2) === 0;

  let nextDue: number;
  let interval: number;
  if (delayMins !== null) {
    nextDue = now + delayMins * MIN_MS;
    interval = 0;
  } else {
    interval = intervalDays ?? 1;
    nextDue = studyDayStart(now, interval);
  }

  const updated: Flashcard = {
    ...card,
    state: nextState!,
    stability: Math.round(stability * 10000) / 10000,
    difficulty: Math.round(difficulty * 10000) / 10000,
    step,
    stepIndex: step,
    interval,
    nextDue,
    lastReview: now,
    reviewCount: reps + 1,
    // Unused by FSRS, but an older build reading this ledger schedules with it,
    // so it must never carry a corrupt value forward.
    easeFactor: Math.min(4, Math.max(1.3, finite(card.easeFactor, 2.5))),
    lapses,
    leech: card.leech || becameLeech || undefined,
    introducedOn: card.introducedOn || studyDayKey(now),
  };
  if (!updated.leech) delete updated.leech;

  return {
    card: updated,
    delayMins,
    intervalDays: delayMins === null ? interval : null,
    graduated: (state === 'new' || state === 'learning' || state === 'relearning') && nextState! === 'review',
    lapsed,
    becameLeech,
  };
}

/**
 * The longest interval allowed: the global maximum, or — while a deck is in
 * exam mode — the days left before the exam, so nothing is scheduled past it.
 */
export function intervalCap(maximumInterval: number, examDate: string | null | undefined, now: number): number {
  if (typeof examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    const [y, m, d] = examDate.split('-').map(Number);
    const left = studyDayNumber(new Date(y, m - 1, d, 12).getTime()) - studyDayNumber(now) - 1;
    if (left >= 0) return Math.max(1, Math.min(maximumInterval, left));
  }
  return maximumInterval;
}

/** Back-compat name: the rest of the tab (and its tests) call `applyRating`. */
export function applyRating(
  card: Flashcard,
  rating: 1 | 2 | 3 | 4,
  sr?: Partial<SRSettings> | null,
  now?: number,
  ctx?: AnswerContext
): Flashcard {
  if (!card) return card;
  return answerCard(card, rating, sr, now, ctx).card;
}

// ─── Button labels ────────────────────────────────────────────────────────────

/** Anki's compact interval format: 1m · 6m · 1h · 3d · 1.4mo · 2.1y. */
export function formatInterval(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'now';
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)}h`;
  }
  const days = minutes / 1440;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) {
    const mo = days / 30.44;
    return `${Math.round(mo * 10) / 10}mo`;
  }
  return `${Math.round((days / 365) * 10) / 10}y`;
}

export function previewIntervals(
  card: Flashcard,
  sr?: Partial<SRSettings> | null,
  now: number = Date.now(),
  ctx?: AnswerContext
): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  ([1, 2, 3, 4] as Rating[]).forEach((g) => {
    const res = answerCard(card, g, sr, now, ctx);
    out[g] = res.delayMins !== null ? formatInterval(res.delayMins) : formatInterval((res.intervalDays || 1) * 1440);
  });
  return out;
}

// ─── Daily limits & queues ────────────────────────────────────────────────────

export function dailyFor(deck: FlashcardDeck, now: number = Date.now()): DeckDaily {
  const today = studyDayKey(now);
  const d = deck.daily;
  if (d && d.date === today) {
    return { date: today, newDone: finite(d.newDone, 0), reviewDone: finite(d.reviewDone, 0), newBonus: finite(d.newBonus, 0) };
  }
  return { date: today, newDone: 0, reviewDone: 0, newBonus: 0 };
}

/**
 * New cards a deck may still introduce today. In exam mode the limit is lifted
 * to whatever spreads the remaining new cards evenly over the days left.
 */
export function newLimitLeft(deck: FlashcardDeck, sr?: Partial<SRSettings> | null, now: number = Date.now()): number {
  const s = resolveSettings(sr);
  const daily = dailyFor(deck, now);
  let limit = s.newPerDay + daily.newBonus;
  const exam = examDaysLeft(deck, now);
  if (exam !== null) {
    const unseen = (deck.cards || []).filter((c) => c && cardState(c) === 'new' && !isSidelined(c, now)).length + daily.newDone;
    limit = Math.max(limit, Math.ceil(unseen / Math.max(1, exam)));
  }
  return Math.max(0, limit - daily.newDone);
}

export function reviewLimitLeft(deck: FlashcardDeck, sr?: Partial<SRSettings> | null, now: number = Date.now()): number {
  const s = resolveSettings(sr);
  return Math.max(0, s.reviewsPerDay - dailyFor(deck, now).reviewDone);
}

/** Days left before the deck's exam (0 on exam day), or null when not in exam mode. */
export function examDaysLeft(deck: FlashcardDeck, now: number = Date.now()): number | null {
  if (!deck || typeof deck.examDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deck.examDate)) return null;
  const [y, m, d] = deck.examDate.split('-').map(Number);
  const left = studyDayNumber(new Date(y, m - 1, d, 12).getTime()) - studyDayNumber(now);
  return left >= 0 ? left : null;
}

export interface DueCounts {
  new: number;
  learn: number;
  review: number;
}

/** Anki's three numbers for a deck: new (capped), learning due today, reviews (capped). */
export function deckDueCounts(deck: FlashcardDeck, sr?: Partial<SRSettings> | null, now: number = Date.now()): DueCounts {
  const counts: DueCounts = { new: 0, learn: 0, review: 0 };
  if (!deck || !Array.isArray(deck.cards)) return counts;
  const endOfDay = studyDayStart(now, 1);
  const bury = resolveSettings(sr).burySiblings;
  const newNotes = new Set<string>();
  const reviewNotes = new Set<string>();
  for (const c of deck.cards) {
    if (!c || isSidelined(c, now)) continue;
    const st = cardState(c);
    // With burying on, one card per note a day — siblings wait. Off, every
    // card counts on its own (the card id stands in for the note).
    const key = bury ? noteIdOf(c) : c.id;
    if (st === 'new') {
      newNotes.add(key);
    } else if (st === 'learning' || st === 'relearning') {
      if (c.nextDue < endOfDay) counts.learn++;
    } else if (c.nextDue <= now) {
      reviewNotes.add(key);
    }
  }
  counts.new = Math.min(newNotes.size, newLimitLeft(deck, sr, now));
  counts.review = Math.min(reviewNotes.size, reviewLimitLeft(deck, sr, now));
  return counts;
}

export function sumCounts(list: DueCounts[]): DueCounts {
  return list.reduce((a, b) => ({ new: a.new + b.new, learn: a.learn + b.learn, review: a.review + b.review }), { new: 0, learn: 0, review: 0 });
}

export type SessionMode = 'normal' | 'ahead' | 'cram';

export interface QueueRef {
  deckId: string;
  cardId: string;
}

/**
 * The new + review part of a session, fixed when it starts. Learning cards are
 * not in it — they are picked live by `pickNext`, because their due times move
 * with every answer.
 *
 * Reviews come first by due date, new cards are mixed in evenly (Anki's "mix
 * with reviews"), and each note contributes at most one card per day.
 */
export function buildQueue(
  decks: FlashcardDeck[],
  deckIds: Set<string> | null,
  sr?: Partial<SRSettings> | null,
  now: number = Date.now(),
  mode: SessionMode = 'normal',
  aheadDays: number = 7
): QueueRef[] {
  const scope = (decks || []).filter((d) => d && Array.isArray(d.cards) && (!deckIds || deckIds.has(d.id)));
  const seenNotes = new Set<string>();
  const bury = resolveSettings(sr).burySiblings;
  // Off: each card is its own "note" here, so siblings can share a session.
  const noteKey = (c: Flashcard) => (bury ? noteIdOf(c) : c.id);

  if (mode === 'cram') {
    const all: QueueRef[] = [];
    for (const d of scope) for (const c of d.cards) if (c && !c.suspended) all.push({ deckId: d.id, cardId: c.id });
    return shuffle(all, `${now}`);
  }

  const reviews: { ref: QueueRef; due: number; note: string }[] = [];
  const news: { ref: QueueRef; note: string }[] = [];
  const horizon = mode === 'ahead' ? studyDayStart(now, Math.max(1, aheadDays) + 1) : now;

  for (const d of scope) {
    const reviewCap = mode === 'ahead' ? Infinity : reviewLimitLeft(d, sr, now);
    const newCap = mode === 'ahead' ? 0 : newLimitLeft(d, sr, now);
    const deckReviews = d.cards
      .filter((c) => c && !isSidelined(c, now) && cardState(c) === 'review' && c.nextDue <= horizon)
      .sort((a, b) => a.nextDue - b.nextDue);
    let taken = 0;
    for (const c of deckReviews) {
      if (taken >= reviewCap) break;
      const note = noteKey(c);
      if (seenNotes.has(note)) continue;
      seenNotes.add(note);
      reviews.push({ ref: { deckId: d.id, cardId: c.id }, due: c.nextDue, note });
      taken++;
    }
    const deckNew = d.cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c && !isSidelined(c, now) && cardState(c) === 'new')
      .sort((a, b) => (finite(a.c.createdAt, 0) - finite(b.c.createdAt, 0)) || a.i - b.i || (a.c.ord || 0) - (b.c.ord || 0));
    let added = 0;
    for (const { c } of deckNew) {
      if (added >= newCap) break;
      const note = noteKey(c);
      if (seenNotes.has(note)) continue;
      seenNotes.add(note);
      news.push({ ref: { deckId: d.id, cardId: c.id }, note });
      added++;
    }
  }

  reviews.sort((a, b) => a.due - b.due);
  const out: QueueRef[] = [];
  if (news.length === 0) return reviews.map((r) => r.ref);
  if (reviews.length === 0) return news.map((n) => n.ref);
  // Interleave: one new card every `gap` reviews.
  const gap = Math.max(1, Math.floor(reviews.length / news.length));
  let ni = 0;
  reviews.forEach((r, i) => {
    out.push(r.ref);
    if ((i + 1) % gap === 0 && ni < news.length) out.push(news[ni++].ref);
  });
  while (ni < news.length) out.push(news[ni++].ref);
  return out;
}

function shuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededUnit(`${seed}:${i}`) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function findCard(decks: FlashcardDeck[], ref: QueueRef): Flashcard | null {
  const d = decks.find((x) => x && x.id === ref.deckId);
  return d?.cards?.find((c) => c && c.id === ref.cardId) || null;
}

export interface PickResult {
  ref: QueueRef | null;
  /** Position in the fixed queue after this pick. */
  queuePos: number;
  /** When nothing is left now but a learning card is due later today. */
  nextLearningAt: number | null;
}

/**
 * The next card to show. Learning cards that are due come first; then the
 * fixed queue; then a learning card due within the learn-ahead window, so the
 * last few "Again" cards do not strand the student on an empty screen for a
 * minute. Anything the student has since suspended, buried or deleted is
 * skipped rather than shown.
 */
export function pickNext(
  decks: FlashcardDeck[],
  deckIds: Set<string> | null,
  queue: QueueRef[],
  queuePos: number,
  now: number = Date.now(),
  opts: { skip?: string; mode?: SessionMode } = {}
): PickResult {
  if (opts.mode === 'cram') {
    let pos = queuePos;
    while (pos < queue.length) {
      const c = findCard(decks, queue[pos]);
      if (c && !c.suspended) return { ref: queue[pos], queuePos: pos + 1, nextLearningAt: null };
      pos++;
    }
    return { ref: null, queuePos: pos, nextLearningAt: null };
  }

  const scope = (decks || []).filter((d) => d && Array.isArray(d.cards) && (!deckIds || deckIds.has(d.id)));
  const endOfDay = studyDayStart(now, 1);
  let dueLearn: { ref: QueueRef; due: number } | null = null;
  let laterLearn: { ref: QueueRef; due: number } | null = null;
  for (const d of scope) {
    for (const c of d.cards) {
      if (!c || isSidelined(c, now)) continue;
      const st = cardState(c);
      if (st !== 'learning' && st !== 'relearning') continue;
      if (c.nextDue >= endOfDay) continue;
      const cand = { ref: { deckId: d.id, cardId: c.id }, due: c.nextDue };
      if (c.nextDue <= now) {
        if (!dueLearn || c.nextDue < dueLearn.due) dueLearn = cand;
      } else if (!laterLearn || c.nextDue < laterLearn.due) {
        laterLearn = cand;
      }
    }
  }
  if (dueLearn && dueLearn.ref.cardId !== opts.skip) return { ref: dueLearn.ref, queuePos, nextLearningAt: null };

  let pos = queuePos;
  while (pos < queue.length) {
    const c = findCard(decks, queue[pos]);
    const st = c ? cardState(c) : null;
    const stillEligible =
      c && !isSidelined(c, now) && (st === 'new' || (st === 'review' && (opts.mode === 'ahead' || c.nextDue <= now)));
    if (stillEligible) return { ref: queue[pos], queuePos: pos + 1, nextLearningAt: null };
    pos++;
  }

  if (dueLearn) return { ref: dueLearn.ref, queuePos: pos, nextLearningAt: null };
  if (laterLearn && laterLearn.due - now <= LEARN_AHEAD_MS) return { ref: laterLearn.ref, queuePos: pos, nextLearningAt: null };
  return { ref: null, queuePos: pos, nextLearningAt: laterLearn ? laterLearn.due : null };
}

/** New / learning / review cards still to come in a running session, for the counter. */
export function sessionRemaining(
  decks: FlashcardDeck[],
  deckIds: Set<string> | null,
  queue: QueueRef[],
  queuePos: number,
  now: number = Date.now()
): DueCounts {
  const out: DueCounts = { new: 0, learn: 0, review: 0 };
  for (let i = queuePos; i < queue.length; i++) {
    const c = findCard(decks, queue[i]);
    if (!c || isSidelined(c, now)) continue;
    const st = cardState(c);
    if (st === 'new') out.new++;
    else if (st === 'review') out.review++;
  }
  const endOfDay = studyDayStart(now, 1);
  for (const d of decks || []) {
    if (!d || !Array.isArray(d.cards) || (deckIds && !deckIds.has(d.id))) continue;
    for (const c of d.cards) {
      if (!c || isSidelined(c, now)) continue;
      const st = cardState(c);
      if ((st === 'learning' || st === 'relearning') && c.nextDue < endOfDay) out.learn++;
    }
  }
  return out;
}

/**
 * Buries the other cards of a note until tomorrow once one of them has been
 * answered — the reverse of a card you just saw is not a real test of memory.
 * Cards already in (re)learning are left alone, as in Anki.
 */
export function burySiblings(cards: Flashcard[], answered: Flashcard, now: number = Date.now()): Flashcard[] {
  const note = noteIdOf(answered);
  const tomorrow = studyDayKey(studyDayStart(now, 1));
  return cards.map((c) => {
    if (!c || c.id === answered.id || noteIdOf(c) !== note) return c;
    const st = cardState(c);
    if (st === 'learning' || st === 'relearning') return c;
    if (st === 'review' && c.nextDue > studyDayStart(now, 1)) return c;
    return { ...c, buriedUntil: tomorrow, buriedReason: 'sibling' as const };
  });
}

/**
 * Releases cards held back only because a sibling was answered — for when a
 * student turns sibling burying off and expects the rest of the note today.
 * Cards buried before the reason was recorded count as sibling burials when
 * their note has other cards; a card buried by hand keeps its burial.
 */
export function unburySiblings(cards: Flashcard[]): Flashcard[] {
  const perNote = new Map<string, number>();
  for (const c of cards || []) if (c) perNote.set(noteIdOf(c), (perNote.get(noteIdOf(c)) || 0) + 1);
  return (cards || []).map((c) => {
    if (!c || !c.buriedUntil) return c;
    const sibling = c.buriedReason === 'sibling' || (!c.buriedReason && (perNote.get(noteIdOf(c)) || 0) > 1);
    if (!sibling) return c;
    const { buriedUntil: _b, buriedReason: _r, ...rest } = c;
    return rest as Flashcard;
  });
}

/** Records one answer against the deck's daily limits. */
export function bumpDaily(deck: FlashcardDeck, prevState: CardState, now: number = Date.now()): FlashcardDeck {
  const d = dailyFor(deck, now);
  return {
    ...deck,
    daily: {
      ...d,
      newDone: d.newDone + (prevState === 'new' ? 1 : 0),
      reviewDone: d.reviewDone + (prevState === 'review' ? 1 : 0),
    },
  };
}

// ─── Deck composition ─────────────────────────────────────────────────────────

export interface Composition {
  new: number;
  learning: number;
  young: number;
  mature: number;
  suspended: number;
  total: number;
}

/** Anki's card-count breakdown. Mature means an interval of 21 days or more. */
export function composition(cards: Flashcard[]): Composition {
  const out: Composition = { new: 0, learning: 0, young: 0, mature: 0, suspended: 0, total: 0 };
  for (const c of cards || []) {
    if (!c) continue;
    out.total++;
    if (c.suspended) {
      out.suspended++;
      continue;
    }
    const st = cardState(c);
    if (st === 'new') out.new++;
    else if (st === 'learning' || st === 'relearning') out.learning++;
    else if (c.interval >= 21) out.mature++;
    else out.young++;
  }
  return out;
}

/** Review cards coming due on each of the next `days` study days (today first). */
export function forecast(decks: FlashcardDeck[], days: number = 7, now: number = Date.now()): number[] {
  const out = new Array(Math.max(1, days)).fill(0);
  const today = studyDayNumber(now);
  for (const d of decks || []) {
    for (const c of d?.cards || []) {
      if (!c || c.suspended) continue;
      const st = cardState(c);
      if (st === 'new') continue;
      const idx = Math.max(0, studyDayNumber(c.nextDue) - today);
      if (idx < out.length) out[idx]++;
    }
  }
  return out;
}

// ─── Exam mode ────────────────────────────────────────────────────────────────

/**
 * Entering exam mode: review cards that would next come up on or after exam
 * day are pulled forward and spread across the days that are left, so every
 * card gets one more look before the exam without landing all at once.
 * New cards are paced by `newLimitLeft`; intervals are capped by `intervalCap`.
 */
export function planExamReschedule(cards: Flashcard[], examDate: string, now: number = Date.now()): Flashcard[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate || '')) return cards;
  const [y, m, d] = examDate.split('-').map(Number);
  const left = studyDayNumber(new Date(y, m - 1, d, 12).getTime()) - studyDayNumber(now);
  if (left < 0) return cards;
  const examStart = studyDayStart(now, left);
  const span = Math.max(1, left);
  return (cards || []).map((c) => {
    if (!c || c.suspended || cardState(c) !== 'review' || c.nextDue < examStart) return c;
    const day = Math.floor(seededUnit(`exam:${c.id}`) * span);
    return { ...c, nextDue: studyDayStart(now, day) };
  });
}

/** Review cards that exam mode would pull forward, for the sheet's summary. */
export function examPullCount(cards: Flashcard[], examDate: string, now: number = Date.now()): number {
  const moved = planExamReschedule(cards, examDate, now);
  return moved.filter((c, i) => c !== (cards || [])[i]).length;
}
