import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Image,
  Share,
  PixelRatio,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useFocusEffect, router } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SyncService } from '@/services/SyncService';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, getTints, getBrand, Radius } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import ProgressBar from '@/components/ui/ProgressBar';
import Card from '@/components/ui/Card';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import SectionHeader from '@/components/ui/SectionHeader';
import HeroBackdrop from '@/components/dashboard/HeroBackdrop';
import GoalRing from '@/components/study/GoalRing';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';
import { useScreenTour } from '@/components/spotlight/useScreenTour';
import { SPOTLIGHT_IDS, TOUR_KEYS, STUDY_TOUR } from '@/constants/tours';
import { useTabBarHeight } from '@/components/CustomTabBar';
import { triggerHaptic } from '@/components/tasks/utils';

import {
  Flashcard,
  FlashcardDeck,
  SessionCard,
  DeckNode,
  NodeStats,
  SRSettings,
  FlashcardStats,
  QuizQuestion,
  MatchCard,
  StudyViewMode,
  NoteKind,
  Rating,
} from '@/components/study/types';
import {
  DEFAULT_SR_SETTINGS,
  DECK_COLORS,
  DECK_ICONS,
  generateId,
  buildDeckTree,
  getNodeStats,
  collectCards,
  collectDecksFromNode,
  getDeckThematicIcon,
  updateStudyStats,
  recordAnswer,
  trueRetention,
  isStreakLive,
  getLocalDateString,
  analyzeImport,
  ImportSeparator,
  // scheduler
  answerCard,
  AnswerResult,
  buildQueue,
  pickNext,
  sessionRemaining,
  burySiblings,
  unburySiblings,
  resolveSettings,
  bumpDaily,
  cardState,
  deckDueCounts,
  sumCounts,
  DueCounts,
  QueueRef,
  SessionMode,
  studyDayKey,
  studyDayStart,
  previewIntervals,
  examDaysLeft,
  planExamReschedule,
  examPullCount,
  composition,
  retrievability,
  formatInterval,
  noteIdOf,
  isSidelined,
  // notes
  NoteDraft,
  NoteRow,
  buildNoteCards,
  replaceNote,
  groupNotes,
  cardFaces,
  cardQA,
  clozeOverview,
  clozePlain,
  kindOf,
  kindLabel,
  NOTE_KINDS,
  SAMPLE_NOTES,
  notePreview,
} from '@/components/study';
import { queueTints, queueOnBand } from '@/components/study/studyTheme';
import DeckList from '@/components/study/DeckList';
import ReviewCard from '@/components/study/ReviewCard';
import AnswerBar from '@/components/study/AnswerBar';
import NoteEditorSheet from '@/components/study/NoteEditorSheet';
import StatsSheet from '@/components/study/StatsSheet';
import FaceText from '@/components/study/FaceText';
import OcclusionImage from '@/components/study/OcclusionImage';
import { maskStates } from '@/components/study/occlusion';
import { deleteImage } from '@/components/study/imageStore';

export { Flashcard, FlashcardDeck, SessionCard, DeckNode, NodeStats, SRSettings, FlashcardStats };
export { buildDeckTree, getNodeStats, collectCards, DEFAULT_SR_SETTINGS };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FONT_SCALE = PixelRatio.getFontScale();

/** Page gutter, matched to the dashboard and schedule tabs. */
const GUTTER = 14;
/**
 * How far the page sheet is pulled up over the brand band. The dashboard
 * floats a stat card on a domed band; the study tab instead ends its band
 * flat and slides the whole page over it, so the two headers share a colour
 * without sharing a silhouette.
 */
const SHEET_LIFT = 26;

type DetailFilter = 'all' | 'new' | 'learning' | 'due' | 'suspended' | 'flagged' | 'leech';
type PracticeAction = 'quiz' | 'match' | 'exam' | 'custom';

/**
 * A running review. New and review cards are fixed in `queue` when it starts;
 * learning cards are picked live, because their due times move with every
 * answer — the reason this is not the flat shuffled array it used to be, where
 * a card failed twice sat in the list twice and "card 7 of 20" was a lie.
 */
interface Session {
  deckIds: string[] | null;
  title: string;
  color: string | null;
  mode: SessionMode;
  queue: QueueRef[];
  pos: number;
  current: QueueRef | null;
  answered: number;
  again: number;
  graduated: number;
  startedAt: number;
  shownAt: number;
  flip: boolean;
  done: boolean;
  nextLearningAt: number | null;
  xpBefore: number;
  returnTo: 'decks' | 'detail';
}

interface UndoSnap {
  decks: FlashcardDeck[];
  stats: FlashcardStats;
  session: Session;
}

function findNode(nodes: DeckNode[], path: string): DeckNode | null {
  for (const n of nodes) {
    if (n.fullPath === path) return n;
    const f = findNode(Array.from(n.children.values()), path);
    if (f) return f;
  }
  return null;
}

function allNodes(nodes: DeckNode[], depth = 0, out: { node: DeckNode; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ node: n, depth });
    allNodes(Array.from(n.children.values()), depth + 1, out);
  }
  return out;
}

function relativeDue(ts: number, now: number): string {
  const diff = ts - now;
  if (diff <= 0) return 'now';
  if (diff < 60 * 60 * 1000) return `in ${Math.max(1, Math.round(diff / 60000))} min`;
  if (ts < studyDayStart(now, 1)) return `in ${Math.round(diff / 3600000)}h`;
  if (ts < studyDayStart(now, 2)) return 'tomorrow';
  const days = Math.round((studyDayStart(ts) - studyDayStart(now)) / 86400000);
  return `in ${days} days`;
}

const shuffle = <T,>(a: T[]) => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FlashcardsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const brand = getBrand(isDark);
  const qt = queueTints(isDark);
  const insets = useSafeAreaInsets();
  // The tab bar floats over the screen, so every view here reserves its height.
  const tabBarHeight = useTabBarHeight();
  const { selectedYear, selectedSemester } = useSemesterContext();
  const [currentSubjects, setCurrentSubjects] = useState<any[]>([]);

  // ── Data
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const decksRef = useRef<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [srSettings, setSrSettings] = useState<SRSettings>(DEFAULT_SR_SETTINGS);
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStats>({
    lastStudyDate: '',
    currentStreak: 0,
    masteredToday: 0,
    totalXp: 0,
    dailyGoal: 20,
    cardsReviewedToday: 0,
    weeklyHistory: [],
  });
  const statsRef = useRef<FlashcardStats>(flashcardStats);
  const [clock, setClock] = useState(Date.now());

  // ── Routing
  const [view, setView] = useState<StudyViewMode>('decks');
  const [activePath, setActivePath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  /** Measured height of the home band; its height follows its content, so the backdrop is sized to it. */
  const [bandH, setBandH] = useState(0);

  // First visit only: point at the create button, once the deck list is up.
  useScreenTour(TOUR_KEYS.study, STUDY_TOUR, !loading && view === 'decks');

  // ── Deck screen
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilter, setDetailFilter] = useState<DetailFilter>('all');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());

  // ── Review
  const [session, setSession] = useState<Session | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [undo, setUndo] = useState<UndoSnap | null>(null);
  const ratingRef = useRef(false);

  // ── Practice test
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [quizMissed, setQuizMissed] = useState<QuizQuestion[]>([]);
  const [practicePath, setPracticePath] = useState<string | null>(null);

  // ── Speed match
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [matchRevealed, setMatchRevealed] = useState<string[]>([]);
  const [matchMatched, setMatchMatched] = useState<Set<string>>(new Set());
  const [matchMoves, setMatchMoves] = useState(0);
  const [matchStartTime, setMatchStartTime] = useState(0);
  const [matchDone, setMatchDone] = useState(false);
  const [matchElapsed, setMatchElapsed] = useState(0);

  // ── Sheets
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  // Deck actions. This replaced an eleven-button AlertService.alert — the
  // CustomAlert stacks >2 buttons vertically with no scroll, so on a normal
  // phone Export / Reset / Delete rendered below the bottom of the screen.
  const [actionPath, setActionPath] = useState<string | null>(null);
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [deckForm, setDeckForm] = useState({ name: '', subject: '', color: DECK_COLORS[0], icon: 'book-outline' });
  const [noteEditor, setNoteEditor] = useState<{ visible: boolean; deckId: string | null; note: NoteRow | null }>({
    visible: false,
    deckId: null,
    note: null,
  });
  const [lastKind, setLastKind] = useState<NoteKind>('basic');
  const [lastDeckId, setLastDeckId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importDeckId, setImportDeckId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importSeparator, setImportSeparator] = useState<ImportSeparator>('auto');
  const [importKind, setImportKind] = useState<'basic' | 'reversed' | 'typein'>('basic');
  const [importFileName, setImportFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [examPath, setExamPath] = useState<string | null>(null);
  const [examDate, setExamDate] = useState(new Date(Date.now() + 7 * 86400000));
  const [examShowPicker, setExamShowPicker] = useState(false);
  const [movingDeckId, setMovingDeckId] = useState<string | null>(null);
  const [moveTargetPath, setMoveTargetPath] = useState('');
  const [customPath, setCustomPath] = useState<string | null | undefined>(undefined);
  const [showStats, setShowStats] = useState(false);
  const [showReviewMore, setShowReviewMore] = useState(false);
  const [pickerAction, setPickerAction] = useState<PracticeAction | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Data loading & saving
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Writes still in flight. `pushLocalChanges` fires the data-change listener
   * on every save, and that listener reloads from storage — so without this a
   * reload triggered by answer N could land after answer N+1 was made and
   * quietly put the deck back the way it was before N+1.
   */
  const pendingWrites = useRef(0);
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  const loadDecks = useCallback(async () => {
    if (pendingWrites.current > 0) return;
    try {
      const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
      if (raw) {
        const ledger = JSON.parse(raw);
        const list: FlashcardDeck[] = Array.isArray(ledger.flashcards?.decks) ? ledger.flashcards.decks : [];
        decksRef.current = list;
        setDecks(list);
        if (ledger.flashcards?.settings) setSrSettings({ ...DEFAULT_SR_SETTINGS, ...ledger.flashcards.settings });
        if (ledger.flashcards?.stats) {
          setFlashcardStats(ledger.flashcards.stats);
          statsRef.current = ledger.flashcards.stats;
        }
        if (selectedYear && selectedSemester) {
          const year = ledger.years?.find((y: any) => y.id === selectedYear);
          const sem = year?.semesters?.find((s: any) => s.id === selectedSemester);
          setCurrentSubjects(sem?.subjects || []);
        } else {
          setCurrentSubjects([]);
        }
      } else {
        decksRef.current = [];
        setDecks([]);
        setCurrentSubjects([]);
      }
    } catch (e) {
      console.error('Failed to load flashcards:', e);
    } finally {
      setLoading(false);
      setClock(Date.now());
    }
  }, [selectedYear, selectedSemester]);

  /**
   * Updates state at once and writes in the background, one write at a time,
   * so the review never waits on storage (or on the widget re-render every
   * save triggers) between cards.
   */
  const persist = useCallback((nextDecks?: FlashcardDeck[] | null, nextStats?: FlashcardStats | null) => {
    if (nextDecks) {
      decksRef.current = nextDecks;
      setDecks(nextDecks);
    }
    if (nextStats) {
      statsRef.current = nextStats;
      setFlashcardStats(nextStats);
    }
    setClock(Date.now());
    pendingWrites.current += 1;
    writeChain.current = writeChain.current
      .then(async () => {
        const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
        const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
        ledger.flashcards = {
          ...(ledger.flashcards || {}),
          decks: decksRef.current,
          settings: ledger.flashcards?.settings || srSettings,
          stats: statsRef.current,
        };
        await SyncService.pushLocalChanges(ledger);
      })
      .catch((e) => console.error('Failed to save flashcards:', e))
      .finally(() => {
        pendingWrites.current = Math.max(0, pendingWrites.current - 1);
      });
  }, [srSettings]);

  /**
   * Deletes stored pictures that a change left unreferenced. Called only from
   * the destructive handlers (delete note, bulk delete, delete deck, a note
   * saved with a replaced picture) — never from `persist`, which also runs on
   * every answer and whose undo snapshot could bring a note back.
   */
  const releaseImages = (before: FlashcardDeck[], after: FlashcardDeck[]) => {
    const ids = (list: FlashcardDeck[]) => new Set(list.flatMap((d) => (d?.cards || []).map((c) => c?.occlusion?.imageId).filter(Boolean) as string[]));
    const kept = ids(after);
    ids(before).forEach((id) => {
      if (!kept.has(id)) deleteImage(id);
    });
  };

  useFocusEffect(
    useCallback(() => {
      loadDecks();
    }, [loadDecks])
  );

  useEffect(() => {
    const unsub = SyncService.subscribeDataChange(() => {
      loadDecks();
    });
    return () => unsub();
  }, [loadDecks]);

  // Counts depend on the clock: learning cards and reviews come due on their own.
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // The band is azure, so the status bar icons go light while it is showing.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(view === 'decks' ? 'light' : isDark ? 'light' : 'dark', true);
      return () => setStatusBarStyle(isDark ? 'light' : 'dark', true);
    }, [isDark, view])
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────

  const tree = useMemo(() => buildDeckTree(decks), [decks]);

  const { countsByPath, totalByPath } = useMemo(() => {
    const counts = new Map<string, DueCounts>();
    const totals = new Map<string, number>();
    const walk = (n: DeckNode): [DueCounts, number] => {
      let c: DueCounts = n.deck ? deckDueCounts(n.deck, srSettings, clock) : { new: 0, learn: 0, review: 0 };
      let t = n.deck?.cards?.length || 0;
      for (const child of n.children.values()) {
        const [cc, ct] = walk(child);
        c = sumCounts([c, cc]);
        t += ct;
      }
      counts.set(n.fullPath, c);
      totals.set(n.fullPath, t);
      return [c, t];
    };
    tree.forEach(walk);
    return { countsByPath: counts, totalByPath: totals };
  }, [tree, srSettings, clock]);

  const zero: DueCounts = { new: 0, learn: 0, review: 0 };
  const countsFor = (n: DeckNode) => countsByPath.get(n.fullPath) || zero;
  const totalFor = (n: DeckNode) => totalByPath.get(n.fullPath) || 0;
  const allCounts = sumCounts(tree.map(countsFor));
  const allDue = allCounts.new + allCounts.learn + allCounts.review;
  const totalCards = decks.reduce((s, d) => s + (Array.isArray(d?.cards) ? d.cards.length : 0), 0);

  const activeNode = activePath ? findNode(tree, activePath) : null;
  const deckById = (id: string | null | undefined) => decksRef.current.find((d) => d && d.id === id) || null;

  const examLabelFor = (n: DeckNode) => {
    const list = collectDecksFromNode(n);
    let best: number | null = null;
    for (const d of list) {
      const left = examDaysLeft(d, clock);
      if (left !== null && (best === null || left < best)) best = left;
    }
    if (best === null) return null;
    return best === 0 ? 'Exam today' : `Exam in ${best}d`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Decks
  // ─────────────────────────────────────────────────────────────────────────

  const openNode = (n: DeckNode) => {
    setActivePath(n.fullPath);
    setDetailSearch('');
    setDetailFilter('all');
    setIsSelectionMode(false);
    setSelectedNotes(new Set());
    setView('detail');
  };

  const toggleNode = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openAddDeck = (prefillName?: string) => {
    setEditingDeckId(null);
    setDeckForm({ name: prefillName || '', subject: '', color: DECK_COLORS[0], icon: 'book-outline' });
    setShowCreateSheet(false);
    setShowDeckForm(true);
  };

  const openEditDeck = (deck: FlashcardDeck) => {
    setEditingDeckId(deck.id);
    setDeckForm({
      name: deck.name,
      subject: deck.subject,
      color: deck.color,
      icon: deck.icon || getDeckThematicIcon(deck.subject, deck.name),
    });
    setShowDeckForm(true);
  };

  const handleSaveDeck = () => {
    if (!deckForm.name.trim()) {
      AlertService.alert('Missing Name', 'Please enter a deck name.');
      return;
    }
    const d = decksRef.current;
    let nd: FlashcardDeck[];
    if (editingDeckId) {
      nd = d.map((x) =>
        x.id === editingDeckId
          ? { ...x, name: deckForm.name.trim(), subject: deckForm.subject.trim(), color: deckForm.color, icon: deckForm.icon }
          : x
      );
    } else {
      nd = [
        ...d,
        {
          id: generateId(),
          name: deckForm.name.trim(),
          subject: deckForm.subject.trim(),
          color: deckForm.color,
          icon: deckForm.icon,
          createdAt: Date.now(),
          cards: [],
        },
      ];
    }
    persist(nd);
    setShowDeckForm(false);
    setEditingDeckId(null);
  };

  const addSampleDeck = () => {
    const now = Date.now();
    let cards: Flashcard[] = [];
    SAMPLE_NOTES.forEach((draft, i) => {
      cards = cards.concat(buildNoteCards(draft, [], generateId, now + i));
    });
    const deck: FlashcardDeck = {
      id: generateId(),
      name: 'Getting started',
      subject: '',
      color: DECK_COLORS[1],
      icon: 'sparkles-outline',
      createdAt: now,
      cards,
    };
    persist([...decksRef.current, deck]);
    triggerHaptic('success');
  };

  const handleDeleteNode = (node: DeckNode) => {
    const list = collectDecksFromNode(node);
    const cardCount = list.reduce((s, d) => s + (d?.cards?.length || 0), 0);
    const isDeck = node.deck && node.children.size === 0;
    AlertService.alert(
      isDeck ? 'Delete deck' : 'Delete folder',
      isDeck
        ? `Delete "${node.name}" and its ${cardCount} card${cardCount !== 1 ? 's' : ''}?`
        : `Delete "${node.name}" including ${list.length} deck(s) and ${cardCount} cards?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const ids = new Set(list.map((d) => d.id));
            const before = decksRef.current;
            const after = before.filter((d) => !ids.has(d.id));
            persist(after);
            releaseImages(before, after);
            if (activePath && activePath.startsWith(node.fullPath)) {
              setActivePath(null);
              setView('decks');
            }
          },
        },
      ]
    );
  };

  const handleResetProgress = (node: DeckNode) => {
    AlertService.alert('Reset progress', `Forget all learning progress for "${node.name}"? The cards stay; they start over as new.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          const ids = new Set(collectDecksFromNode(node).map((d) => d.id));
          const now = Date.now();
          persist(
            decksRef.current.map((d) =>
              ids.has(d.id)
                ? {
                    ...d,
                    daily: undefined,
                    cards: (d.cards || []).map((c) => {
                      const {
                        stability: _s,
                        difficulty: _d,
                        lastReview: _l,
                        introducedOn: _i,
                        buriedUntil: _b,
                        buriedReason: _br,
                        leech: _le,
                        ...rest
                      } = c;
                      return { ...rest, state: 'new', interval: 0, easeFactor: 2.5, nextDue: now, reviewCount: 0, step: 0, stepIndex: 0, lapses: 0 };
                    }),
                  }
                : d
            )
          );
        },
      },
    ]);
  };

  const openAddSubNode = (node: DeckNode) => {
    setEditingDeckId(null);
    setDeckForm({ name: node.fullPath + '::', subject: '', color: node.deck?.color || DECK_COLORS[0], icon: 'book-outline' });
    setShowDeckForm(true);
  };

  const handleDuplicateDeck = (deck: FlashcardDeck) => {
    const noteMap = new Map<string, string>();
    const copy: FlashcardDeck = {
      ...deck,
      id: generateId(),
      name: deck.name + ' (copy)',
      createdAt: Date.now(),
      daily: undefined,
      examDate: undefined,
      cards: (deck.cards || []).map((c) => {
        const oldNote = noteIdOf(c);
        if (!noteMap.has(oldNote)) noteMap.set(oldNote, generateId());
        return { ...c, id: generateId(), noteId: noteMap.get(oldNote) };
      }),
    };
    persist([...decksRef.current, copy]);
    AlertService.alert('Duplicated', `Created "${copy.name}" with ${copy.cards.length} cards.`);
  };

  const handleMoveDeck = (node: DeckNode) => {
    if (!node.deck) return;
    setMovingDeckId(node.deck.id);
    const parts = node.fullPath.split('::');
    parts.pop();
    setMoveTargetPath(parts.length > 0 ? parts.join('::') + '::' : '');
  };

  const confirmMoveDeck = () => {
    const deck = deckById(movingDeckId);
    if (!deck) {
      setMovingDeckId(null);
      return;
    }
    const node = allNodes(tree).find((x) => x.node.deck?.id === deck.id)?.node;
    const lastSegment = node?.name || deck.name.split('::').pop() || deck.name;
    const target = moveTargetPath.trim();
    const parts = (target ? target + lastSegment : lastSegment).split('::').filter(Boolean);
    const newName = parts[parts.length - 1] || lastSegment;
    const newSubject = parts.length > 1 ? parts.slice(0, -1).join('::') : '';
    const nd = decksRef.current.map((d) => (d.id === deck.id ? { ...d, name: newName, subject: newSubject } : d));
    persist(nd);
    setMovingDeckId(null);
    const moved = allNodes(buildDeckTree(nd)).find((x) => x.node.deck?.id === deck.id)?.node;
    if (moved && view === 'detail') setActivePath(moved.fullPath);
  };

  const handleExportDeck = async (node: DeckNode) => {
    const list = collectDecksFromNode(node);
    // Image notes cannot travel as text; they stay out of the export.
    const notes = list.flatMap((d) => groupNotes(d.cards || [])).filter((n) => n.kind !== 'occlusion');
    if (notes.length === 0) {
      AlertService.alert('No cards', 'There are no cards to export in this deck or folder.');
      return;
    }
    const esc = (str: string) => {
      const text = (str || '').replace(/\r?\n/g, ' ');
      return text.includes(',') || text.includes('"') || text.includes(';') ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = `# FinScholar export: ${node.name}\n# Format: Front, Back — cloze notes are exported as Text, Extra\n`;
    const rows = notes.map((n) => `${esc(n.front)}, ${esc(n.back)}`);
    try {
      await Share.share({ title: `${node.name} flashcards`, message: header + rows.join('\n') });
    } catch (e) {
      console.error('Deck export error:', e);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Notes
  // ─────────────────────────────────────────────────────────────────────────

  const openAddNote = (deckId: string | null) => {
    const remembered = lastDeckId && deckById(lastDeckId) ? lastDeckId : null;
    const target =
      deckId || activeNode?.deck?.id || (activeNode ? collectDecksFromNode(activeNode)[0]?.id : null) || remembered || decksRef.current[0]?.id || null;
    if (!target) {
      openAddDeck();
      return;
    }
    setNoteEditor({ visible: true, deckId: target, note: null });
  };

  const noteFor = (deckId: string, noteId: string): NoteRow | null => {
    const deck = deckById(deckId);
    return deck ? groupNotes(deck.cards || []).find((n) => n.noteId === noteId) || null : null;
  };

  const openEditNote = (deckId: string, noteId: string) => {
    const note = noteFor(deckId, noteId);
    if (note) setNoteEditor({ visible: true, deckId, note });
  };

  const handleSaveNote = (draft: NoteDraft, deckId: string, keepOpen: boolean) => {
    const d = decksRef.current;
    const editing = noteEditor.note;
    const sourceDeckId = editing ? noteEditor.deckId : deckId;
    const deck = d.find((x) => x.id === sourceDeckId);
    if (!deck) return;
    const existing = editing ? (deck.cards || []).filter((c) => noteIdOf(c) === editing.noteId) : [];
    const cards = buildNoteCards(draft, existing, generateId, Date.now());
    const nd = d.map((x) =>
      x.id === deck.id ? { ...x, cards: editing ? replaceNote(x.cards || [], editing.noteId, cards) : [...(x.cards || []), ...cards] } : x
    );
    persist(nd);
    if (editing) releaseImages(d, nd);
    setLastKind(draft.kind);
    if (!editing) setLastDeckId(deck.id);
    if (editing) {
      setNoteEditor((prev) => ({ ...prev, visible: false }));
      // An edit can remove the card being reviewed (a deleted cloze number).
      if (session?.current && !cards.some((c) => c.id === session.current!.cardId) && existing.some((c) => c.id === session.current!.cardId)) {
        advanceSession(session, nd);
      }
    } else if (!keepOpen) {
      setNoteEditor((prev) => ({ ...prev, visible: false }));
    }
  };

  const handleDeleteNote = (note: NoteRow) => {
    const deckId = noteEditor.deckId;
    AlertService.alert('Delete note', note.cards.length > 1 ? `Delete this note and its ${note.cards.length} cards?` : 'Delete this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const before = decksRef.current;
          const nd = before.map((d) =>
            d.id === deckId ? { ...d, cards: (d.cards || []).filter((c) => noteIdOf(c) !== note.noteId) } : d
          );
          persist(nd);
          // Undoing an answer must not resurrect a deleted note without its picture.
          setUndo(null);
          releaseImages(before, nd);
          setNoteEditor((prev) => ({ ...prev, visible: false }));
          if (session?.current && note.cards.some((c) => c.id === session.current!.cardId)) advanceSession(session, nd);
        },
      },
    ]);
  };

  /** Applies `fn` to every card of the selected notes under the open deck. */
  const mapSelected = (fn: (c: Flashcard) => Flashcard | null) => {
    if (!activeNode) return decksRef.current;
    const ids = new Set(collectDecksFromNode(activeNode).map((d) => d.id));
    return decksRef.current.map((d) => {
      if (!ids.has(d.id)) return d;
      const cards: Flashcard[] = [];
      for (const c of d.cards || []) {
        if (!selectedNotes.has(`${d.id}:${noteIdOf(c)}`)) {
          cards.push(c);
          continue;
        }
        const next = fn(c);
        if (next) cards.push(next);
      }
      return { ...d, cards };
    });
  };

  const endSelection = () => {
    setIsSelectionMode(false);
    setSelectedNotes(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedNotes.size === 0) return;
    AlertService.alert('Delete notes', `Delete ${selectedNotes.size} selected note${selectedNotes.size !== 1 ? 's' : ''} and all their cards?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const before = decksRef.current;
          const after = mapSelected(() => null);
          persist(after);
          setUndo(null);
          releaseImages(before, after);
          endSelection();
        },
      },
    ]);
  };

  const handleBulkSuspend = (suspend: boolean) => {
    persist(
      mapSelected((c) => {
        if (suspend) return { ...c, suspended: true };
        const { suspended: _s, ...rest } = c;
        return rest;
      })
    );
    endSelection();
  };

  const handleBulkReverse = () => {
    AlertService.alert('Swap sides', 'Swap the front and back of the selected notes? Cloze notes are left as they are.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Swap',
        onPress: () => {
          persist(mapSelected((c) => (kindOf(c) === 'cloze' ? c : { ...c, front: c.back, back: c.front })));
          endSelection();
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Review sessions
  // ─────────────────────────────────────────────────────────────────────────

  const scopeOf = (s: Session | null) => (s?.deckIds ? new Set(s.deckIds) : null);

  const startSession = (node: DeckNode | null, mode: SessionMode = 'normal', aheadDays = 7, decksOverride?: FlashcardDeck[]) => {
    const d = decksOverride || decksRef.current;
    const scopeDecks = node ? collectDecksFromNode(node) : d;
    const ids = node ? new Set(scopeDecks.map((x) => x.id)) : null;
    const now = Date.now();
    const queue = buildQueue(d, ids, srSettings, now, mode, aheadDays);
    const pick = pickNext(d, ids, queue, 0, now, { mode });
    if (!pick.ref) {
      const empty = (node ? totalFor(node) : totalCards) === 0;
      AlertService.alert(
        empty ? 'No cards yet' : 'Nothing due',
        empty
          ? 'Add some cards to this deck first.'
          : pick.nextLearningAt
          ? `Your learning cards come back ${relativeDue(pick.nextLearningAt, now)}. Custom study lets you review ahead or cram meanwhile.`
          : 'You have finished everything for today. Custom study lets you review ahead or cram.',
        empty
          ? [{ text: 'OK' }]
          : [
              { text: 'Not now', style: 'cancel' },
              { text: 'Custom study', onPress: () => setTimeout(() => setCustomPath(node ? node.fullPath : null), 250) },
            ]
      );
      return;
    }
    const title =
      mode === 'cram' ? `Cram · ${node ? node.name : 'All decks'}` : mode === 'ahead' ? `Ahead · ${node ? node.name : 'All decks'}` : node ? node.name : 'All decks';
    setSession({
      deckIds: ids ? Array.from(ids) : null,
      title,
      color: node?.deck?.color || null,
      mode,
      queue,
      pos: pick.queuePos,
      current: pick.ref,
      answered: 0,
      again: 0,
      graduated: 0,
      startedAt: now,
      shownAt: now,
      flip: false,
      done: false,
      nextLearningAt: null,
      xpBefore: statsRef.current?.totalXp || 0,
      returnTo: view === 'detail' ? 'detail' : 'decks',
    });
    setRevealed(false);
    setTyped('');
    setUndo(null);
    ratingRef.current = false;
    setView('study');
  };

  const advanceSession = (s: Session, d: FlashcardDeck[], at: number = Date.now()) => {
    const pick = pickNext(d, scopeOf(s), s.queue, s.pos, at, { mode: s.mode });
    setSession({ ...s, pos: pick.queuePos, current: pick.ref, done: !pick.ref, nextLearningAt: pick.nextLearningAt, shownAt: Date.now() });
    setRevealed(false);
    setTyped('');
  };

  const currentCard = (() => {
    if (!session?.current) return null;
    const deck = decks.find((d) => d.id === session.current!.deckId);
    const card = deck?.cards?.find((c) => c.id === session.current!.cardId);
    return deck && card ? { deck, card } : null;
  })();

  const revealAnswer = () => {
    if (!revealed) {
      setRevealed(true);
      triggerHaptic('light');
    }
  };

  const rate = (g: Rating) => {
    const s = session;
    if (!s || !s.current || ratingRef.current) return;
    ratingRef.current = true;
    try {
      const now = Date.now();
      const d = decksRef.current;
      const deck = d.find((x) => x.id === s.current!.deckId);
      const card = deck?.cards?.find((c) => c.id === s.current!.cardId);
      if (!deck || !card) {
        advanceSession(s, d);
        return;
      }
      const prevState = cardState(card);
      let nextDecks = d;
      let res: AnswerResult | null = null;
      if (s.mode !== 'cram') {
        res = answerCard(card, g, srSettings, now, { examDate: examDaysLeft(deck, now) !== null ? deck.examDate : null });
        let cards = (deck.cards || []).map((c) => (c.id === card.id ? res!.card : c));
        if (resolveSettings(srSettings).burySiblings) cards = burySiblings(cards, res.card, now);
        nextDecks = d.map((x) => (x.id === deck.id ? bumpDaily({ ...deck, cards }, prevState, now) : x));
      }

      let st = updateStudyStats(statsRef.current, 1, res?.graduated ? 1 : 0, false);
      st = recordAnswer(st, {
        dayKey: studyDayKey(now),
        wasReview: s.mode !== 'cram' && prevState === 'review',
        passed: g !== 1,
        ms: now - s.shownAt,
      });

      // Cram does not reschedule, so "Again" has to put the card back itself.
      let queue = s.queue;
      if (s.mode === 'cram' && g === 1) {
        const at = Math.min(queue.length, s.pos + 4);
        queue = [...queue.slice(0, at), s.current, ...queue.slice(at)];
      }
      const pick = pickNext(nextDecks, scopeOf(s), queue, s.pos, now, { mode: s.mode });
      const done = !pick.ref;
      const answered = s.answered + 1;
      if (done) st = updateStudyStats(st, 0, 0, true, answered);

      setUndo({ decks: d, stats: statsRef.current, session: s });
      persist(s.mode === 'cram' ? null : nextDecks, st);
      setSession({
        ...s,
        queue,
        pos: pick.queuePos,
        current: pick.ref,
        answered,
        again: s.again + (g === 1 ? 1 : 0),
        graduated: s.graduated + (res?.graduated ? 1 : 0),
        shownAt: Date.now(),
        done,
        nextLearningAt: pick.nextLearningAt,
      });
      setRevealed(false);
      setTyped('');
      triggerHaptic(done ? 'success' : 'light');

      if (res?.becameLeech) {
        const leechDeck = deck.id;
        const leechNote = noteIdOf(res.card);
        const leechId = res.card.id;
        setTimeout(() => {
          AlertService.alert(
            'This card keeps slipping',
            `You have forgotten it ${res!.card.lapses} times. Cards like this usually need rewording — split it into smaller facts, or add a memory aid.`,
            [
              { text: 'Keep going', style: 'cancel' },
              { text: 'Edit it', onPress: () => openEditNote(leechDeck, leechNote) },
              {
                text: 'Suspend it',
                onPress: () =>
                  persist(
                    decksRef.current.map((x) =>
                      x.id === leechDeck ? { ...x, cards: x.cards.map((c) => (c.id === leechId ? { ...c, suspended: true } : c)) } : x
                    )
                  ),
              },
            ]
          );
        }, 250);
      }
    } finally {
      ratingRef.current = false;
    }
  };

  /** One step back: the card, its siblings, the deck's daily counts, XP and streak. */
  const handleUndo = () => {
    if (!undo) return;
    const snap = undo;
    setUndo(null);
    persist(snap.decks, snap.stats);
    setSession({ ...snap.session, shownAt: Date.now() });
    setRevealed(false);
    setTyped('');
  };

  const continueLearning = () => {
    if (!session) return;
    const d = decksRef.current;
    const at = session.nextLearningAt || Date.now();
    const pick = pickNext(d, scopeOf(session), session.queue, session.pos, at, { mode: session.mode });
    if (!pick.ref) return;
    setSession({ ...session, current: pick.ref, pos: pick.queuePos, done: false, nextLearningAt: null, shownAt: Date.now() });
    setRevealed(false);
    setTyped('');
  };

  const exitSession = () => {
    setUndo(null);
    setShowReviewMore(false);
    setView(session?.returnTo === 'detail' && activeNode ? 'detail' : 'decks');
  };

  const patchCurrent = (patch: (c: Flashcard) => Flashcard, thenAdvance: boolean) => {
    if (!session?.current) return;
    const ref = session.current;
    const nd = decksRef.current.map((d) =>
      d.id === ref.deckId ? { ...d, cards: (d.cards || []).map((c) => (c.id === ref.cardId ? patch(c) : c)) } : d
    );
    persist(nd);
    setUndo(null);
    if (thenAdvance) advanceSession(session, nd);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Custom study
  // ─────────────────────────────────────────────────────────────────────────

  const customNode = customPath === undefined ? undefined : customPath === null ? null : findNode(tree, customPath);
  const customScope = customNode === undefined ? [] : customNode ? collectDecksFromNode(customNode) : decks;

  const addNewBonus = (node: DeckNode | null, extra: number) => {
    const ids = new Set((node ? collectDecksFromNode(node) : decksRef.current).map((d) => d.id));
    const now = Date.now();
    const nd = decksRef.current.map((d) => {
      if (!ids.has(d.id)) return d;
      const today = studyDayKey(now);
      const daily = d.daily && d.daily.date === today ? d.daily : { date: today, newDone: 0, reviewDone: 0, newBonus: 0 };
      return { ...d, daily: { ...daily, newBonus: (daily.newBonus || 0) + extra } };
    });
    persist(nd);
    return nd;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Practice test
  // ─────────────────────────────────────────────────────────────────────────

  /** One card per note, as plain question/answer pairs the practice modes can use. */
  const practicePairs = (node: DeckNode) => {
    const seen = new Set<string>();
    const out: { id: string; question: string; answer: string }[] = [];
    for (const c of collectCards(node)) {
      if (c.suspended) continue;
      const key = `${c.deckId}:${noteIdOf(c)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const qa = cardQA(c);
      if (qa.question.trim() && qa.answer.trim()) out.push({ id: c.id, ...qa });
    }
    return out;
  };

  const generateQuiz = (node: DeckNode, onlyMissed?: QuizQuestion[]) => {
    const pairs = practicePairs(node);
    if (pairs.length < 2) {
      AlertService.alert('Not enough cards', 'You need at least 2 cards for a practice test.');
      return;
    }
    let source = pairs;
    if (onlyMissed) {
      const missed = new Set(onlyMissed.map((q) => q.cardId));
      source = pairs.filter((p) => missed.has(p.id));
    } else {
      source = shuffle(pairs).slice(0, Math.min(10, pairs.length));
    }
    const questions: QuizQuestion[] = source.map((p) => {
      const correct = p.answer.trim();
      const others = Array.from(new Set(pairs.map((x) => x.answer.trim()).filter((a) => a && a.toLowerCase() !== correct.toLowerCase())));
      const options = shuffle(Array.from(new Set([...shuffle(others).slice(0, 3), correct])));
      return { cardId: p.id, question: p.question, correctAnswer: correct, options };
    });
    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizSelected(null);
    setQuizDone(false);
    setQuizMissed([]);
    setPracticePath(node.fullPath);
    setView('quiz');
  };

  const handleQuizAnswer = (answer: string) => {
    if (quizSelected !== null) return;
    setQuizSelected(answer);
    const q = quizQuestions[quizIndex];
    const isCorrect = answer === q.correctAnswer;
    triggerHaptic(isCorrect ? 'success' : 'warning');
    if (isCorrect) setQuizScore((p) => p + 1);
    else setQuizMissed((p) => [...p, q]);
    setTimeout(() => {
      if (quizIndex + 1 >= quizQuestions.length) {
        setQuizDone(true);
        persist(null, updateStudyStats(statsRef.current, quizQuestions.length, quizScore + (isCorrect ? 1 : 0), true));
      } else {
        setQuizIndex((p) => p + 1);
        setQuizSelected(null);
      }
    }, 1100);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Speed match
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (view !== 'match' || matchDone || matchStartTime === 0) return;
    const timer = setInterval(() => setMatchElapsed(Math.max(0, Math.floor((Date.now() - matchStartTime) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [view, matchDone, matchStartTime]);

  const startMatch = (node: DeckNode) => {
    const pairs = practicePairs(node);
    if (pairs.length < 2) {
      AlertService.alert('Not enough cards', 'You need at least 2 cards for speed match.');
      return;
    }
    const tiles: MatchCard[] = [];
    shuffle(pairs)
      .slice(0, Math.min(6, pairs.length))
      .forEach((p) => {
        tiles.push({ id: generateId(), pairId: p.id, text: p.question, isTerm: true });
        tiles.push({ id: generateId(), pairId: p.id, text: p.answer, isTerm: false });
      });
    setMatchCards(shuffle(tiles));
    setMatchRevealed([]);
    setMatchMatched(new Set());
    setMatchMoves(0);
    setMatchStartTime(Date.now());
    setMatchDone(false);
    setMatchElapsed(0);
    setPracticePath(node.fullPath);
    setView('match');
  };

  const handleMatchTap = (tileId: string) => {
    if (matchRevealed.length >= 2 || matchRevealed.includes(tileId)) return;
    const tile = matchCards.find((c) => c.id === tileId);
    if (!tile || matchMatched.has(tile.pairId)) return;
    const next = [...matchRevealed, tileId];
    setMatchRevealed(next);
    if (next.length < 2) return;
    setMatchMoves((p) => p + 1);
    const [a, b] = next.map((id) => matchCards.find((c) => c.id === id)!);
    if (a.pairId === b.pairId && a.isTerm !== b.isTerm) {
      triggerHaptic('light');
      setTimeout(() => {
        setMatchMatched((prev) => {
          const set = new Set(prev);
          set.add(a.pairId);
          const totalPairs = matchCards.length / 2;
          if (set.size >= totalPairs) {
            setMatchDone(true);
            setMatchElapsed(Math.max(0, Math.floor((Date.now() - matchStartTime) / 1000)));
            persist(null, updateStudyStats(statsRef.current, totalPairs, 0, true));
          }
          return set;
        });
        setMatchRevealed([]);
      }, 350);
    } else {
      setTimeout(() => setMatchRevealed([]), 750);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Practice launcher
  // ─────────────────────────────────────────────────────────────────────────

  const runPractice = (action: PracticeAction, node: DeckNode | null) => {
    if (action === 'custom') {
      setCustomPath(node ? node.fullPath : null);
      return;
    }
    if (!node) return;
    if (action === 'quiz') generateQuiz(node);
    else if (action === 'match') startMatch(node);
    else if (action === 'exam') openExam(node);
  };

  /** From the home screen a practice mode needs a deck; ask only when there is a choice. */
  const launchFromHome = (action: PracticeAction) => {
    if (decks.length === 0) {
      AlertService.alert('No decks yet', 'Create a deck and add a few cards first.');
      return;
    }
    if (action === 'custom') {
      setCustomPath(null);
      return;
    }
    if (tree.length === 1 && tree[0].children.size === 0) runPractice(action, tree[0]);
    else setPickerAction(action);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Exam mode
  // ─────────────────────────────────────────────────────────────────────────

  const openExam = (node: DeckNode) => {
    const current = collectDecksFromNode(node).find((d) => examDaysLeft(d) !== null)?.examDate;
    if (current) {
      const [y, m, d] = current.split('-').map(Number);
      setExamDate(new Date(y, m - 1, d, 12));
    } else {
      setExamDate(new Date(Date.now() + 14 * 86400000));
    }
    setExamPath(node.fullPath);
  };

  const applyExam = (node: DeckNode) => {
    const key = getLocalDateString(examDate);
    const ids = new Set(collectDecksFromNode(node).map((d) => d.id));
    const now = Date.now();
    persist(decksRef.current.map((d) => (ids.has(d.id) ? { ...d, examDate: key, cards: planExamReschedule(d.cards || [], key, now) } : d)));
    setExamPath(null);
    triggerHaptic('success');
  };

  const endExam = (node: DeckNode) => {
    const ids = new Set(collectDecksFromNode(node).map((d) => d.id));
    persist(
      decksRef.current.map((d) => {
        if (!ids.has(d.id)) return d;
        const { examDate: _e, ...rest } = d;
        return rest as FlashcardDeck;
      })
    );
    setExamPath(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Import
  // ─────────────────────────────────────────────────────────────────────────

  const openImport = (deckId: string) => {
    setImportDeckId(deckId);
    setImportText('');
    setImportFileName('');
    setShowImportHelp(false);
    setShowImport(true);
  };

  // A picked file loads into the text box rather than being parsed once on
  // the side: the old flow kept only the parse, so changing the card type or
  // separator afterwards cleared it and the file's contents were gone.
  const handlePickFile = async () => {
    try {
      setImportLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', 'text/tab-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const content = await response.text();
      setImportFileName(asset.name);
      setImportText(content);
    } catch (e: any) {
      console.error('File Read Error:', e);
      AlertService.alert('Could not read that file', `Save it as a plain .txt or .csv and try again. (${e?.message || 'Unknown error'})`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = () => {
    const deck = deckById(importDeckId);
    if (!deck) return;
    const analysis = analyzeImport(importText, importSeparator, importKind, deck.cards || []);
    if (analysis.notes.length === 0) return;
    const now = Date.now();
    let added: Flashcard[] = [];
    analysis.notes.forEach((n, i) => {
      added = added.concat(buildNoteCards({ kind: n.kind, front: n.front, back: n.back }, [], generateId, now + i));
    });
    persist(decksRef.current.map((d) => (d.id === deck.id ? { ...d, cards: [...(d.cards || []), ...added] } : d)));
    setShowImport(false);
    setImportText('');
    setImportFileName('');
    const extras = [
      analysis.duplicates ? `${analysis.duplicates} duplicate${analysis.duplicates !== 1 ? 's' : ''} left out` : '',
      analysis.skipped.length ? `${analysis.skipped.length} line${analysis.skipped.length !== 1 ? 's' : ''} skipped` : '',
    ].filter(Boolean).join(', ');
    AlertService.alert(
      'Imported',
      `${added.length} card${added.length !== 1 ? 's' : ''} added to "${deck.name}".${extras ? ` (${extras}.)` : ''} They join as new cards and come up at your daily new-card pace.`
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Shared atoms
  // ─────────────────────────────────────────────────────────────────────────

  const microLabel = {
    fontFamily: 'Nunito_800ExtraBold' as const,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.textTertiary,
  };

  const fieldStyle = {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.inputBg,
    color: theme.text,
    padding: 14,
    fontFamily: 'Nunito_600SemiBold' as const,
    fontSize: 15,
  };

  const iconButton = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    opts?: { disabled?: boolean; active?: boolean }
  ) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={opts?.disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(opts?.disabled), selected: Boolean(opts?.active) }}
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: opts?.active ? tints.grades.fill : theme.surface,
        borderWidth: 1,
        borderColor: opts?.active ? tints.grades.line : theme.cardBorder,
        borderBottomWidth: 2,
        borderBottomColor: opts?.active ? tints.grades.line : theme.lip,
        opacity: opts?.disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={17} color={opts?.active ? tints.grades.ink : theme.textSecondary} />
    </TouchableOpacity>
  );

  const PrimaryButton = ({ label, onPress, disabled, color }: { label: string; onPress: () => void; disabled?: boolean; color?: string }) => (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        paddingVertical: 14,
        borderRadius: Radius.lg,
        alignItems: 'center',
        backgroundColor: disabled ? theme.surfaceSecondary : color || theme.primary,
        borderBottomWidth: 3,
        borderBottomColor: disabled ? theme.cardBorder : color ? 'rgba(0,0,0,0.25)' : theme.primaryDark,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5, color: disabled ? theme.textTertiary : '#ffffff' }}>{label}</Text>
    </AnimatedPressable>
  );

  /** Anki's three numbers, in their colours. */
  const QueueCounts = ({ c, size = 13, onBand }: { c: DueCounts; size?: number; onBand?: boolean }) => {
    const band = queueOnBand(isDark);
    const items = [
      { key: 'new', n: c.new, label: 'new', color: onBand ? band.new : qt.new.ink },
      { key: 'learn', n: c.learn, label: 'learning', color: onBand ? band.learn : qt.learn.ink },
      { key: 'review', n: c.review, label: 'review', color: onBand ? band.review : qt.review.ink },
    ];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {items.map((it) => (
          <View key={it.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: it.color }} />
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: size, color: onBand ? brand.onHeroMuted : theme.textSecondary }}>
              <Text style={{ fontFamily: 'Nunito_900Black', color: onBand ? brand.onHero : theme.text }}>{it.n}</Text> {it.label}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const ToolTiles = ({ node }: { node: DeckNode | null }) => {
    const tiles: { key: PracticeAction; icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; tint: typeof tints.grades }[] = [
      { key: 'quiz', icon: 'document-text-outline', label: 'Practice test', hint: 'Multiple choice', tint: tints.attendance },
      { key: 'match', icon: 'grid-outline', label: 'Speed match', hint: 'Pair them up', tint: tints.tasks },
      { key: 'exam', icon: 'calendar-outline', label: 'Exam prep', hint: 'Ready by a date', tint: tints.danger },
      { key: 'custom', icon: 'flash-outline', label: 'Custom', hint: 'Ahead or cram', tint: tints.schedule },
    ];
    // Two rows of two, icon beside the words: the dashboard's quick actions are
    // one row of stacked tiles, and this toolbelt should not read as a copy.
    const rows = [tiles.slice(0, 2), tiles.slice(2, 4)];
    return (
      <View style={{ gap: 10 }}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 10 }}>
            {row.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => (node ? runPractice(t.key, node) : launchFromHome(t.key))}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${t.label}, ${t.hint}`}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingLeft: 10,
                  paddingRight: 8,
                  borderRadius: Radius.xl,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  borderBottomWidth: 2,
                  borderBottomColor: theme.lip,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.tint.fill }}>
                  <Ionicons name={t.icon} size={18} color={t.tint.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.text }}>
                    {t.label}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>
                    {t.hint}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: home
  // ─────────────────────────────────────────────────────────────────────────

  const renderHome = () => {
    const todayMidnight = getLocalDateString();
    const studiedToday = flashcardStats.lastStudyDate === todayMidnight;
    const streak = isStreakLive(flashcardStats.lastStudyDate) ? Math.max(0, flashcardStats.currentStreak || 0) : 0;
    const goal = Math.max(1, flashcardStats.dailyGoal || 20);
    const reviewedToday = studiedToday ? flashcardStats.cardsReviewedToday ?? 0 : 0;
    const retention = trueRetention(flashcardStats, 30);

    // Time estimate from this student's own pace; 8 seconds a card until there is one.
    const log = flashcardStats.log || {};
    const recent = Object.values(log).slice(-14);
    const recentReviews = recent.reduce((s, x) => s + (x?.reviews || 0), 0);
    const recentMs = recent.reduce((s, x) => s + (x?.ms || 0), 0);
    const perCard = recentReviews >= 20 ? recentMs / recentReviews : 8000;
    const estMin = Math.max(1, Math.round((allDue * perCard) / 60000));

    let nextDue = Infinity;
    for (const d of decks) for (const c of d?.cards || []) if (c && !isSidelined(c, clock) && cardState(c) !== 'new' && c.nextDue > clock && c.nextDue < nextDue) nextDue = c.nextDue;

    const q = search.trim().toLowerCase();
    const visibleTree = q
      ? buildDeckTree(decks.filter((d) => d && (d.name.toLowerCase().includes(q) || (d.subject || '').toLowerCase().includes(q))))
      : tree;

    const momentum = [
      {
        key: 'streak',
        icon: 'flame' as const,
        value: `${streak}-day streak`,
        caption: studiedToday ? 'Done today' : streak > 0 ? 'Study to keep it' : 'Start one today',
        tint: tints.tasks,
      },
      {
        key: 'retention',
        icon: 'pulse' as const,
        value: retention === null ? 'No retention yet' : `${Math.round(retention * 100)}% retention`,
        caption: retention === null ? 'Review to see it' : 'Last 30 days',
        tint: tints.schedule,
      },
    ];

    const bandButton = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: brand.well,
          borderWidth: 1,
          borderColor: brand.wellLine,
        }}
      >
        <Ionicons name={icon} size={18} color={brand.onHero} />
      </TouchableOpacity>
    );

    return (
      <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ══ App bar, on the band ═══════════════════════════════════════════
            The study tab shares the dashboard's azure band so the two read as
            one app, but not its layout: the band ends flat with the page pulled
            over it as a sheet, the daily goal is a ring beside the due count,
            and Study is one full-width button — no floating stat card. */}
        <View style={{ backgroundColor: brand.heroFrom, paddingTop: insets.top, zIndex: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10, gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: brand.onHero, letterSpacing: -0.4 }}>
                Study
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: brand.onHeroMuted }}>
                {decks.length} deck{decks.length !== 1 ? 's' : ''} · {totalCards} card{totalCards !== 1 ? 's' : ''}
              </Text>
            </View>
            {bandButton('stats-chart', 'Statistics', () => setShowStats(true))}
            {bandButton('options-outline', 'Study options', () => router.push('/study-options'))}
            <SpotlightTarget id={SPOTLIGHT_IDS.studyCreateDeck}>
              <AnimatedPressable
                onPress={() => setShowCreateSheet(true)}
                accessibilityRole="button"
                accessibilityLabel="Create a deck, folder or cards"
                style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}
              >
                <Ionicons name="add" size={22} color={brand.heroTo} />
              </AnimatedPressable>
            </SpotlightTarget>
          </View>
        </View>

        {loading ? (
          <ListSkeleton count={4} cardHeight={80} />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ══ Today, in the band ══ */}
            <View
              onLayout={(e) => {
                const h = Math.round(e.nativeEvent.layout.height);
                if (h !== bandH) setBandH(h);
              }}
              style={{ paddingHorizontal: GUTTER + 4, paddingTop: 6, paddingBottom: SHEET_LIFT + 20 }}
            >
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {bandH > 0 && <HeroBackdrop width={SCREEN_WIDTH} height={bandH} curve={0} motif="cards" isDark={isDark} />}
              </View>
              {decks.length === 0 ? (
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20, color: brand.onHeroMuted, maxWidth: 300 }}>
                  Flashcards that schedule themselves — review each card right before you would forget it.
                </Text>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...microLabel, color: brand.onHeroMuted }}>{allDue > 0 ? 'Due today' : 'All caught up'}</Text>
                      {allDue > 0 ? (
                        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 38, color: brand.onHero, letterSpacing: -1.2, marginTop: 2 }}>
                          {allDue}
                          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: brand.onHeroMuted, letterSpacing: 0 }}>
                            {' '}card{allDue !== 1 ? 's' : ''} · ~{estMin} min
                          </Text>
                        </Text>
                      ) : (
                        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 22, color: brand.onHero, letterSpacing: -0.4, marginTop: 6 }}>
                          {totalCards === 0
                            ? 'Add cards to begin'
                            : nextDue < Infinity
                            ? `Next review ${relativeDue(nextDue, clock)}`
                            : 'Nothing scheduled'}
                        </Text>
                      )}
                      {allDue > 0 && (
                        <View style={{ marginTop: 4 }}>
                          <QueueCounts c={allCounts} size={12} onBand />
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setShowStats(true)} activeOpacity={0.75} accessibilityRole="button" accessibilityHint="Opens statistics">
                      <GoalRing done={reviewedToday} goal={goal} track={brand.wellStrong} fill="#ffffff" ink={brand.onHero} inkMuted={brand.onHeroMuted} />
                    </TouchableOpacity>
                  </View>

                  {allDue > 0 ? (
                    <AnimatedPressable
                      onPress={() => startSession(null)}
                      accessibilityRole="button"
                      accessibilityLabel={`Study now, ${allDue} cards`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 16,
                        height: 48,
                        borderRadius: Radius.xl,
                        backgroundColor: '#ffffff',
                        borderBottomWidth: 3,
                        borderBottomColor: 'rgba(0,0,0,0.18)',
                      }}
                    >
                      <Ionicons name="play" size={17} color={brand.heroTo} />
                      <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 16, color: brand.heroTo }}>Study now</Text>
                    </AnimatedPressable>
                  ) : totalCards > 0 ? (
                    <TouchableOpacity
                      onPress={() => setCustomPath(null)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Custom study"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginTop: 16,
                        height: 44,
                        borderRadius: Radius.xl,
                        backgroundColor: brand.well,
                        borderWidth: 1,
                        borderColor: brand.wellLine,
                      }}
                    >
                      <Ionicons name="flash-outline" size={15} color={brand.onHero} />
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: brand.onHero }}>Custom study</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>

            {/* ══ The page, as a sheet pulled over the band ══ */}
            <View
              style={{
                marginTop: -SHEET_LIFT,
                paddingTop: 18,
                paddingHorizontal: GUTTER,
                backgroundColor: theme.background,
                borderTopLeftRadius: Radius['4xl'],
                borderTopRightRadius: Radius['4xl'],
              }}
            >
              {decks.length === 0 ? (
                /* ══ First run ══ */
                <Card padding={0} radius={Radius['3xl']} style={{ overflow: 'hidden' }}>
                  <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 12, backgroundColor: brand.wash, borderBottomWidth: 1, borderBottomColor: brand.washLine }}>
                    <Image source={require('../../assets/images/studying.png')} style={{ width: 118, height: 118 }} resizeMode="contain" />
                  </View>
                  <View style={{ padding: 20 }}>
                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.text, textAlign: 'center', letterSpacing: -0.4 }}>
                      Your study space
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 13.5, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 16 }}>
                      Make cards, then come back each day. Fin shows every card again right before you would forget it — the way Anki does, minus the setup.
                    </Text>
                    {[
                      { icon: 'add-circle-outline' as const, text: 'Add cards — plain, both ways, cloze or type-in' },
                      { icon: 'eye-outline' as const, text: 'Recall the answer, then reveal it' },
                      { icon: 'checkmark-circle-outline' as const, text: 'Rate how it went — Fin picks the next date' },
                    ].map((s, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.wash }}>
                          <Ionicons name={s.icon} size={15} color={brand.ink} />
                        </View>
                        <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.text }}>{s.text}</Text>
                      </View>
                    ))}
                    <View style={{ height: 8 }} />
                    <PrimaryButton label="Create your first deck" onPress={() => openAddDeck()} />
                    <TouchableOpacity
                      onPress={addSampleDeck}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Try a sample deck"
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 }}
                    >
                      <Ionicons name="sparkles-outline" size={15} color={theme.primary} />
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.primary }}>Try a sample deck first</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ) : (
                <>
                  {/* ══ Momentum ══ */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    {momentum.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => setShowStats(true)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${m.value}. ${m.caption}. Opens statistics.`}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 9,
                          paddingVertical: 9,
                          paddingLeft: 9,
                          paddingRight: 12,
                          borderRadius: Radius.full,
                          backgroundColor: m.tint.fill,
                          borderWidth: 1,
                          borderColor: m.tint.line,
                        }}
                      >
                        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}>
                          <Ionicons name={m.icon} size={15} color={m.tint.ink} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: 'Nunito_900Black', fontSize: 13.5, color: theme.text }}>
                            {m.value}
                          </Text>
                          <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: m.tint.ink }}>
                            {m.caption}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={{ ...microLabel, marginBottom: 10, marginLeft: 2 }}>Practice</Text>
                  <View style={{ marginBottom: 24 }}>
                    <ToolTiles node={null} />
                  </View>

                  <SectionHeader
                    title="Decks"
                    count={tree.length}
                    railColor={brand.solid}
                    actionLabel="New deck"
                    actionIcon="add"
                    actionColor={brand.ink}
                    onAction={() => openAddDeck()}
                  />

                  {decks.length >= 5 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        height: 42,
                        borderRadius: Radius.lg,
                        marginBottom: 10,
                        backgroundColor: theme.inputBg,
                        borderWidth: 1,
                        borderColor: theme.inputBorder,
                      }}
                    >
                      <Ionicons name="search" size={16} color={theme.textTertiary} />
                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search decks…"
                        placeholderTextColor={theme.textTertiary}
                        accessibilityLabel="Search decks"
                        style={{ flex: 1, marginLeft: 8, fontFamily: 'Nunito_600SemiBold', fontSize: 13.5, color: theme.text, padding: 0 }}
                      />
                      {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {visibleTree.length === 0 ? (
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textTertiary, textAlign: 'center', paddingVertical: 18 }}>
                      No decks match "{search}".
                    </Text>
                  ) : (
                    <DeckList
                      nodes={visibleTree}
                      isDark={isDark}
                      expanded={q ? new Set(allNodes(visibleTree).map((x) => x.node.fullPath)) : expanded}
                      onToggle={toggleNode}
                      onOpen={openNode}
                      onLongPress={(n) => setActionPath(n.fullPath)}
                      countsFor={countsFor}
                      totalFor={totalFor}
                      examLabelFor={examLabelFor}
                    />
                  )}
                  <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, textAlign: 'center', marginTop: 10 }}>
                    Long-press a deck for more options
                  </Text>
                </>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: deck overview
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * The deck screen: Anki's overview on top (the three numbers and Study now),
   * the browser underneath. It absorbed the old separate `manage` view — the
   * two were ~90% the same screen with different halves of the features, so
   * which half you got depended on which button you pressed.
   */
  const renderDetail = () => {
    if (!activeNode) return null;
    const node = activeNode;
    const deck = node.deck ? deckById(node.deck.id) : null;
    const color = deck?.color || theme.primary;
    const c = countsFor(node);
    const due = c.new + c.learn + c.review;
    const scopeDecks = collectDecksFromNode(node);
    const allCards = scopeDecks.flatMap((d) => d.cards || []);
    const comp = composition(allCards);
    const examLeft = scopeDecks.map((d) => examDaysLeft(d, clock)).filter((x): x is number => x !== null).sort((a, b) => a - b)[0];
    let nextDue = Infinity;
    for (const card of allCards) if (card && !isSidelined(card, clock) && cardState(card) !== 'new' && card.nextDue > clock && card.nextDue < nextDue) nextDue = card.nextDue;

    // Notes, per deck, for the browser.
    const notes = scopeDecks.flatMap((d) => groupNotes(d.cards || []).map((n) => ({ ...n, deckId: d.id, deckName: d.name })));
    const matches = (n: NoteRow, f: DetailFilter) => {
      if (f === 'all') return true;
      return n.cards.some((card) => {
        if (f === 'suspended') return card.suspended;
        if (f === 'flagged') return card.flagged;
        if (f === 'leech') return card.leech;
        if (card.suspended) return false;
        const st = cardState(card);
        if (f === 'new') return st === 'new';
        if (f === 'learning') return st === 'learning' || st === 'relearning';
        return st === 'review' && card.nextDue <= clock;
      });
    };
    const filterDefs: { key: DetailFilter; label: string; color: string }[] = [
      { key: 'all', label: 'All', color: theme.primary },
      { key: 'new', label: 'New', color: qt.new.solid },
      { key: 'learning', label: 'Learning', color: qt.learn.solid },
      { key: 'due', label: 'Due', color: qt.review.solid },
      { key: 'flagged', label: 'Flagged', color: tints.danger.solid },
      { key: 'suspended', label: 'Suspended', color: theme.textTertiary },
      { key: 'leech', label: 'Leeches', color: tints.tasks.solid },
    ];
    const filterCounts = new Map(filterDefs.map((f) => [f.key, notes.filter((n) => matches(n, f.key)).length]));
    const qd = detailSearch.trim().toLowerCase();
    const visible = notes.filter(
      (n) =>
        matches(n, detailFilter) &&
        (!qd || n.front.toLowerCase().includes(qd) || n.back.toLowerCase().includes(qd) || n.tags.some((t) => t.toLowerCase().includes(qd)))
    );
    const selKey = (n: { deckId: string; noteId: string }) => `${n.deckId}:${n.noteId}`;
    const allSelected = visible.length > 0 && visible.every((n) => selectedNotes.has(selKey(n)));
    const selectedAllSuspended =
      selectedNotes.size > 0 && notes.filter((n) => selectedNotes.has(selKey(n))).every((n) => n.cards.every((card) => card.suspended));

    const legend = [
      { key: 'new', label: 'New', n: comp.new, color: qt.new.solid },
      { key: 'learning', label: 'Learning', n: comp.learning, color: qt.learn.solid },
      { key: 'young', label: 'Young', n: comp.young, color: brand.solid },
      { key: 'mature', label: 'Mature', n: comp.mature, color: qt.review.solid },
      { key: 'suspended', label: 'Suspended', n: comp.suspended, color: theme.textTertiary },
    ];

    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10 }}>
          {iconButton('chevron-back', 'Back to all decks', () => {
            endSelection();
            setView('decks');
          })}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} accessibilityRole="header" style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text, letterSpacing: -0.4 }}>
              {node.name}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>
              {node.fullPath !== node.name ? `${node.fullPath} · ` : ''}
              {comp.total} card{comp.total !== 1 ? 's' : ''}
              {scopeDecks.length > 1 ? ` · ${scopeDecks.length} decks` : ''}
            </Text>
          </View>
          {iconButton('ellipsis-horizontal', 'Deck options', () => setActionPath(node.fullPath))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: tabBarHeight + 28 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ══ Overview ══ */}
          <Card padding={0} radius={Radius['3xl']} style={{ overflow: 'hidden', marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8 }}>
              {[
                { key: 'new', n: c.new, label: 'New', tint: qt.new },
                { key: 'learn', n: c.learn, label: 'Learning', tint: qt.learn },
                { key: 'review', n: c.review, label: 'To review', tint: qt.review },
              ].map((x, i) => (
                <React.Fragment key={x.key}>
                  {i > 0 && <View style={{ width: 1, marginVertical: 6, backgroundColor: theme.cardBorder }} />}
                  <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${x.n} ${x.label}`}>
                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 28, letterSpacing: -1, color: x.n > 0 ? x.tint.ink : theme.textTertiary }}>{x.n}</Text>
                    <Text style={{ ...microLabel, marginTop: 1 }}>{x.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {examLeft !== undefined && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  marginHorizontal: 14, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.md,
                  backgroundColor: tints.danger.fill, borderWidth: 1, borderColor: tints.danger.line,
                }}
              >
                <Ionicons name="calendar" size={15} color={tints.danger.ink} />
                <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, color: tints.danger.ink, lineHeight: 16 }}>
                  {examLeft === 0 ? 'Exam today — good luck!' : `Exam in ${examLeft} day${examLeft !== 1 ? 's' : ''}. Every card will be seen before then.`}
                </Text>
                <TouchableOpacity onPress={() => openExam(node)} accessibilityRole="button" accessibilityLabel="Change exam plan" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 12, color: tints.danger.ink }}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              {due > 0 ? (
                <AnimatedPressable
                  onPress={() => startSession(node)}
                  accessibilityRole="button"
                  accessibilityLabel={`Study now, ${due} cards`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    paddingVertical: 14, borderRadius: Radius.lg,
                    backgroundColor: color, borderBottomWidth: 3, borderBottomColor: 'rgba(0,0,0,0.25)',
                  }}
                >
                  <Ionicons name="play" size={17} color="#ffffff" />
                  <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 15.5, color: '#ffffff' }}>Study now</Text>
                </AnimatedPressable>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={require('../../assets/images/sleeping.png')} style={{ width: 52, height: 52 }} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>
                      {comp.total === 0 ? 'No cards yet' : 'Done for today'}
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
                      {comp.total === 0
                        ? 'Add a few cards to start studying.'
                        : nextDue < Infinity
                        ? `Next review ${relativeDue(nextDue, clock)}.`
                        : 'Every card here is suspended or new-card limits are used up.'}
                    </Text>
                  </View>
                  {comp.total > 0 ? (
                    <TouchableOpacity
                      onPress={() => setCustomPath(node.fullPath)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      style={{ paddingHorizontal: 12, height: 34, borderRadius: Radius.full, justifyContent: 'center', backgroundColor: tints.schedule.fill, borderWidth: 1, borderColor: tints.schedule.line }}
                    >
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: tints.schedule.ink }}>Custom</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          </Card>

          <View style={{ paddingHorizontal: 2, marginBottom: 22 }}>
            <ToolTiles node={node} />
          </View>

          {/* ══ Composition ══ */}
          {comp.total > 0 && (
            <View style={{ marginBottom: 22 }}>
              <View style={{ flexDirection: 'row', height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: theme.surfaceSecondary }}>
                {legend.map((l) => (l.n > 0 ? <View key={l.key} style={{ flex: l.n, backgroundColor: l.color }} /> : null))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 }}>
                {legend.filter((l) => l.n > 0).map((l) => (
                  <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: l.color }} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                      {l.label} <Text style={{ fontFamily: 'Nunito_900Black', color: theme.text }}>{l.n}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ══ Browser ══ */}
          <SectionHeader title="Cards" count={notes.length} railColor={tints.tools.solid} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: -2, marginBottom: 10 }}>
            <AnimatedPressable
              onPress={() => openAddNote(deck?.id || scopeDecks[0]?.id || null)}
              accessibilityRole="button"
              accessibilityLabel="Add cards"
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 40, borderRadius: Radius.lg, backgroundColor: theme.primary,
                borderBottomWidth: 2, borderBottomColor: theme.primaryDark,
              }}
            >
              <Ionicons name="add" size={17} color="#ffffff" />
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: '#ffffff' }}>Add cards</Text>
            </AnimatedPressable>
            <TouchableOpacity
              onPress={() => openImport(deck?.id || scopeDecks[0]?.id || '')}
              disabled={scopeDecks.length === 0}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Import cards from text or a file"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: Radius.lg,
                backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip,
              }}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={theme.textSecondary} />
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.textSecondary }}>Import</Text>
            </TouchableOpacity>
          </View>

          {notes.length > 0 && (
            <>
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: Radius.lg, marginBottom: 10,
                  backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder,
                }}
              >
                <Ionicons name="search" size={16} color={theme.textTertiary} />
                <TextInput
                  value={detailSearch}
                  onChangeText={setDetailSearch}
                  placeholder="Search cards and tags…"
                  placeholderTextColor={theme.textTertiary}
                  accessibilityLabel="Search cards"
                  style={{ flex: 1, marginLeft: 8, fontFamily: 'Nunito_600SemiBold', fontSize: 13.5, color: theme.text, padding: 0 }}
                />
                {detailSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setDetailSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  {filterDefs
                    .filter((f) => f.key === 'all' || (filterCounts.get(f.key) || 0) > 0 || detailFilter === f.key)
                    .map((f) => {
                      const active = detailFilter === f.key;
                      return (
                        <TouchableOpacity
                          key={f.key}
                          onPress={() => setDetailFilter(f.key)}
                          activeOpacity={0.75}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${f.label}, ${filterCounts.get(f.key) || 0}`}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 30, borderRadius: Radius.full,
                            backgroundColor: active ? f.color + (isDark ? '2e' : '1a') : theme.surfaceSecondary,
                            borderWidth: 1, borderColor: active ? f.color + '77' : theme.cardBorder,
                          }}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
                          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? theme.text : theme.textSecondary }}>{f.label}</Text>
                          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary }}>{filterCounts.get(f.key) || 0}</Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12, minHeight: 30 }}>
                {isSelectionMode ? (
                  <>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text }}>{selectedNotes.size} selected</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedNotes(allSelected ? new Set() : new Set(visible.map(selKey)))}
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.primary }}>{allSelected ? 'None' : 'All'}</Text>
                    </TouchableOpacity>
                    {selectedNotes.size > 0 && (
                      <>
                        <TouchableOpacity onPress={() => handleBulkSuspend(!selectedAllSuspended)} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.primary }}>{selectedAllSuspended ? 'Unsuspend' : 'Suspend'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleBulkReverse} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.primary }}>Swap</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleBulkDelete} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: tints.danger.ink }}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      onPress={endSelection}
                      accessibilityRole="button"
                      style={{ paddingHorizontal: 14, height: 30, borderRadius: Radius.full, justifyContent: 'center', backgroundColor: theme.primary }}
                    >
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: '#ffffff' }}>Done</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => setIsSelectionMode(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Select cards"
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="checkbox-outline" size={15} color={theme.textSecondary} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {visible.length === 0 ? (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: Radius.lg,
                backgroundColor: brand.wash, borderWidth: 1, borderColor: brand.washLine,
              }}
            >
              <Ionicons name={notes.length === 0 ? 'documents-outline' : 'search-outline'} size={18} color={brand.ink} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>{notes.length === 0 ? 'No cards yet' : 'Nothing matches'}</Text>
                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginTop: 1, lineHeight: 16 }}>
                  {notes.length === 0 ? 'Add cards one at a time, or import a list you already have.' : 'Try a different search or filter.'}
                </Text>
              </View>
            </View>
          ) : (
            visible.map((n) => {
              // Buried siblings are out of today's queue, so they must not
              // make the row say "Due now" — that label is what made a
              // 3-card cloze look like it only ever quizzed c1.
              const live = n.cards.filter((card) => !isSidelined(card, clock));
              const held = n.cards.filter((card) => !card.suspended && isSidelined(card, clock)).length;
              const first = live[0] || n.cards.find((card) => !card.suspended) || n.cards[0];
              const st = cardState(first);
              const allSuspended = n.cards.every((card) => card.suspended);
              const flagged = n.cards.some((card) => card.flagged);
              const leech = n.cards.some((card) => card.leech);
              const tint = st === 'new' ? qt.new : st === 'review' ? qt.review : qt.learn;
              const soonest = Math.min(...live.map((card) => card.nextDue));
              const dueText =
                allSuspended ? 'Suspended'
                  : live.length === 0 ? 'Tomorrow'
                  : live.some((card) => cardState(card) === 'new') ? 'New'
                  : soonest <= clock ? 'Due now'
                  : new Date(soonest).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const sel = selectedNotes.has(selKey(n));
              const kind = n.kind;
              return (
                <Card
                  key={selKey(n)}
                  padding={12}
                  radius={Radius.lg}
                  onPress={() => {
                    if (isSelectionMode) {
                      const next = new Set(selectedNotes);
                      if (next.has(selKey(n))) next.delete(selKey(n));
                      else next.add(selKey(n));
                      setSelectedNotes(next);
                    } else openEditNote(n.deckId, n.noteId);
                  }}
                  accessibilityLabel={`${kind === 'cloze' ? clozePlain(n.front) : n.front}. ${dueText}. ${n.cards.length} card${n.cards.length !== 1 ? 's' : ''}.`}
                  accessibilityHint={isSelectionMode ? 'Toggles selection' : 'Opens the note for editing'}
                  style={{ marginBottom: 8, borderColor: sel ? theme.primary : theme.cardBorder, opacity: allSuspended ? 0.62 : 1 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    {isSelectionMode && (
                      <View
                        style={{
                          width: 22, height: 22, borderRadius: 7, marginRight: 11, marginTop: 1, alignItems: 'center', justifyContent: 'center',
                          borderWidth: 2, borderColor: sel ? theme.primary : isDark ? '#464d75' : '#cbd5e1', backgroundColor: sel ? theme.primary : 'transparent',
                        }}
                      >
                        {sel && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 6, flexWrap: 'wrap' }}>
                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: allSuspended ? theme.surfaceSecondary : tint.fill }}>
                          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, letterSpacing: 0.3, color: allSuspended ? theme.textTertiary : tint.ink }}>
                            {dueText.toUpperCase()}
                          </Text>
                        </View>
                        {kind !== 'basic' && (
                          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: theme.textTertiary }}>
                            {kindLabel(kind)}
                            {n.cards.length > 1 ? ` · ${n.cards.length} cards` : ''}
                          </Text>
                        )}
                        {held > 0 && live.length > 0 && (
                          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.textTertiary }}>
                            · {held} more tomorrow
                          </Text>
                        )}
                        {flagged && <Ionicons name="flag" size={11} color={tints.danger.solid} />}
                        {leech && (
                          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: tints.tasks.ink }}>LEECH</Text>
                        )}
                        {scopeDecks.length > 1 && (
                          <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: theme.textTertiary }}>
                            · {n.deckName.split('::').pop()}
                          </Text>
                        )}
                      </View>
                      {kind === 'occlusion' && n.cards[0]?.occlusion ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 76 }}>
                            <OcclusionImage data={n.cards[0].occlusion} states={maskStates({ ...n.cards[0].occlusion, mode: 'hideAll' }, -1, 'question')} isDark={isDark} maxHeight={56} />
                          </View>
                          <Text numberOfLines={2} style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text, lineHeight: 18 }}>
                            {notePreview(n).title}
                          </Text>
                        </View>
                      ) : kind === 'cloze' ? (
                        <FaceText
                          segments={clozeOverview(n.front)}
                          color={color}
                          isDark={isDark}
                          numberOfLines={3}
                          style={{ fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: theme.text, lineHeight: 19 }}
                        />
                      ) : (
                        <Text numberOfLines={2} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text, lineHeight: 18 }}>
                          {n.front}
                        </Text>
                      )}
                      {n.back ? (
                        <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary, marginTop: 2, lineHeight: 17 }}>
                          {n.back}
                        </Text>
                      ) : null}
                      {n.tags.length > 0 && (
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: theme.textTertiary, marginTop: 4 }}>
                          {n.tags.map((t) => `#${t}`).join('  ')}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: review
  // ─────────────────────────────────────────────────────────────────────────

  const renderStudy = () => {
    if (!session) return null;
    const s = session;

    if (s.done || !currentCard) {
      const secs = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
      const mins = Math.floor(secs / 60);
      const pct = s.answered > 0 ? Math.round(((s.answered - s.again) / s.answered) * 100) : 0;
      const xpGained = Math.max(0, (flashcardStats.totalXp || 0) - s.xpBefore);
      const moreDue = allDue;
      const scopedNode = s.returnTo === 'detail' ? activeNode : null;
      return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, paddingTop: 16, paddingBottom: tabBarHeight + 24 }}
            showsVerticalScrollIndicator={false}
          >
            <Image source={require('../../assets/images/happy.png')} style={{ width: 118, height: 118, marginBottom: 12 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 26, color: theme.text, textAlign: 'center', letterSpacing: -0.6 }}>
              {s.answered > 0 ? 'Congratulations!' : 'All done'}
            </Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 20, lineHeight: 20 }}>
              {s.mode === 'cram'
                ? `You went through every card in ${s.title.replace(/^Cram · /, '')}. Cramming does not change their schedule.`
                : `You have finished ${s.title === 'All decks' ? 'everything due' : s.title} for now.`}
            </Text>

            {s.answered > 0 && (
              <View
                style={{
                  width: '100%', flexDirection: 'row', paddingVertical: 16, borderRadius: Radius['3xl'], marginBottom: 12,
                  backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip,
                }}
              >
                {[
                  { key: 'cards', value: `${s.answered}`, label: 'Answered', color: theme.text },
                  { key: 'time', value: mins > 0 ? `${mins}:${String(secs % 60).padStart(2, '0')}` : `${secs}s`, label: 'Time', color: theme.text },
                  { key: 'pct', value: `${pct}%`, label: 'Recalled', color: pct >= 80 ? tints.attendance.ink : pct >= 60 ? tints.tasks.ink : tints.danger.ink },
                ].map((x, i) => (
                  <React.Fragment key={x.key}>
                    {i > 0 && <View style={{ width: 1, marginVertical: 4, backgroundColor: theme.cardBorder }} />}
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 24, color: x.color, letterSpacing: -0.8 }}>{x.value}</Text>
                      <Text style={{ ...microLabel, marginTop: 2 }}>{x.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}

            {s.answered > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 30, borderRadius: Radius.full, backgroundColor: tints.grades.fill }}>
                  <Ionicons name="star" size={13} color={tints.grades.ink} />
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: tints.grades.ink }}>+{xpGained} XP</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 30, borderRadius: Radius.full, backgroundColor: tints.tasks.fill }}>
                  <Ionicons name="flame" size={13} color={tints.tasks.ink} />
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: tints.tasks.ink }}>
                    {flashcardStats.currentStreak || 1} day streak
                  </Text>
                </View>
                {s.graduated > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 30, borderRadius: Radius.full, backgroundColor: tints.attendance.fill }}>
                    <Ionicons name="school" size={13} color={tints.attendance.ink} />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: tints.attendance.ink }}>{s.graduated} learned</Text>
                  </View>
                )}
              </View>
            )}

            {s.nextLearningAt ? (
              <View
                style={{
                  width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.lg, marginBottom: 16,
                  backgroundColor: qt.learn.fill, borderWidth: 1, borderColor: qt.learn.line,
                }}
              >
                <Ionicons name="time-outline" size={18} color={qt.learn.ink} />
                <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: qt.learn.ink, lineHeight: 17 }}>
                  Cards you are still learning come back {relativeDue(s.nextLearningAt, Date.now())}.
                </Text>
                <TouchableOpacity onPress={continueLearning} accessibilityRole="button" accessibilityLabel="Study them now" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 12.5, color: qt.learn.ink }}>Now</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                onPress={exitSession}
                activeOpacity={0.8}
                accessibilityRole="button"
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: Radius.lg, alignItems: 'center',
                  backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.textSecondary }}>
                  {scopedNode ? 'Back to deck' : 'All decks'}
                </Text>
              </TouchableOpacity>
              {moreDue > 0 && s.mode !== 'cram' ? (
                <View style={{ flex: 1 }}>
                  <PrimaryButton label={`Study all due · ${moreDue}`} onPress={() => startSession(null)} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const { deck, card } = currentCard;
    const color = deck.color || theme.primary;
    const faces = cardFaces(card, s.flip);
    const st = cardState(card);
    const ctx = { examDate: examDaysLeft(deck, clock) !== null ? deck.examDate : null };
    const previews = revealed && s.mode !== 'cram' ? previewIntervals(card, srSettings, Date.now(), ctx) : null;
    const rem = s.mode === 'cram' ? null : sessionRemaining(decks, scopeOf(s), s.queue, s.pos, Date.now());
    if (rem) {
      if (st === 'new') rem.new += 1;
      else if (st === 'review') rem.review += 1;
    }
    const remaining = rem ? rem.new + rem.learn + rem.review : Math.max(1, s.queue.length - s.pos + 1);
    const progress = s.answered / Math.max(1, s.answered + remaining);
    const queueKey = st === 'new' ? 'new' : st === 'review' ? 'review' : 'learn';
    const queueLabel = st === 'new' ? 'New' : st === 'review' ? 'Review' : st === 'relearning' ? 'Relearning' : 'Learning';
    const multiDeck = !s.deckIds || s.deckIds.length > 1;

    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8 }}>
          {iconButton('close', 'End session', exitSession)}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>
              {s.title}
            </Text>
            {rem ? (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 1 }} accessible accessibilityLabel={`${rem.new} new, ${rem.learn} learning, ${rem.review} to review`}>
                {(['new', 'learn', 'review'] as const).map((k) => (
                  <Text
                    key={k}
                    style={{
                      fontFamily: 'Nunito_900Black',
                      fontSize: 13,
                      color: qt[k].ink,
                      textDecorationLine: queueKey === k ? 'underline' : 'none',
                      opacity: rem[k] > 0 || queueKey === k ? 1 : 0.4,
                    }}
                  >
                    {rem[k]}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textTertiary }}>{remaining} left · not rescheduled</Text>
            )}
          </View>
          {iconButton('arrow-undo-outline', 'Undo last answer', handleUndo, { disabled: !undo })}
          {iconButton('ellipsis-horizontal', 'Card options', () => setShowReviewMore(true))}
        </View>

        <View style={{ paddingHorizontal: GUTTER, marginBottom: 12 }}>
          <ProgressBar progress={progress} height={6} color={color} accessibilityLabel={`${s.answered} answered, ${remaining} left`} />
        </View>

        <View style={{ flex: 1, paddingHorizontal: GUTTER }}>
          <ReviewCard
            key={card.id + ':' + s.answered}
            card={card}
            faces={faces}
            revealed={revealed}
            onReveal={revealAnswer}
            color={color}
            isDark={isDark}
            queueLabel={queueLabel}
            queueTint={qt[queueKey]}
            deckName={multiDeck ? deck.name.split('::').pop() : undefined}
            typed={typed}
            onChangeTyped={setTyped}
          />
        </View>

        <View style={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: tabBarHeight + 10 }}>
          <AnswerBar
            revealed={revealed}
            onShow={revealAnswer}
            onRate={rate}
            previews={previews}
            color={color}
            isDark={isDark}
            cram={s.mode === 'cram'}
            checkLabel={faces.typeTarget !== null ? 'Check' : undefined}
          />
        </View>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: practice test
  // ─────────────────────────────────────────────────────────────────────────

  const practiceNode = practicePath ? findNode(tree, practicePath) : null;

  const renderQuiz = () => {
    if (quizQuestions.length === 0) return null;
    const back = () => setView(practiceNode && activePath === practicePath ? 'detail' : 'decks');

    if (quizDone) {
      const pct = Math.round((quizScore / quizQuestions.length) * 100);
      const good = pct >= 70;
      return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, paddingTop: 16, paddingBottom: tabBarHeight + 24 }}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={good ? require('../../assets/images/happy.png') : require('../../assets/images/studying.png')}
              style={{ width: 110, height: 110, marginBottom: 12 }}
              resizeMode="contain"
            />
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 30, color: theme.text, letterSpacing: -0.8 }}>{pct}%</Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 14, color: theme.textSecondary, marginTop: 2, marginBottom: 20 }}>
              {quizScore} of {quizQuestions.length} correct
            </Text>

            {quizMissed.length > 0 && (
              <Card padding={16} radius={Radius['3xl']} style={{ width: '100%', marginBottom: 18 }}>
                <Text style={{ ...microLabel, marginBottom: 10 }}>To review · {quizMissed.length}</Text>
                {quizMissed.map((q, i) => (
                  <View key={i} style={{ paddingVertical: 9, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.cardBorder }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>{q.question}</Text>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: tints.attendance.ink, marginTop: 2 }}>{q.correctAnswer}</Text>
                  </View>
                ))}
              </Card>
            )}

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                onPress={back}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: Radius.lg, alignItems: 'center',
                  backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.textSecondary }}>Done</Text>
              </TouchableOpacity>
              {quizMissed.length > 0 && practiceNode ? (
                <View style={{ flex: 1 }}>
                  <PrimaryButton label={`Retry missed · ${quizMissed.length}`} onPress={() => generateQuiz(practiceNode, quizMissed)} color={tints.attendance.solid} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const q = quizQuestions[quizIndex];
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8 }}>
          {iconButton('close', 'End practice test', back)}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>Practice test</Text>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textTertiary }}>
              Question {quizIndex + 1} of {quizQuestions.length}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ paddingHorizontal: GUTTER, marginBottom: 16 }}>
          <ProgressBar progress={quizIndex / quizQuestions.length} height={6} color={tints.attendance.solid} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <Card padding={20} radius={Radius['3xl']} style={{ marginBottom: 18 }}>
            <Text style={{ ...microLabel, marginBottom: 8 }}>Question {quizIndex + 1}</Text>
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, lineHeight: 26, color: theme.text }}>{q.question}</Text>
          </Card>
          <View style={{ gap: 10 }}>
            {q.options.map((option, idx) => {
              const showResult = quizSelected !== null;
              const isCorrect = option === q.correctAnswer;
              const isSel = quizSelected === option;
              const state = showResult ? (isCorrect ? 'right' : isSel ? 'wrong' : 'dim') : 'idle';
              const t = state === 'right' ? tints.attendance : state === 'wrong' ? tints.danger : null;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleQuizAnswer(option)}
                  disabled={showResult}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Option ${String.fromCharCode(65 + idx)}: ${option}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: Radius.xl,
                    backgroundColor: t ? t.fill : theme.surface, borderWidth: 1, borderColor: t ? t.line : theme.cardBorder,
                    borderBottomWidth: 2, borderBottomColor: t ? t.line : theme.lip, opacity: state === 'dim' ? 0.55 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 28, height: 28, borderRadius: 14, marginRight: 12, alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1.5, borderColor: t ? t.ink : theme.cardBorder,
                    }}
                  >
                    {state === 'right' ? (
                      <Ionicons name="checkmark" size={16} color={t!.ink} />
                    ) : state === 'wrong' ? (
                      <Ionicons name="close" size={16} color={t!.ink} />
                    ) : (
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.textSecondary }}>{String.fromCharCode(65 + idx)}</Text>
                    )}
                  </View>
                  <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: t ? t.ink : theme.text }}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 10, paddingBottom: tabBarHeight + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={16} color={tints.attendance.solid} />
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.textSecondary }}>{quizScore}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="close-circle" size={16} color={tints.danger.solid} />
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.textSecondary }}>{quizMissed.length}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: speed match
  // ─────────────────────────────────────────────────────────────────────────

  const renderMatch = () => {
    if (matchCards.length === 0) return null;
    const back = () => setView(practiceNode && activePath === practicePath ? 'detail' : 'decks');
    const totalPairs = matchCards.length / 2;
    const clockText = `${Math.floor(matchElapsed / 60)}:${String(matchElapsed % 60).padStart(2, '0')}`;

    if (matchDone) {
      const accuracy = matchMoves > 0 ? Math.round((totalPairs / matchMoves) * 100) : 100;
      return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, paddingTop: 16, paddingBottom: tabBarHeight + 24 }}
            showsVerticalScrollIndicator={false}
          >
            <Image source={require('../../assets/images/happy.png')} style={{ width: 110, height: 110, marginBottom: 12 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 26, color: theme.text, letterSpacing: -0.6 }}>All matched!</Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 14, color: theme.textSecondary, marginTop: 2, marginBottom: 20 }}>
              {totalPairs} pairs
            </Text>
            <View
              style={{
                width: '100%', flexDirection: 'row', paddingVertical: 16, borderRadius: Radius['3xl'], marginBottom: 20,
                backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip,
              }}
            >
              {[
                { key: 't', value: clockText, label: 'Time' },
                { key: 'm', value: `${matchMoves}`, label: 'Moves' },
                { key: 'a', value: `${accuracy}%`, label: 'Accuracy' },
              ].map((x, i) => (
                <React.Fragment key={x.key}>
                  {i > 0 && <View style={{ width: 1, marginVertical: 4, backgroundColor: theme.cardBorder }} />}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 22, color: theme.text }}>{x.value}</Text>
                    <Text style={{ ...microLabel, marginTop: 2 }}>{x.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                onPress={back}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: Radius.lg, alignItems: 'center',
                  backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.textSecondary }}>Done</Text>
              </TouchableOpacity>
              {practiceNode ? (
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Play again" onPress={() => startMatch(practiceNode)} color={tints.tasks.solid} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const cols = 3;
    const tileW = (SCREEN_WIDTH - GUTTER * 2 - (cols - 1) * 8) / cols;
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8 }}>
          {iconButton('close', 'End speed match', back)}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>Speed match</Text>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textTertiary }}>
              {clockText} · {matchMoves} moves
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ paddingHorizontal: GUTTER, marginBottom: 14 }}>
          <ProgressBar progress={matchMatched.size / totalPairs} height={6} color={tints.tasks.solid} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: tabBarHeight + 24 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, textAlign: 'center', marginBottom: 12 }}>
            Tap a question, then its answer.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {matchCards.map((tile) => {
              const isRev = matchRevealed.includes(tile.id);
              const isMatched = matchMatched.has(tile.pairId);
              const wrong = matchRevealed.length === 2 && isRev && (() => {
                const [a, b] = matchRevealed.map((id) => matchCards.find((c) => c.id === id));
                return !(a && b && a.pairId === b.pairId && a.isTerm !== b.isTerm);
              })();
              const t = isMatched ? tints.attendance : wrong ? tints.danger : isRev ? tints.tasks : null;
              return (
                <TouchableOpacity
                  key={tile.id}
                  onPress={() => handleMatchTap(tile.id)}
                  disabled={isMatched || isRev}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${tile.isTerm ? 'Question' : 'Answer'}: ${tile.text}`}
                  style={{
                    width: tileW, minHeight: 92, padding: 8, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: t ? t.fill : theme.surface, borderWidth: 1, borderColor: t ? t.line : theme.cardBorder,
                    borderBottomWidth: 2, borderBottomColor: t ? t.line : theme.lip, opacity: isMatched ? 0.45 : 1,
                  }}
                >
                  <Text
                    numberOfLines={5}
                    style={{
                      fontFamily: tile.isTerm ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold',
                      fontSize: 12,
                      lineHeight: 16,
                      textAlign: 'center',
                      color: t ? t.ink : theme.text,
                    }}
                  >
                    {tile.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Sheets
  // ─────────────────────────────────────────────────────────────────────────

  const sheetRow = (opts: {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    tint: { fill: string; line: string; ink: string };
    label: string;
    desc: string;
    onPress: () => void;
    destructive?: boolean;
    right?: React.ReactNode;
  }) => (
    <TouchableOpacity
      key={opts.key}
      onPress={opts.onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${opts.label}. ${opts.desc}`}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: 12, marginRight: 12, alignItems: 'center', justifyContent: 'center',
          backgroundColor: opts.tint.fill, borderWidth: 1, borderColor: opts.tint.line,
        }}
      >
        <Ionicons name={opts.icon} size={17} color={opts.tint.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: opts.destructive ? opts.tint.ink : theme.text }}>{opts.label}</Text>
        <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
          {opts.desc}
        </Text>
      </View>
      {opts.right}
    </TouchableOpacity>
  );

  /** Let a sheet finish dismissing before an alert or another sheet lands on it. */
  const after = (close: () => void, fn: () => void) => {
    close();
    setTimeout(fn, 240);
  };

  const renderCreateSheet = () => (
    <KeyboardSheet
      visible={showCreateSheet}
      onClose={() => setShowCreateSheet(false)}
      title="Create"
      subtitle="Cards live in decks. Folders group decks."
      icon="add-circle-outline"
      tint={tints.grades}
      maxHeightRatio={0.6}
    >
      {decks.length > 0 &&
        sheetRow({
          key: 'cards',
          icon: 'documents-outline',
          tint: tints.grades,
          label: 'Add cards',
          desc: 'Basic, both ways, cloze or type-in',
          onPress: () => after(() => setShowCreateSheet(false), () => openAddNote(null)),
        })}
      {sheetRow({ key: 'deck', icon: 'albums-outline', tint: tints.schedule, label: 'New deck', desc: 'A set of cards you study together', onPress: () => openAddDeck() })}
      {sheetRow({ key: 'folder', icon: 'folder-outline', tint: tints.tasks, label: 'New folder', desc: 'Group decks, e.g. BIOL101::Unit 2', onPress: () => openAddDeck('::') })}
      {sheetRow({
        key: 'sample',
        icon: 'sparkles-outline',
        tint: tints.tools,
        label: 'Sample deck',
        desc: 'Six cards that show every card type',
        onPress: () => after(() => setShowCreateSheet(false), addSampleDeck),
      })}
    </KeyboardSheet>
  );

  const renderDeckActionSheet = () => {
    const node = actionPath ? findNode(tree, actionPath) : null;
    const deck = node?.deck ? deckById(node.deck.id) : null;
    const close = () => setActionPath(null);
    const inExam = node ? collectDecksFromNode(node).some((d) => examDaysLeft(d) !== null) : false;
    const groups = node
      ? [
          [
            { key: 'study', icon: 'play-circle-outline' as const, tint: tints.grades, label: 'Study now', desc: 'Review what is due', onPress: () => startSession(node) },
            { key: 'custom', icon: 'flash-outline' as const, tint: tints.schedule, label: 'Custom study', desc: 'Review ahead, extra new cards, or cram', onPress: () => setCustomPath(node.fullPath) },
            {
              key: 'exam', icon: 'calendar-outline' as const, tint: tints.danger,
              label: inExam ? 'Exam plan' : 'Exam prep', desc: inExam ? 'Change the date or end exam mode' : 'Have every card reviewed before a date', onPress: () => openExam(node),
            },
          ],
          [
            ...(view !== 'detail' ? [{ key: 'open', icon: 'list-outline' as const, tint: tints.tools, label: 'Browse cards', desc: 'Search, edit, suspend and bulk-select', onPress: () => openNode(node) }] : []),
            ...(deck ? [{ key: 'add', icon: 'add-circle-outline' as const, tint: tints.tools, label: 'Add cards', desc: 'Basic, both ways, cloze or type-in', onPress: () => openAddNote(deck.id) }] : []),
            ...(deck ? [{ key: 'import', icon: 'cloud-upload-outline' as const, tint: tints.tools, label: 'Import', desc: 'Paste a list or upload a .txt or .csv', onPress: () => openImport(deck.id) }] : []),
            { key: 'sub', icon: 'git-branch-outline' as const, tint: tints.tools, label: 'Add sub-deck', desc: 'Nest a new deck under this one', onPress: () => openAddSubNode(node) },
            ...(deck
              ? [
                  { key: 'edit', icon: 'create-outline' as const, tint: tints.tools, label: 'Edit deck', desc: 'Name, subject, colour and icon', onPress: () => openEditDeck(deck) },
                  { key: 'dup', icon: 'copy-outline' as const, tint: tints.tools, label: 'Duplicate', desc: 'Copy the deck and all its cards', onPress: () => handleDuplicateDeck(deck) },
                  { key: 'move', icon: 'move-outline' as const, tint: tints.tools, label: 'Move', desc: 'Put it under a different folder', onPress: () => handleMoveDeck(node) },
                ]
              : []),
            { key: 'export', icon: 'share-outline' as const, tint: tints.tools, label: 'Export', desc: 'Share the cards as CSV text', onPress: () => handleExportDeck(node) },
          ],
          [
            { key: 'reset', icon: 'refresh-outline' as const, tint: tints.tasks, label: 'Reset progress', desc: 'Keeps the cards, starts them over as new', onPress: () => handleResetProgress(node) },
            {
              key: 'delete', icon: 'trash-outline' as const, tint: tints.danger,
              label: deck && node.children.size === 0 ? 'Delete deck' : 'Delete folder', desc: 'Removes the cards permanently', onPress: () => handleDeleteNode(node), destructive: true,
            },
          ],
        ]
      : [];

    return (
      <KeyboardSheet
        visible={Boolean(node)}
        onClose={close}
        title={node?.name || ''}
        subtitle={node && node.fullPath !== node.name ? node.fullPath : undefined}
        icon={deck ? 'albums-outline' : 'folder-outline'}
        tint={tints.grades}
      >
        {groups.map((items, gi) => (
          <View key={gi} style={{ marginTop: gi === 0 ? 0 : 8, paddingTop: gi === 0 ? 0 : 8, borderTopWidth: gi === 0 ? 0 : 1, borderTopColor: theme.cardBorder }}>
            {items.map((a: any) => sheetRow({ ...a, onPress: () => after(close, a.onPress) }))}
          </View>
        ))}
      </KeyboardSheet>
    );
  };

  const renderDeckForm = () => (
    <KeyboardSheet
      visible={showDeckForm}
      onClose={() => setShowDeckForm(false)}
      title={editingDeckId ? 'Edit deck' : 'New deck'}
      subtitle="Use :: in the name to nest it under a folder"
      icon="albums-outline"
      tint={tints.grades}
      footer={<PrimaryButton label={editingDeckId ? 'Save changes' : 'Create deck'} onPress={handleSaveDeck} />}
    >
      <Text style={{ ...microLabel, marginBottom: 8 }}>Deck name</Text>
      <TextInput
        style={{ ...fieldStyle, marginBottom: 18 }}
        placeholder="e.g. Biology Chapter 3"
        placeholderTextColor={theme.textTertiary}
        value={deckForm.name}
        onChangeText={(t) => setDeckForm({ ...deckForm, name: t })}
        accessibilityLabel="Deck name"
        returnKeyType="next"
      />

      <Text style={{ ...microLabel, marginBottom: 8 }}>Subject tag (optional)</Text>
      {currentSubjects.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {currentSubjects.map((sub: any) => {
              const active = deckForm.subject === sub.name;
              return (
                <TouchableOpacity
                  key={sub.id}
                  onPress={() => setDeckForm({ ...deckForm, subject: active ? '' : sub.name })}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: 12, height: 30, borderRadius: Radius.full, justifyContent: 'center',
                    backgroundColor: active ? tints.grades.fill : theme.surfaceSecondary, borderWidth: 1, borderColor: active ? tints.grades.line : theme.cardBorder,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? tints.grades.ink : theme.textSecondary }}>{sub.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
      <TextInput
        style={{ ...fieldStyle, marginBottom: 18 }}
        placeholder="e.g. BIOL101 (or pick one above)"
        placeholderTextColor={theme.textTertiary}
        value={deckForm.subject}
        onChangeText={(t) => setDeckForm({ ...deckForm, subject: t })}
        accessibilityLabel="Subject tag"
      />

      <Text style={{ ...microLabel, marginBottom: 10 }}>Accent colour</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {DECK_COLORS.map((c) => {
          const active = deckForm.color === c;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => setDeckForm({ ...deckForm, color: c })}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Accent colour ${c}`}
              accessibilityState={{ selected: active }}
              style={{
                width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c,
                borderWidth: active ? 3 : 1, borderColor: active ? theme.text : theme.cardBorder,
              }}
            >
              {active && <Ionicons name="checkmark" size={17} color="#ffffff" />}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ ...microLabel, marginBottom: 10 }}>Deck icon</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        {DECK_ICONS.map((iconName) => {
          const active = deckForm.icon === iconName;
          return (
            <TouchableOpacity
              key={iconName}
              onPress={() => setDeckForm({ ...deckForm, icon: iconName })}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Icon ${iconName}`}
              accessibilityState={{ selected: active }}
              style={{
                width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
                backgroundColor: active ? deckForm.color + (isDark ? '30' : '20') : theme.surfaceSecondary,
                borderWidth: active ? 2 : 1, borderColor: active ? deckForm.color : theme.cardBorder,
              }}
            >
              <Ionicons name={iconName as any} size={19} color={active ? deckForm.color : theme.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </KeyboardSheet>
  );

  const renderImportSheet = () => {
    const deck = deckById(importDeckId);
    const analysis = analyzeImport(importText, importSeparator, importKind, deck?.cards || []);
    const hasText = importText.trim().length > 0;
    const kindInfo = NOTE_KINDS.find((k) => k.kind === importKind);
    const mono = { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12.5 } as const;

    const optionChip = (active: boolean) => ({
      flex: 1, minHeight: 40, paddingHorizontal: 6, borderRadius: Radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: active ? tints.tools.fill : theme.surfaceSecondary, borderWidth: 1, borderColor: active ? tints.tools.line : theme.cardBorder,
    });

    return (
      <KeyboardSheet
        visible={showImport}
        onClose={() => setShowImport(false)}
        title="Import cards"
        subtitle={deck ? `Into ${deck.name}` : undefined}
        icon="cloud-upload-outline"
        tint={tints.tools}
        footer={
          <PrimaryButton
            label={
              !hasText
                ? 'Paste or upload your cards first'
                : analysis.cardCount > 0
                ? `Import ${analysis.cardCount} card${analysis.cardCount !== 1 ? 's' : ''}`
                : 'Nothing to import yet'
            }
            onPress={handleConfirmImport}
            disabled={analysis.cardCount === 0}
          />
        }
      >
        {/* ══ How it works — the one rule, shown as an example rather than
            described, with the special cases one tap away. ══ */}
        <View style={{ borderRadius: Radius.lg, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: tints.tools.line }}>
          <View style={{ padding: 12, backgroundColor: tints.tools.fill }}>
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 14, color: theme.text }}>One card per line: the front, a comma, then the back.</Text>
            <View style={{ marginTop: 8, padding: 10, borderRadius: Radius.md, backgroundColor: theme.surface, borderWidth: 1, borderColor: tints.tools.line }}>
              <Text style={{ ...mono, color: theme.text }}>
                heart<Text style={{ color: tints.tools.ink, fontWeight: '900' }}>,</Text> pumps blood around the body{'\n'}
                mitosis<Text style={{ color: tints.tools.ink, fontWeight: '900' }}>,</Text> cell division into two cells
              </Text>
            </View>
            <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textSecondary, marginTop: 6 }}>
              That makes 2 cards: "heart" on the front, "pumps blood around the body" on the back.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowImportHelp((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: showImportHelp }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface }}
          >
            <Ionicons name="help-circle-outline" size={15} color={tints.tools.ink} />
            <Text style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: tints.tools.ink }}>Spreadsheets, fill-in-the-blank and other formats</Text>
            <Ionicons name={showImportHelp ? 'chevron-up' : 'chevron-down'} size={15} color={tints.tools.ink} />
          </TouchableOpacity>
          {showImportHelp && (
            <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10, backgroundColor: theme.surface }}>
              {[
                { icon: 'grid-outline' as const, title: 'From Excel or Google Sheets', body: 'Put fronts in column A and backs in column B, select both columns, copy and paste here. Or save as .csv and upload it. A "Front, Back" header row is ignored.' },
                { icon: 'eye-off-outline' as const, title: 'Fill-in-the-blank (cloze)', body: 'Wrap the hidden part like {{c1::this}}. "The {{c1::heart}} has four chambers" becomes a card that hides "heart". Use {{c1::…}} and {{c2::…}} for two separate cards. No comma needed.' },
                { icon: 'information-circle-outline' as const, title: 'Cloze with extra details', body: 'To show extra info only with the answer, put it after the sentence with a | (or a tab or ;):\nThe {{c1::heart}} has four chambers | Pumps about 5 L of blood a minute\nFrom a spreadsheet: sentence in column A, extra in column B. Using commas? Quote the sentence: "The {{c1::heart}}, not the lungs, pumps blood", Extra here' },
                { icon: 'code-working-outline' as const, title: 'A comma inside the front', body: 'Put the front in double quotes: "Hello, world", a greeting. Commas in the back are fine as they are.' },
                { icon: 'swap-horizontal-outline' as const, title: 'Semicolons, tabs or | instead', body: 'Leave the separator on Auto and each line is read with whichever one it uses. From Anki, export as "Notes in Plain Text".' },
                { icon: 'chatbox-ellipses-outline' as const, title: 'Lines starting with # or //', body: 'Treated as notes to yourself and skipped.' },
              ].map((tip) => (
                <View key={tip.title} style={{ flexDirection: 'row', gap: 9 }}>
                  <Ionicons name={tip.icon} size={15} color={theme.textSecondary} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text }}>{tip.title}</Text>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginTop: 1 }}>{tip.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ══ 1 · The cards ══ */}
        <Text style={{ ...microLabel, marginBottom: 8 }}>1 · Paste your cards or upload a file</Text>
        <TextInput
          value={importText}
          onChangeText={(t) => {
            setImportText(t);
            if (importFileName) setImportFileName('');
          }}
          multiline
          placeholder={'heart, pumps blood around the body\nmitosis, cell division into two cells'}
          placeholderTextColor={theme.textTertiary}
          accessibilityLabel="Cards to import, one per line"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ ...fieldStyle, minHeight: 120, maxHeight: 220, textAlignVertical: 'top', fontSize: 14, marginBottom: 8 }}
        />
        <TouchableOpacity
          onPress={handlePickFile}
          disabled={importLoading}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Upload a text or CSV file"
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: Radius.lg, marginBottom: 16,
            borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? '#3d4468' : '#cbd5e1',
          }}
        >
          {importLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <>
              <Ionicons name={importFileName ? 'document-text' : 'document-attach-outline'} size={17} color={theme.textSecondary} />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>
                {importFileName ? `${importFileName} loaded · tap to pick another` : 'Upload a .txt or .csv file instead'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ══ 2 · What each line becomes ══ */}
        <Text style={{ ...microLabel, marginBottom: 8 }}>2 · Make each line into</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {NOTE_KINDS.filter((k) => k.kind !== 'cloze' && k.kind !== 'occlusion').map((k) => {
            const active = importKind === k.kind;
            return (
              <TouchableOpacity
                key={k.kind}
                onPress={() => setImportKind(k.kind as any)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${k.label}. ${k.desc}`}
                style={{ ...optionChip(active), flexDirection: 'row', gap: 5 }}
              >
                <Ionicons name={k.icon as any} size={13} color={active ? tints.tools.ink : theme.textSecondary} />
                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: active ? tints.tools.ink : theme.textSecondary }}>{k.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 6, marginBottom: 16 }}>
          {kindInfo?.desc}. Lines with {'{{c1::…}}'} always become fill-in-the-blank cards, with anything after a | kept as extra info for the answer.
        </Text>

        {/* ══ 3 · Separator ══ */}
        <Text style={{ ...microLabel, marginBottom: 8 }}>3 · Between front and back</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          {(['auto', 'comma', 'semicolon', 'tab', 'pipe'] as const).map((sep) => {
            const active = importSeparator === sep;
            const glyph = sep === 'auto' ? 'Auto' : sep === 'comma' ? ',' : sep === 'semicolon' ? ';' : sep === 'pipe' ? '|' : 'Tab';
            return (
              <TouchableOpacity
                key={sep}
                onPress={() => setImportSeparator(sep)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={sep === 'auto' ? 'Detect the separator on each line' : `Separate with ${sep}`}
                style={{ ...optionChip(active), flex: sep === 'auto' ? 1.4 : 1 }}
              >
                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: sep === 'auto' || sep === 'tab' ? 12.5 : 16, color: active ? tints.tools.ink : theme.textSecondary }}>{glyph}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginBottom: 16 }}>
          {importSeparator === 'auto'
            ? 'Auto reads each line with whichever of , ; tab or | it uses. Only change this if cards split in the wrong place.'
            : `Only lines with ${importSeparator === 'tab' ? 'a tab' : `"${importSeparator === 'comma' ? ',' : importSeparator === 'semicolon' ? ';' : '|'}"`} between front and back will import.`}
        </Text>

        {/* ══ Result, live ══ */}
        {hasText && (
          <>
            <Text style={{ ...microLabel, marginBottom: 8 }}>Preview</Text>
            <View style={{ gap: 6, marginBottom: 10 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: Radius.md,
                backgroundColor: analysis.cardCount > 0 ? tints.attendance.fill : tints.danger.fill,
                borderWidth: 1, borderColor: analysis.cardCount > 0 ? tints.attendance.line : tints.danger.line,
              }}>
                <Ionicons name={analysis.cardCount > 0 ? 'checkmark-circle' : 'alert-circle'} size={17} color={analysis.cardCount > 0 ? tints.attendance.ink : tints.danger.ink} />
                <Text style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: analysis.cardCount > 0 ? tints.attendance.ink : tints.danger.ink }}>
                  {analysis.cardCount > 0
                    ? `${analysis.cardCount} card${analysis.cardCount !== 1 ? 's' : ''} ready${analysis.notes.length !== analysis.cardCount ? ` from ${analysis.notes.length} line${analysis.notes.length !== 1 ? 's' : ''}` : ''}`
                    : 'No cards found yet. Check the example above.'}
                </Text>
              </View>

              {analysis.headerSkipped && (
                <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textSecondary, paddingHorizontal: 2 }}>
                  The first line looked like a header ("Front, Back"), so it was left out.
                </Text>
              )}
              {analysis.duplicates > 0 && (
                <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.textSecondary, paddingHorizontal: 2 }}>
                  {analysis.duplicates} duplicate{analysis.duplicates !== 1 ? 's' : ''} left out: already in this deck or repeated in your list.
                </Text>
              )}
              {analysis.skipped.length > 0 && (
                <View style={{ padding: 10, borderRadius: Radius.md, backgroundColor: tints.tasks.fill, borderWidth: 1, borderColor: tints.tasks.line }}>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: tints.tasks.ink, marginBottom: 4 }}>
                    {analysis.skipped.length} line{analysis.skipped.length !== 1 ? 's' : ''} won't import
                  </Text>
                  {analysis.skipped.slice(0, 3).map((sk) => (
                    <Text key={sk.line} numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', color: theme.text }}>Line {sk.line}</Text> "{sk.text.length > 36 ? `${sk.text.slice(0, 36)}…` : sk.text}" · {sk.reason}
                    </Text>
                  ))}
                  {analysis.skipped.length > 3 && (
                    <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textTertiary, marginTop: 2 }}>…and {analysis.skipped.length - 3} more</Text>
                  )}
                </View>
              )}
            </View>

            {analysis.notes.slice(0, 5).map((n, idx) => (
              <Card key={idx} variant="sunken" padding={11} radius={Radius.md} style={{ marginBottom: 6 }}>
                {n.kind === 'cloze' ? (
                  <>
                    <FaceText segments={clozeOverview(n.front)} color={deck?.color || theme.primary} isDark={isDark} numberOfLines={2} style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.text }} />
                    {n.back ? (
                      <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary, marginTop: 5 }}>
                        <Text style={{ ...microLabel, fontSize: 8.5 }}>Extra  </Text>{n.back}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...microLabel, fontSize: 8.5 }}>Front</Text>
                      <Text numberOfLines={2} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text, marginTop: 1 }}>{n.front}</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: theme.cardBorder }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...microLabel, fontSize: 8.5 }}>Back</Text>
                      <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textSecondary, marginTop: 1 }}>{n.back}</Text>
                    </View>
                  </View>
                )}
              </Card>
            ))}
            {analysis.notes.length > 5 && (
              <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, textAlign: 'center', paddingVertical: 6 }}>
                …and {analysis.notes.length - 5} more
              </Text>
            )}
          </>
        )}
      </KeyboardSheet>
    );
  };

  const renderExamSheet = () => {
    const node = examPath ? findNode(tree, examPath) : null;
    const key = getLocalDateString(examDate);
    const scope = node ? collectDecksFromNode(node) : [];
    const now = Date.now();
    const daysLeft = Math.max(0, Math.round((studyDayStart(examDate.getTime()) - studyDayStart(now)) / 86400000));
    const newCards = scope.reduce((s, d) => s + (d.cards || []).filter((c) => c && !c.suspended && cardState(c) === 'new').length, 0);
    const pulled = scope.reduce((s, d) => s + examPullCount(d.cards || [], key, now), 0);
    const perDay = Math.ceil(newCards / Math.max(1, daysLeft));
    const inExam = scope.some((d) => examDaysLeft(d) !== null);
    const urgency = daysLeft <= 1 ? tints.danger : daysLeft <= 7 ? tints.tasks : tints.attendance;
    return (
      <KeyboardSheet
        visible={Boolean(node)}
        onClose={() => setExamPath(null)}
        title="Exam prep"
        subtitle={node ? node.name : undefined}
        icon="calendar-outline"
        tint={tints.danger}
        footer={
          node ? (
            <View style={{ gap: 4 }}>
              <PrimaryButton label={inExam ? 'Update exam plan' : 'Start exam mode'} onPress={() => applyExam(node)} color={tints.danger.solid} />
              {inExam && (
                <TouchableOpacity onPress={() => endExam(node)} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.textSecondary }}>End exam mode</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : undefined
        }
      >
        <Text style={{ ...microLabel, marginBottom: 8 }}>When is the exam?</Text>
        <TouchableOpacity
          onPress={() => setExamShowPicker(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Exam date, ${examDate.toDateString()}. Tap to change.`}
          style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 52, borderRadius: Radius.lg, marginBottom: 10,
            backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder,
          }}
        >
          <Ionicons name="calendar" size={18} color={tints.danger.ink} style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>
            {examDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
        {examShowPicker && (
          <DateTimePicker
            value={examDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(_e, d) => {
              setExamShowPicker(false);
              if (d) setExamDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
            }}
          />
        )}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md, marginBottom: 16,
            backgroundColor: urgency.fill, borderWidth: 1, borderColor: urgency.line,
          }}
        >
          <Ionicons name={daysLeft <= 3 ? 'alert-circle-outline' : 'information-circle-outline'} size={16} color={urgency.ink} />
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: urgency.ink, marginLeft: 7 }}>
            {daysLeft === 0 ? 'The exam is today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} to go`}
          </Text>
        </View>

        <Text style={{ ...microLabel, marginBottom: 8 }}>What exam mode does</Text>
        {[
          {
            icon: 'sparkles-outline' as const,
            text: newCards > 0 ? `Introduces all ${newCards} new card${newCards !== 1 ? 's' : ''} before then — about ${perDay} a day` : 'Every card here has been studied at least once',
          },
          {
            icon: 'arrow-undo-outline' as const,
            text: pulled > 0 ? `Brings ${pulled} review${pulled !== 1 ? 's' : ''} that would land after the exam forward, spread across the days left` : 'No reviews need moving — nothing lands after the exam',
          },
          { icon: 'shield-checkmark-outline' as const, text: 'Never schedules a card past exam day. After the exam, spacing goes back to normal.' },
        ].map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: tints.danger.fill }}>
              <Ionicons name={x.icon} size={14} color={tints.danger.ink} />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, lineHeight: 18, color: theme.text, marginTop: 4 }}>{x.text}</Text>
          </View>
        ))}
      </KeyboardSheet>
    );
  };

  const renderMoveSheet = () => {
    const deck = deckById(movingDeckId);
    const paths = new Set<string>();
    decks.forEach((d) => {
      const parts = (d.subject || '').split('::').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('::') + '::');
    });
    const options = ['', ...Array.from(paths).slice(0, 12)];
    return (
      <KeyboardSheet
        visible={Boolean(deck)}
        onClose={() => setMovingDeckId(null)}
        title="Move deck"
        subtitle={deck ? deck.name : undefined}
        icon="move-outline"
        tint={tints.tools}
        footer={<PrimaryButton label="Move here" onPress={confirmMoveDeck} />}
      >
        <Text style={{ ...microLabel, marginBottom: 8 }}>Destination folder</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {options.map((path) => {
            const active = moveTargetPath === path;
            return (
              <TouchableOpacity
                key={path || '__root__'}
                onPress={() => setMoveTargetPath(path)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={path ? `Move under ${path}` : 'Move to top level'}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 32, borderRadius: Radius.full,
                  backgroundColor: active ? tints.tools.fill : theme.surfaceSecondary, borderWidth: 1, borderColor: active ? tints.tools.line : theme.cardBorder,
                }}
              >
                <Ionicons name={path ? 'folder-outline' : 'home-outline'} size={13} color={active ? tints.tools.ink : theme.textTertiary} />
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: active ? tints.tools.ink : theme.textSecondary }}>{path || 'Top level'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{ ...microLabel, marginBottom: 8 }}>Or type a path</Text>
        <TextInput
          value={moveTargetPath}
          onChangeText={setMoveTargetPath}
          placeholder="e.g. BIOL101:: — leave empty for top level"
          placeholderTextColor={theme.textTertiary}
          accessibilityLabel="Destination path"
          style={{ ...fieldStyle, marginBottom: 6 }}
        />
        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, lineHeight: 15 }}>
          "::" nests one level. "BIOL101::Unit 2::" puts the deck two folders deep.
        </Text>
      </KeyboardSheet>
    );
  };

  const renderCustomStudySheet = () => {
    const node = customNode;
    const visible = customPath !== undefined;
    const close = () => setCustomPath(undefined);
    const now = Date.now();
    const horizon = studyDayStart(now, 8);
    const aheadCount = customScope.reduce(
      (s, d) => s + (d.cards || []).filter((c) => c && !isSidelined(c, now) && cardState(c) === 'review' && c.nextDue > now && c.nextDue <= horizon).length,
      0
    );
    const newLeft = customScope.reduce((s, d) => s + (d.cards || []).filter((c) => c && !isSidelined(c, now) && cardState(c) === 'new').length, 0);
    const all = customScope.reduce((s, d) => s + (d.cards || []).filter((c) => c && !c.suspended).length, 0);
    const scopeNode = node ?? null;
    return (
      <KeyboardSheet visible={visible} onClose={close} title="Custom study" subtitle={node ? node.name : 'All decks'} icon="flash-outline" tint={tints.schedule}>
        {sheetRow({
          key: 'ahead',
          icon: 'play-forward-outline',
          tint: tints.schedule,
          label: 'Review ahead',
          desc: aheadCount > 0 ? `${aheadCount} card${aheadCount !== 1 ? 's' : ''} due in the next 7 days. Early reviews count less, so use it before a break.` : 'Nothing is due in the next 7 days.',
          onPress: () => aheadCount > 0 && after(close, () => startSession(scopeNode, 'ahead', 7)),
        })}
        {sheetRow({
          key: 'new',
          icon: 'add-circle-outline',
          tint: qt.new,
          label: 'Learn 10 more new cards',
          desc: newLeft > 0 ? `Raises today's new-card limit. ${newLeft} unseen card${newLeft !== 1 ? 's' : ''} left.` : 'There are no new cards left here.',
          onPress: () =>
            newLeft > 0 &&
            after(close, () => {
              const nd = addNewBonus(scopeNode, 10);
              startSession(scopeNode, 'normal', 7, nd);
            }),
        })}
        {sheetRow({
          key: 'cram',
          icon: 'shuffle-outline',
          tint: tints.tasks,
          label: 'Cram everything',
          desc: all > 0 ? `All ${all} cards, shuffled. Doesn't change when they come up next.` : 'No cards to cram.',
          onPress: () => all > 0 && after(close, () => startSession(scopeNode, 'cram')),
        })}
      </KeyboardSheet>
    );
  };

  const renderReviewMore = () => {
    if (!session || !currentCard) return null;
    const { deck, card } = currentCard;
    const close = () => setShowReviewMore(false);
    const st = cardState(card);
    const now = Date.now();
    const elapsed = card.lastReview ? Math.max(0, (now - card.lastReview) / 86400000) : 0;
    const r = card.stability ? retrievability(elapsed, card.stability) : null;
    const info: { label: string; value: string }[] = [
      { label: 'Type', value: kindLabel(kindOf(card)) + (kindOf(card) === 'cloze' ? ` · blank ${card.ord || 1}` : kindOf(card) === 'reversed' ? (card.ord === 1 ? ' · back → front' : ' · front → back') : '') },
      { label: 'State', value: st === 'new' ? 'New' : st === 'review' ? 'Review' : st === 'relearning' ? 'Relearning' : 'Learning' },
      { label: 'Reviews', value: `${card.reviewCount || 0}` + (card.lapses ? ` · forgotten ${card.lapses}×` : '') },
      ...(card.interval > 0 ? [{ label: 'Interval', value: formatInterval(card.interval * 1440) }] : []),
      ...(st !== 'new' ? [{ label: 'Due', value: new Date(card.nextDue).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }] : []),
      ...(card.stability ? [{ label: 'Memory', value: `lasts ~${formatInterval(card.stability * 1440)} at 90%` }] : []),
      ...(r !== null && st !== 'new' ? [{ label: 'Recall now', value: `${Math.round(r * 100)}%` }] : []),
      ...(card.difficulty ? [{ label: 'Difficulty', value: `${Math.round(card.difficulty * 10) / 10} / 10` }] : []),
    ];
    return (
      <KeyboardSheet visible={showReviewMore} onClose={close} title="This card" subtitle={deck.name} icon="albums-outline" tint={tints.grades}>
        {sheetRow({
          key: 'edit', icon: 'create-outline', tint: tints.grades, label: 'Edit note', desc: 'Fix the wording — its progress is kept',
          onPress: () => after(close, () => openEditNote(deck.id, noteIdOf(card))),
        })}
        {sheetRow({
          key: 'flag', icon: card.flagged ? 'flag' : 'flag-outline', tint: tints.danger,
          label: card.flagged ? 'Remove flag' : 'Flag', desc: 'Mark it to find later in the card browser',
          onPress: () => {
            close();
            patchCurrent((c) => {
              if (c.flagged) {
                const { flagged: _f, ...rest } = c;
                return rest;
              }
              return { ...c, flagged: true };
            }, false);
          },
        })}
        {sheetRow({
          key: 'bury', icon: 'moon-outline', tint: tints.schedule, label: 'Bury until tomorrow', desc: 'Skip it today; it comes back tomorrow',
          onPress: () => {
            close();
            patchCurrent((c) => {
              // A hand burial: no reason, so turning sibling burying off leaves it be.
              const { buriedReason: _r, ...rest } = c;
              return { ...rest, buriedUntil: studyDayKey(studyDayStart(Date.now(), 1)) };
            }, true);
          },
        })}
        {sheetRow({
          key: 'suspend', icon: 'pause-circle-outline', tint: tints.tasks, label: 'Suspend', desc: 'Stop showing it until you unsuspend it in the browser',
          onPress: () => {
            close();
            patchCurrent((c) => ({ ...c, suspended: true }), true);
          },
        })}
        {kindOf(card) !== 'cloze' &&
          sheetRow({
            key: 'flip', icon: 'swap-vertical', tint: tints.tools, label: session.flip ? 'Question first' : 'Answer first',
            desc: 'Flip the sides for the rest of this session',
            onPress: () => {
              close();
              setSession({ ...session, flip: !session.flip });
              setRevealed(false);
            },
          })}

        <View style={{ marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
          <Text style={{ ...microLabel, marginBottom: 8 }}>Card info</Text>
          {info.map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', paddingVertical: 5 }}>
              <Text style={{ width: 96, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textTertiary }}>{row.label}</Text>
              <Text style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text }}>{row.value}</Text>
            </View>
          ))}
        </View>
      </KeyboardSheet>
    );
  };

  const renderDeckPicker = () => {
    const rows = allNodes(tree);
    const titles: Record<PracticeAction, string> = { quiz: 'Practice test', match: 'Speed match', exam: 'Exam prep', custom: 'Custom study' };
    return (
      <KeyboardSheet
        visible={pickerAction !== null}
        onClose={() => setPickerAction(null)}
        title={pickerAction ? titles[pickerAction] : ''}
        subtitle="Which deck?"
        icon="albums-outline"
        tint={tints.grades}
      >
        {rows.map(({ node, depth }) => (
          <TouchableOpacity
            key={node.fullPath}
            onPress={() => {
              const action = pickerAction;
              after(() => setPickerAction(null), () => action && runPractice(action, node));
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: depth * 18 }}
          >
            <View
              style={{
                width: 32, height: 32, borderRadius: 10, marginRight: 11, alignItems: 'center', justifyContent: 'center',
                backgroundColor: (node.deck?.color || theme.primary) + (isDark ? '2e' : '1a'),
              }}
            >
              <Ionicons
                name={(node.children.size > 0 && !node.deck ? 'folder-outline' : node.deck?.icon || getDeckThematicIcon(node.deck?.subject, node.name)) as any}
                size={16}
                color={node.deck?.color || theme.primary}
              />
            </View>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>{node.name}</Text>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary }}>{totalFor(node)}</Text>
          </TouchableOpacity>
        ))}
      </KeyboardSheet>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Root
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {view === 'decks' && renderHome()}
      {view === 'detail' && (activeNode ? renderDetail() : renderHome())}
      {view === 'study' && renderStudy()}
      {view === 'quiz' && renderQuiz()}
      {view === 'match' && renderMatch()}

      {renderCreateSheet()}
      {renderDeckActionSheet()}
      {renderDeckForm()}
      {renderImportSheet()}
      {renderExamSheet()}
      {renderMoveSheet()}
      {renderCustomStudySheet()}
      {renderReviewMore()}
      {renderDeckPicker()}
      <StatsSheet visible={showStats} onClose={() => setShowStats(false)} isDark={isDark} decks={decks} stats={flashcardStats} />
      <NoteEditorSheet
        visible={noteEditor.visible}
        onClose={() => setNoteEditor((prev) => ({ ...prev, visible: false }))}
        isDark={isDark}
        decks={decks}
        deckId={noteEditor.deckId}
        note={noteEditor.note}
        defaultKind={lastKind}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
      />
    </>
  );
}
