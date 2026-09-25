import {
  Flashcard,
  FlashcardDeck,
  SessionCard,
  DeckNode,
  NodeStats,
  SRSettings,
  FlashcardStats,
  DayLog,
  LevelInfo,
  DayActivity,
  ExamScheduleSlot,
} from './types';
import { cardState } from './scheduler';
import { clozeNumbers } from './notes';

// The scheduler and the note model are re-exported from here so the tab — and
// its tests — keep one import path for the study engine.
export * from './scheduler';
export * from './notes';

// ─── Constants ────────────────────────────────────────────────────────────────

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

export const DECK_COLORS = [
  '#4f46e5', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#eab308', // Amber
  '#f97316', // Orange
  '#ec4899', // Pink
  '#8b5cf6', // Violet
];

export const DECK_ICONS = [
  'albums-outline',
  'book-outline',
  'school-outline',
  'bulb-outline',
  'calculator-outline',
  'flask-outline',
  'code-slash-outline',
  'globe-outline',
  'language-outline',
  'library-outline',
  'medkit-outline',
  'musical-notes-outline',
  'planet-outline',
  'sparkles-outline',
  'trophy-outline',
  'stats-chart-outline',
];

export const STATUS_CONFIG = {
  new: { label: 'New', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', darkBg: 'rgba(139,92,246,0.25)' },
  learning: { label: 'Learning', color: '#f97316', bg: 'rgba(249,115,22,0.12)', darkBg: 'rgba(249,115,22,0.25)' },
  due: { label: 'Review', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', darkBg: 'rgba(59,130,246,0.25)' },
  mastered: { label: 'Mastered', color: '#10b981', bg: 'rgba(16,185,129,0.12)', darkBg: 'rgba(16,185,129,0.25)' },
};

// ─── Utilities & Helpers ──────────────────────────────────────────────────────

export function getLocalDateString(d: Date = new Date()): string {
  const dateObj = d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getColorWithAlpha(color: string, alpha: number = 1): string {
  const safeAlpha = typeof alpha === 'number' && Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  if (!color) return `rgba(79, 70, 229, ${safeAlpha})`;
  if (color.startsWith('rgba') || color.startsWith('hsla')) return color;
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
  }
  return color;
}

export function makeNewCard(front: string, back: string): Flashcard {
  const now = Date.now();
  return {
    id: generateId(),
    front: (front || '').trim(),
    back: (back || '').trim(),
    interval: 0,
    easeFactor: 2.5,
    nextDue: now,
    reviewCount: 0,
    stepIndex: 0,
    state: 'new',
    createdAt: now,
  };
}

// ─── Tree & Hierarchical Structure ────────────────────────────────────────────

export function buildDeckTree(decks: FlashcardDeck[]): DeckNode[] {
  const rootNodes = new Map<string, DeckNode>();
  if (!Array.isArray(decks)) return [];

  decks.forEach((deck) => {
    if (!deck) return;
    const s = deck.subject ? deck.subject.trim() : '';
    const rawName = deck.name ? deck.name.trim() : '';
    const n = rawName || (s ? s.split('::').pop() || 'Untitled Deck' : 'Untitled Deck');
    let fullPath = n;
    if (s) {
      if (n === s || n.startsWith(s + '::')) {
        fullPath = n;
      } else if (s.startsWith(n + '::') || s.endsWith('::' + n) || s.includes('::' + n + '::')) {
        fullPath = s;
      } else {
        fullPath = `${s}::${n}`;
      }
    }
    const parts = fullPath.split('::').filter(Boolean);
    if (parts.length === 0) {
      parts.push(n);
    }
    let currentMap = rootNodes;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}::${part}` : part;
      if (!currentMap.has(part)) {
        currentMap.set(part, { name: part, fullPath: currentPath, deck: null, children: new Map() });
      }
      const node = currentMap.get(part)!;
      if (i === parts.length - 1) {
        node.deck = deck;
      }
      currentMap = node.children;
    }
  });

  const sortNodes = (map: Map<string, DeckNode>): DeckNode[] => {
    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => {
        node.children = new Map(sortNodes(node.children).map((n) => [n.name, n]));
        return node;
      });
  };

  return sortNodes(rootNodes);
}

export function getNodeStats(node: DeckNode): NodeStats {
  const stats: NodeStats = { new: 0, learning: 0, due: 0, total: 0, mastered: 0 };
  if (!node) return stats;
  const now = Date.now();

  const addCards = (cards: Flashcard[]) => {
    if (!Array.isArray(cards)) return;
    for (const c of cards) {
      if (!c) continue;
      stats.total++;
      const st = cardState(c);
      if (st === 'new') stats.new++;
      else if (st === 'learning' || st === 'relearning') stats.learning++;
      else if (c.nextDue <= now) stats.due++;
      else stats.mastered++;
    }
  };

  if (node.deck) addCards(node.deck.cards);
  for (const child of node.children.values()) {
    const cs = getNodeStats(child);
    stats.new += cs.new;
    stats.learning += cs.learning;
    stats.due += cs.due;
    stats.total += cs.total;
    stats.mastered += cs.mastered;
  }
  return stats;
}

export function collectCards(node: DeckNode): SessionCard[] {
  let cards: SessionCard[] = [];
  if (!node) return cards;
  if (node.deck && Array.isArray(node.deck.cards)) {
    cards = cards.concat(
      node.deck.cards
        .filter(Boolean)
        .map((c) => ({ ...c, deckId: node.deck!.id }))
    );
  }
  for (const child of node.children.values()) {
    cards = cards.concat(collectCards(child));
  }
  return cards;
}

export function collectDecksFromNode(node: DeckNode): FlashcardDeck[] {
  let list: FlashcardDeck[] = [];
  if (!node) return list;
  if (node.deck) list.push(node.deck);
  node.children.forEach((child) => {
    list = list.concat(collectDecksFromNode(child));
  });
  return list;
}

export function getCardStatus(card: Flashcard): 'new' | 'learning' | 'due' | 'mastered' {
  if (!card) return 'new';
  const st = cardState(card);
  if (st === 'new') return 'new';
  if (st === 'learning' || st === 'relearning') return 'learning';
  if (card.nextDue <= Date.now()) return 'due';
  return 'mastered';
}

export function getNextDueText(node: DeckNode): string {
  if (!node) return '';
  const now = Date.now();
  let soonest = Infinity;
  const checkCards = (n: DeckNode) => {
    if (!n) return;
    if (n.deck && Array.isArray(n.deck.cards)) {
      for (const c of n.deck.cards) {
        if (c && typeof c.nextDue === 'number' && c.nextDue > now && c.nextDue < soonest) {
          soonest = c.nextDue;
        }
      }
    }
    for (const child of n.children.values()) checkCards(child);
  };
  checkCards(node);
  if (soonest === Infinity) return '';
  const diffSec = Math.max(0, Math.round((soonest - now) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

// ─── Thematic Deck Icons ──────────────────────────────────────────────────────

export function getDeckThematicIcon(subject?: string, name?: string): string {
  const text = `${subject || ''} ${name || ''}`.toLowerCase();
  if (/comp|code|prog|\bcs\b|dev|algo|python|java|react|script|web|software|sql|data|c\+\+|html|css|js|ts/i.test(text)) return 'code-slash-outline';
  if (/med|health|nurs|anat|pharm|doctor|clinic|dent|physio/i.test(text)) return 'medkit-outline';
  if (/math|calc|algeb|geom|stat|trig|num|quant|linear/i.test(text)) return 'calculator-outline';
  if (/bio|chem|phys|sci|lab|\batom|cell|gene|organ/i.test(text)) return 'flask-outline';
  if (/lang|span|french|german|jap|vocab|eng|lit|write|grammar|chinese|korean|latin|words/i.test(text)) return 'language-outline';
  if (/hist|civic|gov|law|world|geo|politic|social/i.test(text)) return 'globe-outline';
  if (/bus|econ|fin|acc|market|money|trade|invest|bank|manage/i.test(text)) return 'stats-chart-outline';
  if (/art|music|design|sound|paint|draw|photo|theat/i.test(text)) return 'musical-notes-outline';
  if (/psy|mind|phil|think|logic|cognit|neuro/i.test(text)) return 'bulb-outline';
  return 'book-outline';
}

// ─── Gamification & XP System ─────────────────────────────────────────────────

export const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, title: 'Novice Scholar', badge: '🥉' },
  { level: 2, minXp: 100, title: 'Apprentice Scholar', badge: '🥈' },
  { level: 3, minXp: 250, title: 'Scholar', badge: '🥇' },
  { level: 4, minXp: 500, title: 'Senior Scholar', badge: '💎' },
  { level: 5, minXp: 1000, title: 'Master Scholar', badge: '👑' },
  { level: 6, minXp: 2000, title: 'Grandmaster Scholar', badge: '🏆' },
];

export function calculateLevel(totalXp: number = 0): LevelInfo {
  const safeXp = typeof totalXp === 'number' && Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  let currentLevel = LEVEL_THRESHOLDS[0];

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (safeXp >= LEVEL_THRESHOLDS[i].minXp) {
      currentLevel = LEVEL_THRESHOLDS[i];
      break;
    }
  }

  const nextLevel = LEVEL_THRESHOLDS.find((t) => t.level === currentLevel.level + 1);

  if (!nextLevel) {
    // Max level achieved
    const levelBase = currentLevel.minXp;
    return {
      level: currentLevel.level,
      title: currentLevel.title,
      badge: currentLevel.badge,
      currentLevelXp: safeXp,
      nextLevelXp: safeXp,
      levelXpEarned: safeXp - levelBase,
      levelXpRequired: 1000,
      progress: 1.0,
      isMaxLevel: true,
    };
  }

  const levelBase = currentLevel.minXp;
  const levelTarget = nextLevel.minXp;
  const levelSpan = levelTarget - levelBase;
  const levelEarned = safeXp - levelBase;
  const progress = Number.isFinite(levelEarned / levelSpan) ? Math.min(1, Math.max(0, levelEarned / levelSpan)) : 0;

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    badge: currentLevel.badge,
    currentLevelXp: safeXp,
    nextLevelXp: levelTarget,
    levelXpEarned: Number.isFinite(levelEarned) ? levelEarned : 0,
    levelXpRequired: levelSpan,
    progress,
    isMaxLevel: false,
  };
}

export function calculateXpGain(options: {
  isReview?: boolean;
  isMastered?: boolean;
  isSessionComplete?: boolean;
  cardsCount?: number;
}): number {
  if (!options) return 0;
  let xp = 0;
  if (options.isReview) xp += 10;
  if (options.isMastered) xp += 25;
  if (options.isSessionComplete) {
    const count = typeof options.cardsCount === 'number' && Number.isFinite(options.cardsCount) ? Math.max(1, options.cardsCount) : 1;
    xp += Math.max(20, Math.min(100, count * 5));
  }
  return xp;
}

export function updateStudyStats(
  currentStats: FlashcardStats | undefined = { lastStudyDate: '', currentStreak: 0, masteredToday: 0 },
  reviewsCount: number = 0,
  masteredCount: number = 0,
  sessionDone: boolean = false,
  sessionTotalCards?: number
): FlashcardStats {
  const safeCurrent = currentStats || { lastStudyDate: '', currentStreak: 0, masteredToday: 0 };
  const safeReviews = typeof reviewsCount === 'number' && Number.isFinite(reviewsCount) ? Math.max(0, Math.floor(reviewsCount)) : 0;
  const safeMastered = typeof masteredCount === 'number' && Number.isFinite(masteredCount) ? Math.max(0, Math.floor(masteredCount)) : 0;
  const safeSessionTotal = typeof sessionTotalCards === 'number' && Number.isFinite(sessionTotalCards) ? Math.max(0, Math.floor(sessionTotalCards)) : undefined;

  const todayStr = getLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  let streak = typeof safeCurrent.currentStreak === 'number' && Number.isFinite(safeCurrent.currentStreak)
    ? Math.max(0, Math.floor(safeCurrent.currentStreak))
    : 0;

  if (safeCurrent.lastStudyDate !== todayStr) {
    streak = safeCurrent.lastStudyDate === yesterdayStr ? streak + 1 : 1;
  } else if (streak === 0) {
    streak = 1;
  }

  const isSameDay = safeCurrent.lastStudyDate === todayStr;
  const baseReviewed = typeof safeCurrent.cardsReviewedToday === 'number' && Number.isFinite(safeCurrent.cardsReviewedToday) ? safeCurrent.cardsReviewedToday : 0;
  const baseMastered = typeof safeCurrent.masteredToday === 'number' && Number.isFinite(safeCurrent.masteredToday) ? safeCurrent.masteredToday : 0;

  const cardsReviewedToday = (isSameDay ? baseReviewed : 0) + safeReviews;
  const masteredToday = (isSameDay ? baseMastered : 0) + safeMastered;

  // Calculate XP gain
  const completionBonus = sessionDone ? Math.max(20, Math.min(100, (safeSessionTotal ?? safeReviews) * 5)) : 0;
  const xpGained = safeReviews * 10 + safeMastered * 25 + completionBonus;

  const baseTotalXp = typeof safeCurrent.totalXp === 'number' && Number.isFinite(safeCurrent.totalXp) ? Math.max(0, Math.floor(safeCurrent.totalXp)) : 0;
  const totalXp = baseTotalXp + xpGained;

  // Update weekly history with 60-day bounded retention
  const rawHistory = Array.isArray(safeCurrent.weeklyHistory) ? safeCurrent.weeklyHistory : [];
  const historySet = new Set(rawHistory.filter((d): d is string => typeof d === 'string' && d.length > 0));
  historySet.add(todayStr);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const cutoffStr = getLocalDateString(sixtyDaysAgo);
  const cleanHistory = Array.from(historySet).filter((d) => d >= cutoffStr).sort();

  return {
    // Carry through fields this function does not own — the review log lives
    // on the same object, and rebuilding it from scratch wiped it every answer.
    ...safeCurrent,
    lastStudyDate: todayStr,
    currentStreak: streak,
    masteredToday,
    cardsReviewedToday,
    totalXp,
    dailyGoal: typeof safeCurrent.dailyGoal === 'number' && Number.isFinite(safeCurrent.dailyGoal) && safeCurrent.dailyGoal > 0 ? safeCurrent.dailyGoal : 20,
    weeklyHistory: cleanHistory,
  };
}

const LOG_DAYS = 120;

/**
 * Adds one answer to the per-day log behind the stats sheet. Only answers to
 * review cards count towards retention — Anki's "true retention" — because a
 * learning card is supposed to be failed while it is being learned.
 */
export function recordAnswer(
  stats: FlashcardStats | undefined,
  entry: { dayKey: string; wasReview: boolean; passed: boolean; ms: number }
): FlashcardStats {
  const base: FlashcardStats = stats || { lastStudyDate: '', currentStreak: 0, masteredToday: 0 };
  const log: Record<string, DayLog> = { ...(base.log || {}) };
  const prev = log[entry.dayKey] || { reviews: 0, passed: 0, matureTried: 0, ms: 0 };
  const ms = Number.isFinite(entry.ms) ? Math.min(Math.max(0, entry.ms), 5 * 60 * 1000) : 0;
  log[entry.dayKey] = {
    reviews: prev.reviews + 1,
    passed: prev.passed + (entry.wasReview && entry.passed ? 1 : 0),
    matureTried: prev.matureTried + (entry.wasReview ? 1 : 0),
    ms: prev.ms + ms,
  };
  const keys = Object.keys(log).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - LOG_DAYS))) delete log[k];
  return { ...base, log };
}

/** Share of review-card answers that were remembered over the last `days` days, or null with no data. */
export function trueRetention(stats: FlashcardStats | undefined, days: number = 30, now: Date = new Date()): number | null {
  const log = stats?.log || {};
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const from = getLocalDateString(cutoff);
  let tried = 0;
  let passed = 0;
  for (const [k, v] of Object.entries(log)) {
    if (k < from || !v) continue;
    tried += v.matureTried || 0;
    passed += v.passed || 0;
  }
  return tried > 0 ? passed / tried : null;
}

export function isStreakLive(
  lastStudyDate?: string,
  todayStr?: string,
  yesterdayStr?: string
): boolean {
  if (!lastStudyDate || typeof lastStudyDate !== 'string' || !lastStudyDate.trim()) {
    return false;
  }
  const cleanDate = lastStudyDate.trim();
  const today = todayStr || getLocalDateString(new Date());
  if (cleanDate === today) return true;
  let yStr = yesterdayStr;
  if (!yStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yStr = getLocalDateString(yesterday);
  }
  return cleanDate === yStr;
}

export function getWeekDaysActivity(
  weeklyHistory: string[] = [],
  lastStudyDate: string = '',
  nowDate: Date = new Date()
): DayActivity[] {
  const days: DayActivity[] = [];
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now = nowDate || new Date();

  // Find Monday of the current week (assuming Monday is start of week)
  const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const rawHistory = Array.isArray(weeklyHistory) ? weeklyHistory : [];
  const historySet = new Set(rawHistory.filter((d): d is string => typeof d === 'string' && d.length > 0));
  if (lastStudyDate && typeof lastStudyDate === 'string') historySet.add(lastStudyDate);

  const todayStr = getLocalDateString(now);

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(dayDate);
    const isToday = dateStr === todayStr;
    const isCompleted = historySet.has(dateStr);

    days.push({
      dayLabel: dayNames[i],
      dateStr,
      isToday,
      isCompleted,
    });
  }

  return days;
}

// ─── File Import Parser ───────────────────────────────────────────────────────

/** Whether the single quote at `open` has an unescaped partner that ends its field. */
function closesField(line: string, open: number): boolean {
  for (let j = open + 1; j < line.length; j++) {
    if (line[j] === "'" && line[j - 1] !== '\\' && /^\s*(,|$)/.test(line.slice(j + 1))) return true;
  }
  return false;
}

export function parseCsvLine(line: string): [string, string] | null {
  if (!line || typeof line !== 'string') return null;
  const tokens: string[] = [];
  let current = '';
  let quoteChar: string | null = null;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const prevChar = i > 0 ? line[i - 1] : '';

    // Double quotes always delimit a field. A single quote only opens one when
    // it has a partner that closes the field (before a comma or the end), so
    // 'Newton's law', '…' still parses while a front like "'tis" or "'90s
    // music" stays literal — it used to open a quote that never closed and the
    // whole line vanished.
    if ((char === '"' || (char === "'" && (quoteChar === "'" || closesField(line, i)))) && prevChar !== '\\') {
      if (!quoteChar && current.trim() === '') {
        quoteChar = char;
        continue;
      } else if (quoteChar === char) {
        // Check for RFC 4180 escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === char) {
          current += char;
          i++; // Skip the second quote
          continue;
        }
        quoteChar = null;
        continue;
      }
    }

    if (char === ',' && !quoteChar) {
      tokens.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }
  tokens.push(current.trim());

  if (tokens.length >= 2 && (tokens[0] || tokens[1])) {
    const validRest = tokens.slice(1).filter((t) => t.length > 0);
    if (validRest.length > 0) {
      return [tokens[0], validRest.join(', ')];
    }
  }
  return null;
}

export function parseImport(
  content: string,
  separator: 'comma' | 'pipe' | 'tab' | 'semicolon' | 'auto' = 'auto'
): { front: string; back: string }[] {
  if (!content || typeof content !== 'string') return [];
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const cards: { front: string; back: string }[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue;
    let front = '',
      back = '';

    if (separator === 'tab' || (separator === 'auto' && line.includes('\t'))) {
      // Front is column 1, back is the first non-empty column after it. Any
      // further columns (Anki's tags, a spreadsheet's notes) are dropped rather
      // than glued onto the back with invisible tabs.
      const [f, ...rest] = line.split('\t');
      front = f?.trim() || '';
      back = (rest.find((t) => t.trim().length > 0) || '').trim();
    } else if (separator === 'pipe' || (separator === 'auto' && line.includes('|'))) {
      const [f, ...rest] = line.split('|');
      front = f ? f.trim().replace(/^Q:\s*/i, '').trim() : '';
      back = rest.length > 0 ? rest.filter((t) => t.trim().length > 0).join('|').trim().replace(/^A:\s*/i, '').trim() : '';
    } else if (separator === 'semicolon' || (separator === 'auto' && line.includes(';'))) {
      const [f, ...rest] = line.split(';');
      front = f?.trim() || '';
      back = rest.filter((t) => t.trim().length > 0).join('; ').trim();
    } else if (separator === 'comma' || (separator === 'auto' && line.includes(','))) {
      const parsedCsv = parseCsvLine(line);
      if (parsedCsv) {
        front = parsedCsv[0];
        back = parsedCsv[1];
      }
    }

    if (front && back) cards.push({ front, back });
  }

  return cards;
}

/**
 * The import parser, note-aware: a line with `{{c1::…}}` in it becomes a cloze
 * note on its own (no separator needed), and every other line becomes a note
 * of `kind` from its front and back.
 */
export function parseImportNotes(
  content: string,
  separator: 'comma' | 'pipe' | 'tab' | 'semicolon' | 'auto' = 'auto',
  kind: 'basic' | 'reversed' | 'typein' = 'basic'
): { kind: 'basic' | 'reversed' | 'typein' | 'cloze'; front: string; back: string }[] {
  if (!content || typeof content !== 'string') return [];
  const out: { kind: 'basic' | 'reversed' | 'typein' | 'cloze'; front: string; back: string }[] = [];
  const rest: string[] = [];
  for (const raw of content.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (/\{\{c\d+::/.test(line) && clozeNumbers(line).length > 0) out.push({ kind: 'cloze', front: line, back: '' });
    else rest.push(line);
  }
  for (const c of parseImport(rest.join('\n'), separator)) out.push({ kind, front: c.front, back: c.back });
  return out;
}

export type ImportSeparator = 'comma' | 'pipe' | 'tab' | 'semicolon' | 'auto';

const SEPARATOR_CHARS: Record<Exclude<ImportSeparator, 'auto'>, string> = { comma: ',', semicolon: ';', pipe: '|', tab: '\t' };

/**
 * A cloze line's text and its Extra (shown with the answer). Cloze sentences
 * are full of commas, so splitting on the first comma would cut them in half:
 *   - tab, | and ; start the Extra at the first one after the last `}}`, so a
 *     separator inside the sentence before the blanks is left alone. Tab is
 *     what Anki's plain-text export and a two-column spreadsheet paste give.
 *   - a comma only splits when the sentence is double-quoted, the way a
 *     spreadsheet's CSV export writes a cell. An unquoted comma line stays
 *     one sentence, exactly as before Extra was supported.
 */
export function splitClozeLine(line: string, separator: ImportSeparator = 'auto'): { text: string; extra: string } {
  const whole = { text: line.trim(), extra: '' };
  const lastClose = line.lastIndexOf('}}');
  const order: Exclude<ImportSeparator, 'auto'>[] = separator === 'auto' ? ['tab', 'pipe', 'semicolon', 'comma'] : [separator];
  for (const sep of order) {
    if (sep === 'comma') {
      if (!line.trim().startsWith('"')) continue;
      const parsed = parseCsvLine(line.trim());
      if (parsed && /\{\{c\d+::/.test(parsed[0])) return { text: parsed[0].trim(), extra: parsed[1].trim() };
      continue;
    }
    const ch = SEPARATOR_CHARS[sep];
    const at = lastClose >= 0 ? line.indexOf(ch, lastClose + 2) : -1;
    if (at >= 0) {
      const text = line.slice(0, at).trim();
      const extra = line.slice(at + 1).trim();
      if (text) return { text, extra };
    }
  }
  return whole;
}

export interface ImportAnalysis {
  notes: { kind: 'basic' | 'reversed' | 'typein' | 'cloze'; front: string; back: string }[];
  /** Cards the notes will make: two per Both ways note, one per distinct cloze number. */
  cardCount: number;
  /** Lines that could not become a card, with the 1-based line number and why. */
  skipped: { line: number; text: string; reason: string }[];
  /** Notes left out because the deck (or an earlier line) already has them. */
  duplicates: number;
  /** A "Front, Back" style header row was recognised and left out. */
  headerSkipped: boolean;
}

const HEADER_FRONT = /^(front|question|term|word|q|prompt)$/i;
const HEADER_BACK = /^(back|answer|definition|meaning|a|response)$/i;
const importKey = (front: string, back: string) =>
  `${front.trim().toLowerCase().replace(/\s+/g, ' ')}\u0000${back.trim().toLowerCase().replace(/\s+/g, ' ')}`;

/**
 * Everything the import sheet shows, from the raw text: the notes to add and
 * an account of every line that will not become one. The old flow parsed
 * silently — a line without a separator, a header row or a card already in
 * the deck either vanished or was imported, and the student never knew.
 */
export function analyzeImport(
  content: string,
  separator: ImportSeparator = 'auto',
  kind: 'basic' | 'reversed' | 'typein' = 'basic',
  existing: { front?: string; back?: string }[] = []
): ImportAnalysis {
  const result: ImportAnalysis = { notes: [], cardCount: 0, skipped: [], duplicates: 0, headerSkipped: false };
  if (!content || typeof content !== 'string') return result;

  const seen = new Set(existing.map((c) => importKey(c?.front || '', c?.back || '')));
  const lines = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  let firstData = true;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const lineNo = i + 1;

    let note: ImportAnalysis['notes'][number] | null = null;
    if (/\{\{c\d+::/.test(line) && clozeNumbers(line).length > 0) {
      const { text, extra } = splitClozeLine(line, separator);
      note = { kind: 'cloze', front: text, back: extra };
    } else {
      const parsed = parseImport(line, separator)[0];
      if (parsed) {
        if (firstData && HEADER_FRONT.test(parsed.front) && HEADER_BACK.test(parsed.back)) {
          result.headerSkipped = true;
          firstData = false;
          return;
        }
        note = { kind, front: parsed.front, back: parsed.back };
      } else {
        const hasSep = separator === 'auto'
          ? /[\t|;,]/.test(line)
          : line.includes(SEPARATOR_CHARS[separator]);
        result.skipped.push({
          line: lineNo,
          text: line,
          reason: hasSep ? 'The front or the back is empty' : separator === 'auto' ? 'No separator between front and back' : `No ${separator === 'tab' ? 'tab' : `"${SEPARATOR_CHARS[separator]}"`} on this line`,
        });
      }
    }
    firstData = false;
    if (!note) return;

    const key = importKey(note.front, note.back);
    if (seen.has(key)) {
      result.duplicates++;
      return;
    }
    seen.add(key);
    result.notes.push(note);
    result.cardCount += note.kind === 'reversed' ? 2 : note.kind === 'cloze' ? Math.max(1, new Set(clozeNumbers(note.front)).size) : 1;
  });

  return result;
}

// ─── Exam Prep Scheduling Algorithm (Cepeda et al. 2008) ──────────────────────

export function computeExamPlan(
  daysUntilExam: number,
  totalCards: number,
  overrideReviews: number = 0
): { plan: ExamScheduleSlot[]; numReviews: number } {
  const safeDays = typeof daysUntilExam === 'number' && Number.isFinite(daysUntilExam) ? Math.max(0, daysUntilExam) : 0;
  const safeTotalCards = typeof totalCards === 'number' && Number.isFinite(totalCards) ? Math.max(0, Math.floor(totalCards)) : 0;
  const safeOverride = typeof overrideReviews === 'number' && Number.isFinite(overrideReviews) ? Math.max(0, Math.floor(overrideReviews)) : 0;

  let numReviews: number;
  if (safeDays <= 1) numReviews = 4; // cram mode: 4 sessions today
  else if (safeDays <= 3) numReviews = 3;
  else if (safeDays <= 7) numReviews = 4;
  else if (safeDays <= 14) numReviews = 5;
  else if (safeDays <= 30) numReviews = 6;
  else numReviews = 7;

  if (safeOverride > 0) numReviews = safeOverride;
  numReviews = Math.max(1, numReviews);

  const intervals: number[] = [];
  if (safeDays <= 1) {
    const cramGaps = [0, 0.014, 0.042, 0.125]; // fractions of a day
    for (let i = 0; i < numReviews; i++) {
      if (i < cramGaps.length) {
        intervals.push(cramGaps[i]);
      } else {
        intervals.push(0.125 + (i - 3) * 0.08);
      }
    }
  } else {
    const maxSpan = Math.max(0.5, safeDays);
    const optimalFirstGap = Math.max(0.2, safeDays * 0.12);
    let currentGap = optimalFirstGap;
    let dayOffset = 0;
    for (let i = 0; i < numReviews; i++) {
      intervals.push(Math.round(dayOffset * 100) / 100);
      const remainingReviews = numReviews - 1 - i;
      if (remainingReviews > 0) {
        const remainingSpan = Math.max(0.1, maxSpan - dayOffset);
        const minStep = remainingSpan / (remainingReviews + 1);
        dayOffset += Math.max(minStep * 0.5, Math.min(remainingSpan - (remainingReviews - 1) * 0.05, currentGap));
        currentGap *= 1.4;
      }
    }
  }

  const now = new Date();
  const plan: ExamScheduleSlot[] = intervals.map((dayOff, i) => {
    const reviewDate = new Date(now.getTime() + dayOff * 24 * 60 * 60 * 1000);
    const isToday = dayOff < 1;
    const label = isToday
      ? i === 0
        ? 'Now'
        : `+${Math.round(dayOff * 24)}h`
      : reviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { day: Math.round(dayOff * 10) / 10, label, cardsPerSession: safeTotalCards };
  });

  return { plan, numReviews };
}

