// ─── Study / Flashcards Types & Interfaces ───────────────────────────────────

/**
 * How a note turns into cards, after Anki's built-in note types. Basic makes
 * one card; Reversed makes a card each way; Cloze makes one card per `{{cN::}}`
 * number; Type-in is Basic with the answer typed and checked.
 */
export type NoteKind = 'basic' | 'reversed' | 'cloze' | 'typein';

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type Rating = 1 | 2 | 3 | 4;

/**
 * One schedulable card. Cards made before note types existed have none of the
 * optional fields and behave exactly as before: a Basic note of one card.
 *
 * There is no separate notes array. A note's fields live on every one of its
 * cards (`front`/`back`, which for Cloze are the text and the Extra field), and
 * siblings are found by `noteId`. That keeps the ledger shape an older build
 * can still read — it sees ordinary cards — at the cost of a few duplicated
 * strings.
 */
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  interval: number;
  /** SM-2 ease. No longer drives scheduling; kept so older builds still read the card. */
  easeFactor: number;
  nextDue: number;
  reviewCount: number;
  stepIndex?: number;

  noteId?: string;
  kind?: NoteKind;
  /** Reversed: 0 front→back, 1 back→front. Cloze: the cloze number. */
  ord?: number;
  tags?: string[];
  createdAt?: number;

  // FSRS memory state
  state?: CardState;
  stability?: number;
  difficulty?: number;
  step?: number;
  lastReview?: number;
  lapses?: number;
  /** Study day (`YYYY-MM-DD`) the card was first answered. */
  introducedOn?: string;

  suspended?: boolean;
  /** Hidden from queues until this study day begins. */
  buriedUntil?: string;
  flagged?: boolean;
  /** Forgotten `LEECH_THRESHOLD` times — worth rewriting. */
  leech?: boolean;
}

/** Per-deck daily counters behind the new-card and review limits. */
export interface DeckDaily {
  date: string;
  newDone: number;
  reviewDone: number;
  /** Extra new cards granted today through Custom study. */
  newBonus: number;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  subject: string;
  color: string;
  icon?: string;
  coverStyle?: string;
  createdAt: number;
  cards: Flashcard[];
  daily?: DeckDaily;
  /** `YYYY-MM-DD` while the deck is in exam mode. */
  examDate?: string;
}

export interface SessionCard extends Flashcard {
  deckId: string;
}

export interface DeckNode {
  name: string;
  fullPath: string;
  deck: FlashcardDeck | null;
  children: Map<string, DeckNode>;
}

export interface NodeStats {
  new: number;
  learning: number;
  due: number;
  total: number;
  mastered: number;
}

export interface SRSettings {
  learningSteps: string;
  /** Steps, in minutes, a forgotten review card walks before it returns. */
  relearningSteps?: string;
  /** Unused since FSRS; kept so settings saved by older builds round-trip. */
  graduatingInterval: number;
  easyInterval: number;
  /** Probability of remembering a card when it comes due. FSRS's one real knob. */
  desiredRetention?: number;
  /** New cards each deck introduces per day. */
  newPerDay?: number;
  /** Review cards each deck shows per day. */
  reviewsPerDay?: number;
  maximumInterval?: number;
  studyTimeHour: number;
  studyTimeMinute: number;
}

/** One study day in the review log. */
export interface DayLog {
  /** Cards answered. */
  reviews: number;
  /** Review-card answers that were not Again — the basis of true retention. */
  passed: number;
  /** Review-card answers in total. */
  matureTried: number;
  /** Time spent answering, in ms. */
  ms: number;
}

export interface FlashcardStats {
  lastStudyDate: string;
  currentStreak: number;
  masteredToday: number;
  totalXp?: number;
  dailyGoal?: number;
  cardsReviewedToday?: number;
  weeklyHistory?: string[]; // Array of 'YYYY-MM-DD' dates
  /** Per-day review log keyed by study day, bounded to ~120 days. */
  log?: Record<string, DayLog>;
}

export interface LevelInfo {
  level: number;
  title: string;
  badge: string;
  currentLevelXp: number;
  nextLevelXp: number;
  levelXpEarned: number;
  levelXpRequired: number;
  progress: number; // 0 to 1
  isMaxLevel?: boolean;
}

export interface DayActivity {
  dayLabel: string;
  dateStr: string;
  isToday: boolean;
  isCompleted: boolean;
}

export interface QuizQuestion {
  cardId: string;
  question: string;
  correctAnswer: string;
  options: string[];
}

export interface MatchCard {
  id: string;
  pairId: string;
  text: string;
  isTerm: boolean;
}

export interface ExamScheduleSlot {
  day: number;
  label: string;
  cardsPerSession: number;
}

// 'manage' was folded into 'detail' — the two were the same card list with
// different halves of the features. Do not reintroduce it.
export type StudyViewMode = 'decks' | 'detail' | 'study' | 'quiz' | 'match';

/** A run of text on a card face. `blank` is a hidden cloze, `hl` a revealed one. */
export interface FaceSegment {
  text: string;
  style: 'plain' | 'blank' | 'hl';
}
