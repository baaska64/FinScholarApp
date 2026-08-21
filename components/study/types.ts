// ─── Study / Flashcards Types & Interfaces ───────────────────────────────────

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  interval: number;
  easeFactor: number;
  nextDue: number;
  reviewCount: number;
  stepIndex?: number;
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
  graduatingInterval: number;
  easyInterval: number;
  studyTimeHour: number;
  studyTimeMinute: number;
}

export interface FlashcardStats {
  lastStudyDate: string;
  currentStreak: number;
  masteredToday: number;
  totalXp?: number;
  dailyGoal?: number;
  cardsReviewedToday?: number;
  weeklyHistory?: string[]; // Array of 'YYYY-MM-DD' dates
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

export type StudyViewMode = 'decks' | 'detail' | 'study' | 'manage' | 'quiz' | 'match';
