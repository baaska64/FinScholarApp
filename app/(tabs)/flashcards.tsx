import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Image,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { SyncService } from '@/services/SyncService';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import ProgressBar from '@/components/ui/ProgressBar';
import Card from '@/components/ui/Card';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';
import { useScreenTour } from '@/components/spotlight/useScreenTour';
import { SPOTLIGHT_IDS, TOUR_KEYS, STUDY_TOUR } from '@/constants/tours';

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
  ExamScheduleSlot,
  StudyViewMode,
} from '@/components/study/types';
import {
  DEFAULT_SR_SETTINGS,
  DECK_COLORS,
  DECK_ICONS,
  STATUS_CONFIG,
  generateId,
  applyRating,
  makeNewCard,
  buildDeckTree,
  getNodeStats,
  collectCards,
  collectDecksFromNode,
  parseImport,
  computeExamPlan,
  getCardStatus,
  getNextDueText,
  getDeckThematicIcon,
  updateStudyStats,
  calculateLevel,
} from '@/components/study';
import StudyDashboardStats from '@/components/study/StudyDashboardStats';
import StudyModesStrip from '@/components/study/StudyModesStrip';
import DeckTreeItem from '@/components/study/DeckTreeItem';
import { useTabBarHeight } from '@/components/CustomTabBar';

export { Flashcard, FlashcardDeck, SessionCard, DeckNode, NodeStats, SRSettings, FlashcardStats };
export { buildDeckTree, getNodeStats, collectCards, DEFAULT_SR_SETTINGS };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HEIGHT = 260;

/** Page gutter, matched to the dashboard and schedule tabs. */
const GUTTER = 14;

// ─── FlipCard Component ───────────────────────────────────────────────────────

interface FlipCardProps {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
  color: string;
  isDark: boolean;
  frontLabel?: string;
  backLabel?: string;
}

function FlipCard({
  front,
  back,
  isFlipped,
  onFlip,
  color,
  isDark,
  frontLabel = 'QUESTION',
  backLabel = 'ANSWER',
}: FlipCardProps) {
  const theme = getTheme(isDark);
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      friction: 7,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [isFlipped]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const cardBase = {
    width: SCREEN_WIDTH - 48,
    height: CARD_HEIGHT,
    borderRadius: Radius['3xl'],
    borderWidth: 1.5,
    // The deck colour doubles as the bottom lip, so the card reads as a solid
    // object on the page rather than a sheet floating over it.
    borderBottomWidth: 4,
    borderBottomColor: color,
    position: 'absolute' as const,
    overflow: 'hidden' as const,
  };

  return (
    <TouchableOpacity
      onPress={onFlip}
      activeOpacity={0.95}
      style={{
        width: SCREEN_WIDTH - 48,
        height: CARD_HEIGHT,
        alignSelf: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <Animated.View
        style={[
          cardBase,
          {
            transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
            opacity: frontOpacity,
            backgroundColor: theme.surface,
            borderColor: color + '50',
          },
        ]}
      >
        <View style={{ height: 6, backgroundColor: color }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Nunito_700Bold',
              letterSpacing: 2.5,
              color,
              marginBottom: 16,
              opacity: 0.85,
            }}
          >
            {frontLabel}
          </Text>
          <Text
            style={{
              fontSize: 19,
              fontFamily: 'Nunito_700Bold',
              textAlign: 'center',
              lineHeight: 28,
              color: theme.text,
            }}
          >
            {front}
          </Text>
        </View>
        <View style={{ alignItems: 'center', paddingBottom: 18 }}>
          <Text
            style={{
              color: theme.textTertiary,
              fontSize: 11,
              fontFamily: 'Nunito_400Regular',
            }}
          >
            Tap to reveal {backLabel.toLowerCase()}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          cardBase,
          {
            transform: [{ perspective: 1200 }, { rotateY: backRotate }],
            opacity: backOpacity,
            backgroundColor: color + (isDark ? '25' : '12'),
            borderColor: color + '60',
          },
        ]}
      >
        <View style={{ height: 6, backgroundColor: color }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Nunito_700Bold',
              letterSpacing: 2.5,
              color,
              marginBottom: 16,
              opacity: 0.85,
            }}
          >
            {backLabel}
          </Text>
          <Text
            style={{
              fontSize: 19,
              fontFamily: 'Nunito_700Bold',
              textAlign: 'center',
              lineHeight: 28,
              color: theme.text,
            }}
          >
            {back}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FlashcardsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const insets = useSafeAreaInsets();
  // The tab bar floats over the screen, so every view here reserves its height.
  const tabBarHeight = useTabBarHeight();
  const { selectedYear, selectedSemester } = useSemesterContext();
  const [currentSubjects, setCurrentSubjects] = useState<any[]>([]);

  // ── Data state
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);

  // ── View routing
  const [view, setView] = useState<StudyViewMode>('decks');
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [activeNode, setActiveNode] = useState<DeckNode | null>(null);

  // First visit only: point at the create-deck button, once the deck list is up.
  useScreenTour(TOUR_KEYS.study, STUDY_TOUR, !loading && view === 'decks');

  // ── Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<'all' | 'due' | string>('all');

  // ── Study session
  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0, mastered: 0 });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [studyReversed, setStudyReversed] = useState(false);
  /**
   * One-step undo for the last rating. A mis-tap on "Again" used to be
   * unrecoverable — it rewrote the card's interval, ease and due date with no
   * way back. The snapshot holds everything the rating touched.
   */
  const [undoState, setUndoState] = useState<null | {
    card: SessionCard;
    cardIndex: number;
    sessionCards: SessionCard[];
    sessionStats: { again: number; hard: number; good: number; easy: number; mastered: number };
    stats: FlashcardStats;
  }>(null);

  // ── Multi-select management
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // ── Live countdown
  const [nextDueIn, setNextDueIn] = useState<string>('');
  const [totalDueNow, setTotalDueNow] = useState(0);

  // ── Detail view state
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilter, setDetailFilter] = useState<'all' | 'new' | 'learning' | 'due'>('all');

  // ── Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [quizMissed, setQuizMissed] = useState<QuizQuestion[]>([]);

  // ── Match state
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [matchRevealed, setMatchRevealed] = useState<string[]>([]);
  const [matchMatched, setMatchMatched] = useState<Set<string>>(new Set());
  const [matchMoves, setMatchMoves] = useState(0);
  const [matchStartTime, setMatchStartTime] = useState(0);
  const [matchDone, setMatchDone] = useState(false);
  const [matchElapsed, setMatchElapsed] = useState(0);

  // ── Exam Prep state
  const [showExamModal, setShowExamModal] = useState(false);
  const [examDate, setExamDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [examShowDatePicker, setExamShowDatePicker] = useState(false);
  const [examReviewsPerDay, setExamReviewsPerDay] = useState(0); // 0 = auto
  const [examPlan, setExamPlan] = useState<ExamScheduleSlot[] | null>(null);

  // ── Move deck state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetPath, setMoveTargetPath] = useState('');
  const [movingNode, setMovingNode] = useState<DeckNode | null>(null);

  // ── Modals
  const [showAddDeckModal, setShowAddDeckModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // Deck actions. This replaced an eleven-button AlertService.alert — the
  // CustomAlert stacks >2 buttons vertically with no scroll, so on a normal
  // phone Export / Reset / Delete rendered below the bottom of the screen.
  const [actionNode, setActionNode] = useState<DeckNode | null>(null);

  // ── Form state
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [deckForm, setDeckForm] = useState({
    name: '',
    subject: '',
    color: DECK_COLORS[0],
    icon: 'book-outline',
  });
  const [cardForm, setCardForm] = useState({ front: '', back: '' });

  // ── Import state
  const [importLoading, setImportLoading] = useState(false);
  const [parsedImport, setParsedImport] = useState<{ front: string; back: string }[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importText, setImportText] = useState('');
  const [importSeparator, setImportSeparator] = useState<'comma' | 'semicolon' | 'pipe' | 'tab'>('comma');
  const isRatingRef = useRef(false);

  // ── Settings state. The in-screen settings sheet was removed: it was never
  //    rendered (nothing set its visible flag) and `app/study-options.tsx` is
  //    the real editor, which both header entry points already opened.
  const [srSettings, setSrSettings] = useState<SRSettings>(DEFAULT_SR_SETTINGS);

  // ── Stats state
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
  useEffect(() => {
    statsRef.current = flashcardStats;
  }, [flashcardStats]);

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Data loading & saving
  // ─────────────────────────────────────────────────────────────────────────

  const loadDecks = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
      if (raw) {
        const ledger = JSON.parse(raw);
        setDecks(ledger.flashcards?.decks || []);
        if (ledger.flashcards?.settings) setSrSettings(ledger.flashcards.settings);
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
        setDecks([]);
        setCurrentSubjects([]);
      }
    } catch (e) {
      console.error('Failed to load flashcards:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedSemester]);

  const saveDecks = async (newDecks: FlashcardDeck[]) => {
    setDecks(newDecks);
    if (activeDeck) {
      const updatedDeck = newDecks.find((d) => d.id === activeDeck.id);
      if (updatedDeck) setActiveDeck(updatedDeck);
    }
    if (activeNode) {
      const newTree = buildDeckTree(newDecks);
      const findNode = (nodes: DeckNode[], path: string, deckId?: string): DeckNode | null => {
        for (const n of nodes) {
          if (deckId && n.deck?.id === deckId) return n;
          if (n.fullPath === path) return n;
          const found = findNode(Array.from(n.children.values()), path, deckId);
          if (found) return found;
        }
        return null;
      };
      const updatedNode = findNode(newTree, activeNode.fullPath, activeDeck?.id);
      if (updatedNode) {
        setActiveNode(updatedNode);
        if (updatedNode.deck) setActiveDeck(updatedNode.deck);
      }
    }
    try {
      const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
      const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
      const currentStats = statsRef.current || flashcardStats;
      ledger.flashcards = { decks: newDecks, settings: srSettings, stats: currentStats };
      await SyncService.pushLocalChanges(ledger);
    } catch (e) {
      console.error('Failed to save flashcards:', e);
    }
  };

  const saveStats = async (newStats: FlashcardStats) => {
    statsRef.current = newStats;
    setFlashcardStats(newStats);
    try {
      const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
      const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
      if (!ledger.flashcards) ledger.flashcards = { decks: decks, settings: srSettings };
      ledger.flashcards.stats = newStats;
      await SyncService.pushLocalChanges(ledger);
    } catch (e) {
      console.error('Failed to save flashcard stats:', e);
    }
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

  // Live countdown timer
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      let dueCount = 0;
      let soonestFutureDue = Infinity;
      for (const deck of decks) {
        if (!deck || !Array.isArray(deck.cards)) continue;
        for (const card of deck.cards) {
          if (!card) continue;
          if (card.nextDue <= now) dueCount++;
          else if (card.nextDue < soonestFutureDue) soonestFutureDue = card.nextDue;
        }
      }
      setTotalDueNow(dueCount);
      if (dueCount > 0) {
        setNextDueIn('');
      } else if (soonestFutureDue < Infinity) {
        const diffMs = soonestFutureDue - now;
        const totalSec = Math.max(0, Math.floor(diffMs / 1000));
        if (totalSec <= 0) {
          setNextDueIn('');
          setTotalDueNow((prev) => prev + 1);
        } else if (totalSec < 60) {
          setNextDueIn(`${totalSec}s`);
        } else if (totalSec < 3600) {
          const m = Math.floor(totalSec / 60);
          setNextDueIn(`${m}m ${totalSec % 60}s`);
        } else if (totalSec < 86400) {
          const h = Math.floor(totalSec / 3600);
          setNextDueIn(`${h}h ${Math.floor((totalSec % 3600) / 60)}m`);
        } else {
          setNextDueIn(`${Math.floor(totalSec / 86400)}d`);
        }
      } else {
        setNextDueIn('');
      }
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [decks]);

  // ─────────────────────────────────────────────────────────────────────────
  // Deck actions
  // ─────────────────────────────────────────────────────────────────────────

  const openAddDeck = (prefillName?: string) => {
    setEditingDeck(null);
    setDeckForm({
      name: prefillName || '',
      subject: '',
      color: DECK_COLORS[0],
      icon: 'book-outline',
    });
    setShowAddDeckModal(true);
    setShowCreateSheet(false);
  };

  const openEditDeck = (deck: FlashcardDeck) => {
    setEditingDeck(deck);
    setDeckForm({
      name: deck.name,
      subject: deck.subject,
      color: deck.color,
      icon: deck.icon || getDeckThematicIcon(deck.subject, deck.name),
    });
    setShowAddDeckModal(true);
  };

  const handleSaveDeck = async () => {
    if (!deckForm.name.trim()) {
      AlertService.alert('Missing Name', 'Please enter a deck name.');
      return;
    }
    const nd = [...decks];
    if (editingDeck) {
      const idx = nd.findIndex((d) => d.id === editingDeck.id);
      if (idx >= 0) {
        nd[idx] = {
          ...nd[idx],
          name: deckForm.name.trim(),
          subject: deckForm.subject.trim(),
          color: deckForm.color,
          icon: deckForm.icon,
        };
        if (activeDeck?.id === editingDeck.id) setActiveDeck(nd[idx]);
      }
    } else {
      nd.push({
        id: generateId(),
        name: deckForm.name.trim(),
        subject: deckForm.subject.trim(),
        color: deckForm.color,
        icon: deckForm.icon,
        createdAt: Date.now(),
        cards: [],
      });
    }
    await saveDecks(nd);
    setShowAddDeckModal(false);
    setEditingDeck(null);
  };

  const handleDeleteDeck = (deck: FlashcardDeck) => {
    AlertService.alert('Delete Deck', `Delete "${deck.name}" and all ${deck.cards.length} cards?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await saveDecks(decks.filter((d) => d.id !== deck.id));
          if (activeDeck?.id === deck.id) {
            setActiveDeck(null);
            setActiveNode(null);
            setView('decks');
          }
        },
      },
    ]);
  };

  const handleDeleteNode = (node: DeckNode) => {
    const decksToDelete = collectDecksFromNode(node);
    const totalCards = decksToDelete.reduce((sum, d) => sum + (d?.cards?.length || 0), 0);
    AlertService.alert(
      'Delete Folder',
      `Delete "${node.name}" including ${decksToDelete.length} deck(s) and ${totalCards} cards?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = new Set(decksToDelete.map((d) => d.id));
            await saveDecks(decks.filter((d) => !idsToDelete.has(d.id)));
            if (activeNode?.fullPath.startsWith(node.fullPath)) {
              setActiveDeck(null);
              setActiveNode(null);
              setView('decks');
            }
          },
        },
      ]
    );
  };

  const handleResetProgress = (node: DeckNode) => {
    AlertService.alert('Reset Progress', `Reset all learning progress for "${node.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          const decksToReset = collectDecksFromNode(node);
          const idsToReset = new Set(decksToReset.map((d) => d.id));
          const nd = decks.map((d) => {
            if (idsToReset.has(d.id)) {
              return {
                ...d,
                cards: Array.isArray(d.cards) ? d.cards.map((c) => ({
                  ...c,
                  interval: 0,
                  easeFactor: 2.5,
                  nextDue: Date.now(),
                  reviewCount: 0,
                  stepIndex: 0,
                })) : [],
              };
            }
            return d;
          });
          await saveDecks(nd);
          if (activeDeck && idsToReset.has(activeDeck.id)) {
            const updatedDeck = nd.find((d) => d.id === activeDeck.id);
            if (updatedDeck) setActiveDeck(updatedDeck);
          }
        },
      },
    ]);
  };

  const openAddSubNode = (node: DeckNode) => {
    setEditingDeck(null);
    setDeckForm({
      name: node.fullPath + '::',
      subject: '',
      color: DECK_COLORS[0],
      icon: 'book-outline',
    });
    setShowAddDeckModal(true);
  };

  const handleDuplicateDeck = (deck: FlashcardDeck) => {
    const nd = [...decks];
    const copy: FlashcardDeck = {
      ...deck,
      id: generateId(),
      name: deck.name + ' (copy)',
      createdAt: Date.now(),
      cards: Array.isArray(deck.cards) ? deck.cards.map((c) => ({ ...c, id: generateId() })) : [],
    };
    nd.push(copy);
    saveDecks(nd);
    AlertService.alert('Duplicated!', `Created "${copy.name}" with ${copy.cards.length} cards.`);
  };

  const handleMoveDeck = (node: DeckNode) => {
    setMovingNode(node);
    const parts = node.fullPath.split('::');
    parts.pop();
    setMoveTargetPath(parts.length > 0 ? parts.join('::') + '::' : '');
    setShowMoveModal(true);
  };

  const confirmMoveDeck = async () => {
    if (!movingNode || !movingNode.deck) {
      setShowMoveModal(false);
      return;
    }
    const deck = movingNode.deck;
    const targetPrefix = moveTargetPath.trim();
    const lastSegment = movingNode.name;
    const newFullPath = targetPrefix ? targetPrefix + lastSegment : lastSegment;
    const pathParts = newFullPath.split('::').filter(Boolean);
    let newSubject = '';
    let newName = lastSegment;
    if (pathParts.length > 1) {
      newName = pathParts[pathParts.length - 1];
      newSubject = pathParts.slice(0, -1).join('::');
    }
    const nd = decks.map((d) => (d.id === deck.id ? { ...d, name: newName, subject: newSubject } : d));
    await saveDecks(nd);
    setShowMoveModal(false);
    setMovingNode(null);

    const newTree = buildDeckTree(nd);
    const findNode = (nodes: DeckNode[], deckId: string): DeckNode | null => {
      for (const n of nodes) {
        if (n.deck?.id === deckId) return n;
        const found = findNode(Array.from(n.children.values()), deckId);
        if (found) return found;
      }
      return null;
    };
    const updatedNode = findNode(newTree, deck.id);
    if (updatedNode) {
      setActiveNode(updatedNode);
      setActiveDeck(updatedNode.deck);
    }
  };

  const handleExportDeck = async (node: DeckNode) => {
    const allCards = collectCards(node);
    if (allCards.length === 0) {
      AlertService.alert('No Cards', 'There are no cards to export in this deck or folder.');
      return;
    }
    const header = `# FinScholar Flashcard Export: ${node.name}\n# Format: Front, Back\n`;
    const rows = allCards.map((c) => {
      const escapeCsv = (str: string) => {
        const text = (str || '').replace(/\r?\n/g, ' ');
        if (text.includes(',') || text.includes('"') || text.includes(';')) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };
      return `${escapeCsv(c.front)}, ${escapeCsv(c.back)}`;
    });
    const content = header + rows.join('\n');
    try {
      await Share.share({
        title: `${node.name} Flashcards`,
        message: content,
      });
    } catch (e: any) {
      console.error('Deck export error:', e);
    }
  };

  const showDeckActions = (node: DeckNode) => {
    setActionNode(node);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Exam Prep Scheduling
  // ─────────────────────────────────────────────────────────────────────────

  const applyExamSchedule = async () => {
    if (!activeNode || !examPlan) return;
    const allCards = collectCards(activeNode);
    if (allCards.length === 0) return;

    const now = Date.now();
    const firstGapDays = examPlan.length > 1 ? examPlan[1].day - examPlan[0].day : 1;
    const nd = decks.map((d) => {
      const nodeDecks = collectDecksFromNode(activeNode);
      const nodeDeckIds = new Set(nodeDecks.map((dd) => dd.id));
      if (!nodeDeckIds.has(d.id)) return d;
      return {
        ...d,
        cards: Array.isArray(d.cards) ? d.cards.map((c) => ({
          ...c,
          nextDue: now + examPlan[0].day * 24 * 60 * 60 * 1000,
          interval: Math.max(1, Math.round(firstGapDays)),
          easeFactor: 2.5,
          reviewCount: c.reviewCount,
          stepIndex: 0,
        })) : [],
      };
    });
    await saveDecks(nd);
    setShowExamModal(false);
    setExamPlan(null);
    AlertService.alert(
      'Exam Prep Active!',
      `Scheduled ${allCards.length} cards across ${examPlan.length} review sessions before your exam.`
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Card actions
  // ─────────────────────────────────────────────────────────────────────────

  const openAddCard = () => {
    setEditingCard(null);
    setCardForm({ front: '', back: '' });
    setShowAddCardModal(true);
  };

  const handleSaveCard = async (keepOpen = false) => {
    if (!cardForm.front.trim() || !cardForm.back.trim()) {
      AlertService.alert('Missing Fields', 'Please fill in both the question and answer.');
      return;
    }
    const targetDeck = activeDeck || (editingCard ? decks.find((d) => Array.isArray(d.cards) && d.cards.some((c) => c.id === editingCard.id)) : null);
    if (!targetDeck) return;
    const nd = [...decks];
    const di = nd.findIndex((d) => d.id === targetDeck.id);
    if (di < 0) return;
    if (!Array.isArray(nd[di].cards)) nd[di].cards = [];
    if (editingCard) {
      nd[di].cards = nd[di].cards.map((c) =>
        c.id === editingCard.id ? { ...c, front: cardForm.front.trim(), back: cardForm.back.trim() } : c
      );
    } else {
      nd[di].cards.push(makeNewCard(cardForm.front, cardForm.back));
    }
    await saveDecks(nd);
    if (activeDeck?.id === targetDeck.id) setActiveDeck(nd[di]);
    // A card edited from inside a session has to change in the live queue as
    // well, or the session keeps showing the text you just fixed.
    if (editingCard) {
      setSessionCards((prev) =>
        prev.map((sc) =>
          sc.id === editingCard.id ? { ...sc, front: cardForm.front.trim(), back: cardForm.back.trim() } : sc
        )
      );
    }
    // "Save & add another" keeps the sheet up so a study set can be typed in
    // one sitting instead of reopening the sheet per card.
    if (!keepOpen || editingCard) setShowAddCardModal(false);
    setEditingCard(null);
    setCardForm({ front: '', back: '' });
  };

  const handleDeleteCard = (card: Flashcard) => {
    const targetDeck = activeDeck || decks.find((d) => Array.isArray(d.cards) && d.cards.some((c) => c.id === card.id));
    if (!targetDeck) return;
    AlertService.alert('Delete Card', 'Remove this card from the deck?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const nd = decks.map((d) =>
            d.id === targetDeck.id
              ? { ...d, cards: Array.isArray(d.cards) ? d.cards.filter((c) => c.id !== card.id) : [] }
              : d
          );
          await saveDecks(nd);
          const updated = nd.find((d) => d.id === targetDeck.id);
          if (updated && activeDeck?.id === targetDeck.id) {
            setActiveDeck(updated);
          }
        },
      },
    ]);
  };

  const handleBulkDelete = () => {
    if (selectedCardIds.size === 0) return;
    AlertService.alert('Delete Cards', `Remove ${selectedCardIds.size} selected card(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const nd = decks.map((d) => ({
            ...d,
            cards: Array.isArray(d.cards) ? d.cards.filter((c) => !selectedCardIds.has(c.id)) : [],
          }));
          await saveDecks(nd);
          if (activeDeck) {
            const u = nd.find((d) => d.id === activeDeck.id);
            if (u) setActiveDeck(u);
          }
          setSelectedCardIds(new Set());
          setIsSelectionMode(false);
        },
      },
    ]);
  };

  const handleBulkReverse = (onlySelected: boolean = false) => {
    if (onlySelected && selectedCardIds.size === 0) return;
    if (!onlySelected && !activeNode) return;
    const title = onlySelected ? 'Reverse Selected' : 'Reverse Folder';
    const msg = onlySelected
      ? `Swap Front/Back for ${selectedCardIds.size} card(s)?`
      : 'Swap Front/Back of all cards under this folder?';
    AlertService.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reverse',
        onPress: async () => {
          let deckIdsToReverse = new Set<string>();
          if (!onlySelected && activeNode) {
            deckIdsToReverse = new Set(collectDecksFromNode(activeNode).map((d) => d.id));
          }
          const nd = decks.map((d) => ({
            ...d,
            cards: Array.isArray(d.cards) ? d.cards.map((c) => {
              const shouldReverse = onlySelected ? selectedCardIds.has(c.id) : deckIdsToReverse.has(d.id);
              if (shouldReverse) return { ...c, front: c.back, back: c.front };
              return c;
            }) : [],
          }));
          await saveDecks(nd);
          if (onlySelected) {
            setSelectedCardIds(new Set());
            setIsSelectionMode(false);
          }
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Study session
  // ─────────────────────────────────────────────────────────────────────────

  const startStudy = (node: DeckNode, advance: boolean = false) => {
    const allCards = collectCards(node);
    if (allCards.length === 0) {
      AlertService.alert('No Cards', 'Add some cards before studying!');
      return;
    }
    const now = Date.now();
    const due = allCards.filter((c) => c.nextDue <= now);
    const session = due.length > 0 && !advance ? due : [...allCards];
    const shuffled = [...session].sort(() => Math.random() - 0.5);
    setSessionCards(shuffled);
    setCardIndex(0);
    setIsFlipped(false);
    setSessionDone(false);
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0, mastered: 0 });
    setStudyReversed(false);
    setActiveNode(node);
    setActiveDeck(node.deck || decks[0] || null);
    isRatingRef.current = false;
    setUndoState(null);
    setView('study');
  };

  const startStudyAll = () => {
    const now = Date.now();
    const allDue: SessionCard[] = [];
    for (const deck of decks) {
      if (!deck || !Array.isArray(deck.cards)) continue;
      for (const card of deck.cards) {
        if (card && card.nextDue <= now) allDue.push({ ...card, deckId: deck.id });
      }
    }
    if (allDue.length === 0) {
      AlertService.alert('All Caught Up!', 'No cards are due for review right now.');
      return;
    }
    const shuffled = [...allDue].sort(() => Math.random() - 0.5);
    setSessionCards(shuffled);
    setCardIndex(0);
    setIsFlipped(false);
    setSessionDone(false);
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0, mastered: 0 });
    setActiveNode(null);
    setActiveDeck(decks[0] || null);
    isRatingRef.current = false;
    setUndoState(null);
    setView('study');
  };

  /** Puts the card, the queue, the session tally and the XP back as they were. */
  const handleUndoRating = async () => {
    if (!undoState) return;
    const snap = undoState;
    setUndoState(null);

    const { deckId, ...restored } = snap.card;
    const nd = decks.map((d) =>
      d.id === deckId
        ? { ...d, cards: Array.isArray(d.cards) ? d.cards.map((c) => (c.id === restored.id ? { ...restored } : c)) : [] }
        : d
    );
    await saveDecks(nd);
    if (activeDeck?.id === deckId) {
      const updated = nd.find((d) => d.id === deckId);
      if (updated) setActiveDeck(updated);
    }

    setSessionCards(snap.sessionCards);
    setSessionStats(snap.sessionStats);
    setCardIndex(snap.cardIndex);
    setSessionDone(false);
    setIsFlipped(true);
    await saveStats(snap.stats);
  };

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (isRatingRef.current) return;
    if (cardIndex >= sessionCards.length) return;
    isRatingRef.current = true;

    const card = sessionCards[cardIndex];
    if (!card) {
      isRatingRef.current = false;
      return;
    }
    setUndoState({
      card,
      cardIndex,
      sessionCards: [...sessionCards],
      sessionStats: { ...sessionStats },
      stats: statsRef.current || flashcardStats,
    });

    const updatedCard = applyRating(card, rating, srSettings);
    const nd = [...decks];
    const di = nd.findIndex((d) => d.id === card.deckId);
    if (di >= 0 && nd[di] && Array.isArray(nd[di].cards)) {
      nd[di].cards = nd[di].cards.map((c) => (c.id === card.id ? updatedCard : c));
      await saveDecks(nd);
      if (activeDeck?.id === card.deckId) setActiveDeck(nd[di]);
    }
    const ratingKey: Record<number, keyof Omit<typeof sessionStats, 'mastered'>> = {
      1: 'again',
      2: 'hard',
      3: 'good',
      4: 'easy',
    };
    let justMastered = false;
    if (card.interval === 0 && updatedCard.interval > 0) justMastered = true;
    setSessionStats((prev) => ({
      ...prev,
      [ratingKey[rating]]: prev[ratingKey[rating]] + 1,
      mastered: prev.mastered + (justMastered ? 1 : 0),
    }));

    const REQUEUE_WINDOW_MS = 20 * 60 * 1000;
    const shouldRequeue = updatedCard.interval === 0 && updatedCard.nextDue - Date.now() < REQUEUE_WINDOW_MS;
    if (shouldRequeue) setSessionCards((prev) => [...prev, { ...updatedCard, deckId: card.deckId }]);

    if (cardIndex + 1 >= sessionCards.length && !shouldRequeue) {
      setSessionDone(true);
      const newStats = updateStudyStats(
        statsRef.current || flashcardStats,
        1,
        justMastered ? 1 : 0,
        true,
        sessionCards.length
      );
      saveStats(newStats);
      isRatingRef.current = false;
    } else {
      setIsFlipped(false);
      setTimeout(() => {
        setCardIndex((prev) => prev + 1);
        isRatingRef.current = false;
      }, 120);
      const newStats = updateStudyStats(
        statsRef.current || flashcardStats,
        1,
        justMastered ? 1 : 0,
        false
      );
      saveStats(newStats);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // File import
  // ─────────────────────────────────────────────────────────────────────────

  const handlePickFile = async () => {
    try {
      setImportLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImportFileName(asset.name);
      const response = await fetch(asset.uri);
      const content = await response.text();
      const cards = parseImport(content, importSeparator);
      if (cards.length === 0) AlertService.alert('No Cards Found', 'Make sure your separator matches the file contents.');
      setParsedImport(cards);
    } catch (e: any) {
      console.error('File Read Error:', e);
      AlertService.alert('Error', `Could not read the file: ${e?.message || 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleParseText = () => {
    if (!importText.trim()) return;
    const cards = parseImport(importText, importSeparator);
    if (cards.length === 0) AlertService.alert('No Cards Found', 'Please check your formatting and separator.');
    setParsedImport(cards);
  };

  const handleConfirmImport = async () => {
    if (!activeDeck || parsedImport.length === 0) return;
    const nd = [...decks];
    const di = nd.findIndex((d) => d.id === activeDeck.id);
    parsedImport.forEach(({ front, back }) => nd[di].cards.push(makeNewCard(front, back)));
    await saveDecks(nd);
    setActiveDeck(nd[di]);
    const count = parsedImport.length;
    setParsedImport([]);
    setImportFileName('');
    setShowImportModal(false);
    AlertService.alert('Imported!', `${count} card${count !== 1 ? 's' : ''} added to "${activeDeck.name}".`);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setParsedImport([]);
    setImportFileName('');
    setImportText('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Quiz logic
  // ─────────────────────────────────────────────────────────────────────────

  const generateQuiz = (node: DeckNode, onlyMissed?: QuizQuestion[]) => {
    const allCards = collectCards(node);
    if (allCards.length < 2) {
      AlertService.alert('Not Enough Cards', 'You need at least 2 cards for a quiz.');
      return;
    }

    let source: SessionCard[];
    if (onlyMissed) {
      const missedIds = new Set(onlyMissed.map((q) => q.cardId));
      source = allCards.filter((c) => missedIds.has(c.id));
    } else {
      source = [...allCards].sort(() => Math.random() - 0.5).slice(0, Math.min(10, allCards.length));
    }

    const questions: QuizQuestion[] = source.map((card) => {
      const cardBackClean = (card.back || '').trim();
      const otherUniqueBacks = Array.from(
        new Set(
          allCards
            .map((c) => (c.back || '').trim())
            .filter((backText) => backText.length > 0 && backText.toLowerCase() !== cardBackClean.toLowerCase())
        )
      );
      const shuffledOthers = [...otherUniqueBacks].sort(() => Math.random() - 0.5);
      const distractors = shuffledOthers.slice(0, 3);
      const options = Array.from(new Set([...distractors, cardBackClean])).sort(() => Math.random() - 0.5);
      return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
    });

    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizSelected(null);
    setQuizDone(false);
    setQuizMissed([]);
    setActiveNode(node);
    setView('quiz');
  };

  const handleQuizAnswer = (answer: string) => {
    if (quizSelected !== null) return;
    setQuizSelected(answer);
    const q = quizQuestions[quizIndex];
    const isCorrect = answer === q.correctAnswer;
    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
    } else {
      setQuizMissed((prev) => [...prev, q]);
    }
    setTimeout(() => {
      if (quizIndex + 1 >= quizQuestions.length) {
        setQuizDone(true);
        const newStats = updateStudyStats(
          statsRef.current || flashcardStats,
          quizQuestions.length,
          quizScore + (isCorrect ? 1 : 0),
          true
        );
        saveStats(newStats);
      } else {
        setQuizIndex((prev) => prev + 1);
        setQuizSelected(null);
      }
    }, 1200);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Match game logic
  // ─────────────────────────────────────────────────────────────────────────

  // Live running ticker during Speed Match gameplay
  useEffect(() => {
    if (view !== 'match' || matchDone || matchStartTime === 0) return;
    const timer = setInterval(() => {
      setMatchElapsed(Math.max(0, Math.floor((Date.now() - matchStartTime) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [view, matchDone, matchStartTime]);

  const startMatch = (node: DeckNode) => {
    const allCards = collectCards(node);
    if (allCards.length < 2) {
      AlertService.alert('Not Enough Cards', 'You need at least 2 cards for the matching game.');
      return;
    }

    const selected = [...allCards].sort(() => Math.random() - 0.5).slice(0, Math.min(8, allCards.length));
    const cards: MatchCard[] = [];
    selected.forEach((card) => {
      cards.push({ id: generateId(), pairId: card.id, text: card.front, isTerm: true });
      cards.push({ id: generateId(), pairId: card.id, text: card.back, isTerm: false });
    });
    const shuffled = [...cards].sort(() => Math.random() - 0.5);

    setMatchCards(shuffled);
    setMatchRevealed([]);
    setMatchMatched(new Set());
    setMatchMoves(0);
    setMatchStartTime(Date.now());
    setMatchDone(false);
    setMatchElapsed(0);
    setActiveNode(node);
    setView('match');
  };

  const handleMatchTap = (cardId: string) => {
    if (matchRevealed.length >= 2) return;
    if (matchRevealed.includes(cardId)) return;
    const card = matchCards.find((c) => c.id === cardId);
    if (!card || matchMatched.has(card.pairId)) return;

    const newRevealed = [...matchRevealed, cardId];
    setMatchRevealed(newRevealed);

    if (newRevealed.length === 2) {
      setMatchMoves((prev) => prev + 1);
      const [first, second] = newRevealed.map((id) => matchCards.find((c) => c.id === id)!);
      if (first.pairId === second.pairId && first.isTerm !== second.isTerm) {
        setTimeout(() => {
          setMatchMatched((prev) => {
            const next = new Set(prev);
            next.add(first.pairId);
            const totalPairs = matchCards.length / 2;
            if (next.size >= totalPairs) {
              setMatchDone(true);
              const elapsedSec = Math.max(0, Math.floor((Date.now() - matchStartTime) / 1000));
              setMatchElapsed(elapsedSec);
              const newStats = updateStudyStats(
                statsRef.current || flashcardStats,
                totalPairs,
                0,
                true
              );
              saveStats(newStats);
            }
            return next;
          });
          setMatchRevealed([]);
        }, 400);
      } else {
        setTimeout(() => setMatchRevealed([]), 800);
      }
    }
  };

  // Quick Study Modes Launcher from Dashboard
  const handleSelectDashboardStudyMode = (modeId: 'flashcards' | 'spaced' | 'match' | 'quiz' | 'exam') => {
    if (decks.length === 0) {
      AlertService.alert('No Decks Found', 'Please create or import a flashcard deck first.');
      return;
    }
    const tree = buildDeckTree(decks);
    const targetNode = tree[0];

    if (modeId === 'flashcards') {
      startStudy(targetNode, true);
    } else if (modeId === 'spaced') {
      if (totalDueNow > 0) {
        startStudyAll();
      } else {
        startStudy(targetNode, false);
      }
    } else if (modeId === 'match') {
      startMatch(targetNode);
    } else if (modeId === 'quiz') {
      generateQuiz(targetNode);
    } else if (modeId === 'exam') {
      setActiveNode(targetNode);
      setActiveDeck(targetNode.deck);
      setExamPlan(null);
      setExamReviewsPerDay(0);
      setShowExamModal(true);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Decks Dashboard (Redesigned R1, R2, R3)
  // ─────────────────────────────────────────────────────────────────────────

  const renderDecks = () => {
    const totalCards = decks.reduce((sum, d) => sum + (Array.isArray(d?.cards) ? d.cards.length : 0), 0);
    const tree = buildDeckTree(decks);

    // Calculate total mastered cards across all decks
    let totalMasteredCards = 0;
    const now = Date.now();
    decks.forEach((d) => {
      if (!d || !Array.isArray(d.cards)) return;
      d.cards.forEach((c) => {
        if (!c) return;
        if (c.reviewCount > 0 && c.interval > 0 && c.nextDue > now) {
          totalMasteredCards++;
        }
      });
    });

    // Extract unique subjects for filter bar
    const subjectsSet = new Set<string>();
    decks.forEach((d) => {
      if (d && d.subject && d.subject.trim()) {
        const topLevel = d.subject.trim().split('::')[0];
        if (topLevel) subjectsSet.add(topLevel);
        subjectsSet.add(d.subject.trim());
      }
    });
    const uniqueSubjects = Array.from(subjectsSet);

    // Filter tree according to search and selected subject
    let filteredDecks = decks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredDecks = filteredDecks.filter(
        (d) => d && (d.name.toLowerCase().includes(q) || d.subject?.toLowerCase().includes(q))
      );
    }
    if (selectedSubjectFilter === 'due') {
      filteredDecks = filteredDecks.filter((d) => d && Array.isArray(d.cards) && d.cards.some((c) => c && c.nextDue <= now));
    } else if (selectedSubjectFilter !== 'all') {
      filteredDecks = filteredDecks.filter(
        (d) => d && (d.subject === selectedSubjectFilter || d.subject?.startsWith(selectedSubjectFilter + '::'))
      );
    }

    const filteredTree = buildDeckTree(filteredDecks);

    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ══ App bar — flush with the page, matching the other tabs ═══════ */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10, zIndex: 10,
            backgroundColor: theme.background,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, marginRight: 10 }}>
            <View style={{
              width: 32, height: 32, borderRadius: 10,
              backgroundColor: tints.grades.fill,
              borderWidth: 1, borderColor: tints.grades.line,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="layers" size={17} color={tints.grades.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, letterSpacing: -0.4 }}
              >
                Flash Study
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>
                {decks.length} deck{decks.length !== 1 ? 's' : ''} · {totalCards} card{totalCards !== 1 ? 's' : ''}
                {totalDueNow > 0 ? ` · ${totalDueNow} due` : ''}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push('/study-options')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Study options — spaced repetition settings"
              style={{
                width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.cardBorder,
                borderBottomWidth: 2, borderBottomColor: theme.lip,
              }}
            >
              <Ionicons name="options-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <SpotlightTarget id={SPOTLIGHT_IDS.studyCreateDeck}>
              <AnimatedPressable
                onPress={() => setShowCreateSheet(true)}
                accessibilityRole="button"
                accessibilityLabel="Create deck or folder"
                style={{
                  width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: theme.primary,
                  borderBottomWidth: 2, borderBottomColor: theme.primaryDark,
                }}
              >
                <Ionicons name="add" size={21} color="#ffffff" />
              </AnimatedPressable>
            </SpotlightTarget>
          </View>
        </View>

        {loading ? (
          <ListSkeleton count={4} cardHeight={80} />
        ) : decks.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingBottom: tabBarHeight }}>
            <Card padding={0} radius={Radius['2xl']} style={{ overflow: 'hidden' }}>
              <View style={{
                alignItems: 'center', paddingTop: 26, paddingBottom: 22,
                backgroundColor: tints.grades.fill,
                borderBottomWidth: 1, borderBottomColor: tints.grades.line,
              }}>
                <View style={{
                  width: 68, height: 68, borderRadius: 22,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: theme.surface,
                  borderWidth: 2, borderColor: tints.grades.line,
                }}>
                  <Ionicons name="albums-outline" size={31} color={tints.grades.ink} />
                </View>
              </View>

              <View style={{ padding: 22, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.text, textAlign: 'center', letterSpacing: -0.4 }}>
                  Your study space
                </Text>
                <Text style={{
                  fontFamily: 'Nunito_400Regular', fontSize: 13.5, color: theme.textSecondary,
                  textAlign: 'center', lineHeight: 20, marginTop: 7, marginBottom: 20,
                }}>
                  Make a deck of flashcards, or paste a list you already have. FinScholar schedules the reviews for you with SM-2 spaced repetition.
                </Text>

                <AnimatedPressable
                  onPress={() => openAddDeck()}
                  accessibilityRole="button"
                  accessibilityLabel="Create your first deck"
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    width: '100%', paddingVertical: 13, borderRadius: Radius.lg,
                    backgroundColor: theme.primary,
                    borderBottomWidth: 3, borderBottomColor: theme.primaryDark,
                  }}
                >
                  <Ionicons name="add-circle" size={18} color="#ffffff" />
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: '#ffffff' }}>
                    Create your first deck
                  </Text>
                </AnimatedPressable>
              </View>
            </Card>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: tabBarHeight + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Gamification & Statistics Island (R2) */}
            <StudyDashboardStats
              stats={flashcardStats}
              totalCards={totalCards}
              totalDueNow={totalDueNow}
              totalMastered={totalMasteredCards}
              nextDueIn={nextDueIn}
              onStudyAllDue={startStudyAll}
            />

            {/* Quick Study Modes Launcher (R1) */}
            <StudyModesStrip onSelectMode={handleSelectDashboardStudyMode} />

            {/* ══ Deck list ═════════════════════════════════════════════════
                 Search and the filter chips sit directly above the list they
                 act on. The "Study Options" row that used to live here was a
                 third route to the same screen as the header gear. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: tints.grades.solid, marginRight: 9 }} />
              <Text accessibilityRole="header" style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, letterSpacing: -0.2 }}>
                Your decks
              </Text>
              <View style={{
                marginLeft: 8, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2,
                borderRadius: Radius.full, alignItems: 'center', backgroundColor: theme.surfaceSecondary,
              }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                  {filteredTree.length}
                </Text>
              </View>

              <View style={{ flex: 1 }} />

              <AnimatedPressable
                onPress={() => openAddDeck()}
                accessibilityRole="button"
                accessibilityLabel="Add deck"
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 12, height: 32, borderRadius: Radius.full,
                  backgroundColor: theme.primary,
                  borderBottomWidth: 2, borderBottomColor: theme.primaryDark,
                }}
              >
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: '#ffffff' }}>Deck</Text>
              </AnimatedPressable>
            </View>

            {/* Search */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 12, height: 42, borderRadius: Radius.lg, marginBottom: 10,
              backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder,
            }}>
              <Ionicons name="search" size={16} color={theme.textTertiary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search decks or subjects…"
                placeholderTextColor={theme.textTertiary}
                accessibilityLabel="Search decks"
                style={{ flex: 1, marginLeft: 8, fontFamily: 'Nunito_600SemiBold', fontSize: 13.5, color: theme.text, padding: 0 }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {[
                  { key: 'all', label: 'All decks', count: decks.length, tint: null as any },
                  ...(totalDueNow > 0 ? [{ key: 'due', label: 'Due now', count: totalDueNow, tint: tints.schedule }] : []),
                  ...uniqueSubjects.map((sub) => ({ key: sub, label: sub, count: null as any, tint: null as any })),
                ].map((chip) => {
                  const active = selectedSubjectFilter === chip.key;
                  const activeFill = chip.tint ? chip.tint.fill : tints.grades.fill;
                  const activeLine = chip.tint ? chip.tint.line : tints.grades.line;
                  const activeInk = chip.tint ? chip.tint.ink : tints.grades.ink;
                  return (
                    <TouchableOpacity
                      key={chip.key}
                      onPress={() => setSelectedSubjectFilter(chip.key)}
                      activeOpacity={0.75}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={chip.count !== null ? `${chip.label}, ${chip.count}` : chip.label}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, height: 30, borderRadius: Radius.full,
                        backgroundColor: active ? activeFill : theme.surfaceSecondary,
                        borderWidth: 1, borderColor: active ? activeLine : theme.cardBorder,
                      }}
                    >
                      {chip.key === 'due' && (
                        <Ionicons name="flash" size={12} color={active ? activeInk : theme.textTertiary} />
                      )}
                      <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? activeInk : theme.textSecondary }}>
                        {chip.label}
                      </Text>
                      {chip.count !== null && (
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: active ? activeInk : theme.textTertiary }}>
                          {chip.count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Deck Tree & Cards List (R3) */}
            {filteredTree.length === 0 ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                padding: 12, borderRadius: Radius.lg,
                backgroundColor: tints.grades.fill, borderWidth: 1, borderColor: tints.grades.line,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 11, marginRight: 11,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                }}>
                  <Ionicons name="search-outline" size={17} color={tints.grades.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>
                    No decks match
                  </Text>
                  <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginTop: 1 }}>
                    Try a different search, or clear the filter above.
                  </Text>
                </View>
              </View>
            ) : (
              filteredTree.map((node) => (
                <DeckTreeItem
                  key={node.fullPath}
                  node={node}
                  depth={0}
                  expandedNodes={expandedNodes}
                  onToggleNode={toggleNode}
                  onPressDeck={(n) => {
                    setActiveNode(n);
                    setActiveDeck(n.deck);
                    setDetailSearch('');
                    setDetailFilter('all');
                    setView('detail');
                  }}
                  onLongPressDeck={(n) => showDeckActions(n)}
                  onQuickStudy={(n) => startStudy(n)}
                  onMoreActions={(n) => showDeckActions(n)}
                />
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Deck Detail (Redesigned R1, R3)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * The deck screen.
   *
   * This absorbed the old separate `manage` view. The two were ~90% the same
   * screen — both listed the cards with edit and delete, both had their own
   * study CTA, import and add-card buttons — but search and status filters
   * existed only here while bulk select, bulk reverse and the per-card due date
   * existed only there, so which half of the features you got depended on
   * which button you happened to press. Everything from both lives here now.
   */
  const renderDetail = () => {
    if (!activeNode) return null;
    const stats = getNodeStats(activeNode);
    const allCards = collectCards(activeNode);
    const deck = activeNode.deck ? decks.find((d) => d.id === activeNode.deck!.id) || activeNode.deck : null;
    const color = deck?.color || theme.primary;
    const masteredPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
    const nextReviewText = getNextDueText(activeNode);
    const readyNow = stats.due + stats.learning;

    let filteredCards = allCards;
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      filteredCards = filteredCards.filter(
        (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
      );
    }
    if (detailFilter !== 'all') {
      filteredCards = filteredCards.filter((c) => getCardStatus(c) === detailFilter);
    }

    const visibleIds = filteredCards.map((c) => c.id);
    const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCardIds.has(id));
    const handleToggleSelectAll = () => {
      if (isAllSelected) setSelectedCardIds(new Set());
      else setSelectedCardIds(new Set(visibleIds));
    };

    const studyModes = [
      { id: 'flashcards', icon: 'albums-outline' as const, title: 'Flashcards', desc: 'Flip and rate recall', tint: tints.grades },
      { id: 'spaced', icon: 'refresh-outline' as const, title: 'Spaced rep.', desc: 'Only what is due', tint: tints.schedule },
      { id: 'match', icon: 'grid-outline' as const, title: 'Speed match', desc: 'Pair terms to answers', tint: tints.tasks },
      { id: 'quiz', icon: 'document-text-outline' as const, title: 'Practice test', desc: 'Multiple choice', tint: tints.attendance },
      { id: 'exam', icon: 'calendar-outline' as const, title: 'Exam prep', desc: 'Plan up to a date', tint: tints.danger },
    ];

    const statusRows = [
      { key: 'new', label: 'New', count: stats.new, color: STATUS_CONFIG.new.color },
      { key: 'learning', label: 'Learning', count: stats.learning, color: STATUS_CONFIG.learning.color },
      { key: 'due', label: 'Review', count: stats.due, color: STATUS_CONFIG.due.color },
      { key: 'mastered', label: 'Mastered', count: stats.mastered, color: STATUS_CONFIG.mastered.color },
    ];

    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ══ App bar ═══════════════════════════════════════════════════════ */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10 }}>
          <TouchableOpacity
            onPress={() => { setView('decks'); setIsSelectionMode(false); setSelectedCardIds(new Set()); }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to all decks"
            style={{
              width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: theme.surface,
              borderWidth: 1, borderColor: theme.cardBorder,
              borderBottomWidth: 2, borderBottomColor: theme.lip,
            }}
          >
            <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} accessibilityRole="header" style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text, letterSpacing: -0.4 }}>
              {activeNode.name}
            </Text>
            {activeNode.fullPath !== activeNode.name && (
              <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>
                {activeNode.fullPath}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => showDeckActions(activeNode)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Deck options"
            style={{
              width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: theme.surface,
              borderWidth: 1, borderColor: theme.cardBorder,
              borderBottomWidth: 2, borderBottomColor: theme.lip,
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: tabBarHeight + 92 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ══ Progress ════════════════════════════════════════════════════ */}
          <Card padding={0} radius={Radius['2xl']} style={{ overflow: 'hidden', marginBottom: 18 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', padding: 14,
              backgroundColor: color + (isDark ? '20' : '14'),
              borderBottomWidth: 1, borderBottomColor: color + (isDark ? '35' : '28'),
            }}>
              <View style={{
                width: 42, height: 42, borderRadius: 14, marginRight: 12,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: theme.surface, borderWidth: 1, borderColor: color + '55',
              }}>
                <Ionicons name={(deck?.icon as any) || getDeckThematicIcon(deck?.subject, deck?.name)} size={20} color={color} />
              </View>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={microLabel}>Mastery</Text>
                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 22, color: theme.text, letterSpacing: -0.6, marginTop: 1 }}>
                  {masteredPct}%
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text }}>{stats.total}</Text>
                <Text style={microLabel}>cards</Text>
              </View>
            </View>

            {readyNow > 0 ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
                backgroundColor: tints.schedule.fill, borderBottomWidth: 1, borderBottomColor: tints.schedule.line,
              }}>
                <Ionicons name="flash" size={14} color={tints.schedule.ink} style={{ marginRight: 7 }} />
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: tints.schedule.ink }}>
                  {readyNow} card{readyNow !== 1 ? 's' : ''} ready to review now
                </Text>
              </View>
            ) : nextReviewText ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
                borderBottomWidth: 1, borderBottomColor: theme.cardBorder,
              }}>
                <Ionicons name="time-outline" size={14} color={theme.textTertiary} style={{ marginRight: 7 }} />
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>
                  Next review in <Text style={{ fontFamily: 'Nunito_900Black', color: theme.primary }}>{nextReviewText}</Text>
                </Text>
              </View>
            ) : null}

            <View style={{ padding: 14, gap: 9 }}>
              {statusRows.map((row) => (
                <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: row.color, marginRight: 9 }} />
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, width: 70, color: theme.textSecondary }}>
                    {row.label}
                  </Text>
                  <ProgressBar
                    progress={stats.total > 0 ? row.count / stats.total : 0}
                    height={7}
                    color={row.color}
                    animate={false}
                    style={{ flex: 1, marginHorizontal: 8 }}
                    accessibilityLabel={`${row.label}: ${row.count} of ${stats.total}`}
                  />
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, width: 30, textAlign: 'right', color: theme.text }}>
                    {row.count}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          {/* ══ Study modes ═════════════════════════════════════════════════ */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: tints.grades.solid, marginRight: 9 }} />
            <Text accessibilityRole="header" style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, letterSpacing: -0.2 }}>
              Study modes
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
            {studyModes.map((mode) => (
              <Card
                key={mode.id}
                padding={12}
                radius={Radius.lg}
                onPress={() => {
                  if (mode.id === 'flashcards') startStudy(activeNode, true);
                  else if (mode.id === 'spaced') startStudy(activeNode, false);
                  else if (mode.id === 'match') startMatch(activeNode);
                  else if (mode.id === 'quiz') generateQuiz(activeNode);
                  else if (mode.id === 'exam') {
                    setExamPlan(null);
                    setExamReviewsPerDay(0);
                    setShowExamModal(true);
                  }
                }}
                accessibilityLabel={`${mode.title}. ${mode.desc}`}
                style={{ width: (SCREEN_WIDTH - GUTTER * 2 - 10) / 2 }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 12, marginBottom: 9,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: mode.tint.fill, borderWidth: 1, borderColor: mode.tint.line,
                }}>
                  <Ionicons name={mode.icon} size={18} color={mode.tint.ink} />
                </View>
                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.text }}>
                  {mode.title}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>
                  {mode.desc}
                </Text>
              </Card>
            ))}
          </View>

          {/* ══ Cards ═══════════════════════════════════════════════════════ */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: tints.tools.solid, marginRight: 9 }} />
            <Text accessibilityRole="header" style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, letterSpacing: -0.2 }}>
              Cards
            </Text>
            <View style={{
              marginLeft: 8, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2,
              borderRadius: Radius.full, alignItems: 'center', backgroundColor: theme.surfaceSecondary,
            }}>
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                {allCards.length}
              </Text>
            </View>

            <View style={{ flex: 1 }} />

            {deck && (
              <>
                <TouchableOpacity
                  onPress={() => { setActiveDeck(deck); setShowImportModal(true); }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Import cards"
                  style={{
                    width: 32, height: 32, borderRadius: 11, marginRight: 8,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: theme.surfaceSecondary,
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <AnimatedPressable
                  onPress={openAddCard}
                  accessibilityRole="button"
                  accessibilityLabel="Add card"
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 12, height: 32, borderRadius: Radius.full,
                    backgroundColor: theme.primary,
                    borderBottomWidth: 2, borderBottomColor: theme.primaryDark,
                  }}
                >
                  <Ionicons name="add" size={16} color="#ffffff" />
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: '#ffffff' }}>Add</Text>
                </AnimatedPressable>
              </>
            )}
          </View>

          {/* Search */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 12, height: 42, borderRadius: Radius.lg, marginBottom: 10,
            backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder,
          }}>
            <Ionicons name="search" size={16} color={theme.textTertiary} />
            <TextInput
              value={detailSearch}
              onChangeText={setDetailSearch}
              placeholder="Search cards in this deck…"
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

          {/* Status filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {[
                { key: 'all', label: 'All', count: allCards.length, color: theme.primary },
                { key: 'new', label: 'New', count: stats.new, color: STATUS_CONFIG.new.color },
                { key: 'learning', label: 'Learning', count: stats.learning, color: STATUS_CONFIG.learning.color },
                { key: 'due', label: 'Review', count: stats.due, color: STATUS_CONFIG.due.color },
              ].map((tab) => {
                const active = detailFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setDetailFilter(tab.key as any)}
                    activeOpacity={0.75}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${tab.label}, ${tab.count} cards`}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 12, height: 30, borderRadius: Radius.full,
                      backgroundColor: active ? tab.color + (isDark ? '28' : '18') : theme.surfaceSecondary,
                      borderWidth: 1, borderColor: active ? tab.color + '66' : theme.cardBorder,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tab.color }} />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? theme.text : theme.textSecondary }}>
                      {tab.label}
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary }}>
                      {tab.count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Selection toolbar — carried over from the old Manage view */}
          {allCards.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {isSelectionMode ? (
                <>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text, marginRight: 2 }}>
                    {selectedCardIds.size} selected
                  </Text>
                  <TouchableOpacity
                    onPress={handleToggleSelectAll}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    style={{ paddingHorizontal: 4 }}
                  >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.primary }}>
                      {isAllSelected ? 'None' : 'All'}
                    </Text>
                  </TouchableOpacity>
                  {selectedCardIds.size > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => handleBulkReverse(true)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Swap front and back on the selected cards"
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.primary }}>Reverse</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleBulkDelete}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Delete the selected cards"
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: tints.danger.ink }}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    onPress={() => { setIsSelectionMode(false); setSelectedCardIds(new Set()); }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    style={{ paddingHorizontal: 14, height: 30, borderRadius: Radius.full, justifyContent: 'center', backgroundColor: theme.primary }}
                  >
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: '#ffffff' }}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setIsSelectionMode(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Select cards"
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="checkbox-outline" size={15} color={theme.textSecondary} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>Select</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleBulkReverse(false)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Swap front and back on every card here"
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 14 }}
                  >
                    <Ionicons name="swap-vertical" size={15} color={theme.textSecondary} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>Reverse all</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Card rows */}
          {filteredCards.length === 0 ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              padding: 12, borderRadius: Radius.lg,
              backgroundColor: tints.grades.fill, borderWidth: 1, borderColor: tints.grades.line,
            }}>
              <View style={{
                width: 34, height: 34, borderRadius: 11, marginRight: 11,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
              }}>
                <Ionicons name={allCards.length === 0 ? 'documents-outline' : 'search-outline'} size={17} color={tints.grades.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>
                  {allCards.length === 0 ? 'No cards yet' : 'Nothing matches'}
                </Text>
                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginTop: 1, lineHeight: 16 }}>
                  {allCards.length === 0
                    ? 'Add cards one at a time, or import a list you already have.'
                    : 'Try a different search or filter.'}
                </Text>
              </View>
            </View>
          ) : (
            filteredCards.map((card, idx) => {
              const status = getCardStatus(card);
              const cfg = STATUS_CONFIG[status];
              const isSelected = selectedCardIds.has(card.id);
              const cardDue = card.nextDue <= Date.now();
              const dueText = cardDue
                ? 'Due now'
                : new Date(card.nextDue).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const owningDeck =
                deck ||
                decks.find((d) => Array.isArray(d.cards) && d.cards.some((c) => c.id === card.id));

              return (
                <Card
                  key={card.id}
                  padding={12}
                  radius={Radius.lg}
                  onPress={
                    isSelectionMode
                      ? () => {
                          const next = new Set(selectedCardIds);
                          if (next.has(card.id)) next.delete(card.id);
                          else next.add(card.id);
                          setSelectedCardIds(next);
                        }
                      : owningDeck
                      ? () => {
                          setActiveDeck(owningDeck);
                          setEditingCard(card);
                          setCardForm({ front: card.front, back: card.back });
                          setShowAddCardModal(true);
                        }
                      : undefined
                  }
                  accessibilityLabel={`${card.front}. ${card.back}. ${cfg.label}, ${dueText}`}
                  accessibilityHint={isSelectionMode ? 'Toggles selection' : 'Opens this card for editing'}
                  style={{ marginBottom: 8, borderColor: isSelected ? theme.primary : theme.cardBorder }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    {isSelectionMode ? (
                      <View style={{
                        width: 22, height: 22, borderRadius: 7, marginRight: 11, marginTop: 1,
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: isSelected ? theme.primary : (isDark ? '#464d75' : '#cbd5e1'),
                        backgroundColor: isSelected ? theme.primary : 'transparent',
                      }}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                      </View>
                    ) : (
                      <View style={{
                        width: 22, height: 22, borderRadius: 7, marginRight: 11, marginTop: 1,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: theme.surfaceSecondary,
                      }}>
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: theme.textTertiary }}>
                          {idx + 1}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                        <View style={{
                          paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
                          backgroundColor: cfg.color + (isDark ? '28' : '18'),
                        }}>
                          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: cfg.color, letterSpacing: 0.2 }}>
                            {cfg.label.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: cardDue ? tints.tasks.ink : theme.textTertiary }}>
                          {dueText}
                        </Text>
                        {card.reviewCount > 0 && (
                          <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: theme.textTertiary }}>
                            · {card.reviewCount} review{card.reviewCount !== 1 ? 's' : ''}
                          </Text>
                        )}
                      </View>

                      <Text numberOfLines={2} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text, lineHeight: 18 }}>
                        {card.front}
                      </Text>
                      <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary, marginTop: 2, lineHeight: 17 }}>
                        {card.back}
                      </Text>
                    </View>

                    {!isSelectionMode && owningDeck && (
                      <TouchableOpacity
                        onPress={() => { setActiveDeck(owningDeck); handleDeleteCard(card); }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete card ${card.front}`}
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        style={{
                          width: 28, height: 28, borderRadius: 9, marginLeft: 8,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: tints.danger.fill,
                        }}
                      >
                        <Ionicons name="trash-outline" size={14} color={tints.danger.ink} />
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>

        {/* ══ Study CTA ═════════════════════════════════════════════════════ */}
        <View
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: tabBarHeight + 12,
            backgroundColor: theme.background,
            borderTopWidth: 1, borderTopColor: theme.cardBorder,
          }}
        >
          <AnimatedPressable
            onPress={() => startStudy(activeNode, readyNow === 0)}
            accessibilityRole="button"
            accessibilityLabel={readyNow > 0 ? `Study ${readyNow} due cards` : `Study ahead, ${allCards.length} cards`}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 14, borderRadius: Radius.lg,
              backgroundColor: allCards.length === 0 ? theme.surfaceSecondary : color,
              borderBottomWidth: 3,
              borderBottomColor: allCards.length === 0 ? theme.cardBorder : 'rgba(0,0,0,0.28)',
            }}
          >
            <Ionicons name="play" size={17} color={allCards.length === 0 ? theme.textTertiary : '#ffffff'} />
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5, color: allCards.length === 0 ? theme.textTertiary : '#ffffff' }}>
              {allCards.length === 0
                ? 'Add cards to start'
                : readyNow > 0
                ? `Study ${readyNow} due card${readyNow !== 1 ? 's' : ''}`
                : `Study ahead · ${allCards.length} card${allCards.length !== 1 ? 's' : ''}`}
            </Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Study Session
  // ─────────────────────────────────────────────────────────────────────────

  const renderStudy = () => {
    if (sessionCards.length === 0 && !sessionDone) return null;

    if (sessionDone) {
      const now = Date.now();
      let soonestDue = Infinity;
      let moreDueNow = 0;
      for (const deck of decks) {
        if (!deck || !Array.isArray(deck.cards)) continue;
        for (const card of deck.cards) {
          if (!card) continue;
          if (card.nextDue <= now) moreDueNow++;
          else if (card.nextDue < soonestDue) soonestDue = card.nextDue;
        }
      }
      const nextDueDiffSec = soonestDue < Infinity ? Math.floor((soonestDue - now) / 1000) : -1;
      let nextDueLabel = '';
      if (nextDueDiffSec > 0 && nextDueDiffSec < 60) nextDueLabel = `${nextDueDiffSec}s`;
      else if (nextDueDiffSec >= 60 && nextDueDiffSec < 3600) nextDueLabel = `${Math.floor(nextDueDiffSec / 60)}m`;
      else if (nextDueDiffSec >= 3600 && nextDueDiffSec < 86400)
        nextDueLabel = `${Math.floor(nextDueDiffSec / 3600)}h ${Math.floor((nextDueDiffSec % 3600) / 60)}m`;
      else if (nextDueDiffSec >= 86400) nextDueLabel = `${Math.floor(nextDueDiffSec / 86400)}d`;

      const accuracyPct =
        sessionCards.length > 0
          ? Math.round(((sessionCards.length - sessionStats.again) / sessionCards.length) * 100)
          : 0;

      return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.background }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: tabBarHeight + 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={require('../../assets/images/happy.png')}
              style={{ width: 110, height: 110, marginBottom: 16 }}
              resizeMode="contain"
            />
            <Text className={`font-nunito-black text-3xl text-center mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Session Complete! 🎉
            </Text>
            <Text className={`font-nunito text-sm text-center mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You reviewed {sessionCards.length} card{sessionCards.length !== 1 ? 's' : ''}. Fin is proud of your progress!
            </Text>

            <View
              className="w-full p-6 rounded-3xl mb-4 border"
              style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip }}
            >
              <Text className={`font-nunito-bold text-xs text-center tracking-widest mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                SESSION ANALYTICS & XP
              </Text>
              <View className="flex-row justify-around items-center">
                <View className="items-center flex-1 border-r border-slate-200 dark:border-slate-800">
                  <Text className="font-nunito-black text-3xl text-indigo-500">{accuracyPct}%</Text>
                  <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Accuracy
                  </Text>
                </View>
                <View className="items-center flex-1 border-r border-slate-200 dark:border-slate-800">
                  <Text className="font-nunito-black text-3xl text-emerald-500">{sessionStats.mastered}</Text>
                  <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Mastered
                  </Text>
                </View>
                <View className="items-center flex-1">
                  <View className="flex-row items-center justify-center">
                    <Text className="font-nunito-black text-3xl text-orange-500">{flashcardStats.currentStreak}</Text>
                    <Text className="text-xl ml-1">🔥</Text>
                  </View>
                  <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Day Streak
                  </Text>
                </View>
              </View>
            </View>

            {moreDueNow > 0 ? (
              <View
                className={`w-full p-4 rounded-2xl mb-6 ${
                  isDark ? 'bg-indigo-950/40 border border-indigo-800/30' : 'bg-indigo-50 border border-indigo-100'
                }`}
              >
                <Text className={`font-nunito-bold text-center text-sm ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  {moreDueNow} more card{moreDueNow !== 1 ? 's' : ''} due right now!
                </Text>
              </View>
            ) : nextDueLabel ? (
              <View
                className="w-full p-4 rounded-2xl mb-6 flex-row items-center justify-center border"
                style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder }}
              >
                <Ionicons name="time-outline" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                <Text className={`font-nunito text-sm ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Next review in <Text className="font-nunito-bold text-indigo-500">{nextDueLabel}</Text>
                </Text>
              </View>
            ) : null}

            <View className="flex-row w-full" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setView(activeNode ? 'detail' : 'decks')}
                className="flex-1 py-4 rounded-2xl items-center border"
                style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip }}
              >
                <Text className={`font-nunito-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {activeNode ? 'Back to Deck' : 'All Decks'}
                </Text>
              </TouchableOpacity>
              {moreDueNow > 0 ? (
                <TouchableOpacity
                  onPress={startStudyAll}
                  className="flex-1 py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30"
                >
                  <Text className="font-nunito-bold text-white">Continue ({moreDueNow})</Text>
                </TouchableOpacity>
              ) : activeNode ? (
                <TouchableOpacity
                  onPress={() => startStudy(activeNode)}
                  style={{ backgroundColor: activeDeck?.color || '#4f46e5', flex: 1 }}
                  className="py-4 rounded-2xl items-center"
                >
                  <Text className="font-nunito-bold text-white">Study Again</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const card = sessionCards[cardIndex];
    const progress = sessionCards.length > 0 ? cardIndex / sessionCards.length : 0;
    const cardColor = decks.find((d) => d.id === card.deckId)?.color || activeDeck?.color || theme.primary;
    const owningDeck = decks.find((d) => d.id === card.deckId) || activeDeck || null;

    const exitSession = () => {
      setUndoState(null);
      setView(activeNode ? 'detail' : 'decks');
    };

    const headerButton = (
      iconName: keyof typeof Ionicons.glyphMap,
      label: string,
      onPress: () => void,
      opts?: { active?: boolean; disabled?: boolean }
    ) => (
      <TouchableOpacity
        onPress={onPress}
        disabled={opts?.disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(opts?.disabled), selected: Boolean(opts?.active) }}
        style={{
          width: 36, height: 36, borderRadius: 12,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: opts?.active ? tints.grades.fill : theme.surface,
          borderWidth: 1, borderColor: opts?.active ? tints.grades.line : theme.cardBorder,
          borderBottomWidth: 2, borderBottomColor: opts?.active ? tints.grades.line : theme.lip,
          opacity: opts?.disabled ? 0.4 : 1,
        }}
      >
        <Ionicons
          name={iconName}
          size={17}
          color={opts?.active ? tints.grades.ink : theme.textSecondary}
        />
      </TouchableOpacity>
    );

    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ══ Session bar ═══════════════════════════════════════════════════ */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10 }}>
          {headerButton('close', 'End session', exitSession)}

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>
              {activeNode ? activeNode.deck?.name || activeNode.name : 'All decks'}
            </Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>
              Card {cardIndex + 1} of {sessionCards.length}
            </Text>
          </View>

          {/* Undo the last rating — a mis-tap is otherwise permanent. */}
          {headerButton('arrow-undo-outline', 'Undo last rating', handleUndoRating, { disabled: !undoState })}

          {owningDeck &&
            headerButton('create-outline', 'Edit this card', () => {
              setActiveDeck(owningDeck);
              setEditingCard(card);
              setCardForm({ front: card.front, back: card.back });
              setShowAddCardModal(true);
            })}

          {headerButton(
            'swap-vertical',
            studyReversed ? 'Show the term first' : 'Show the answer first',
            () => {
              setStudyReversed((r) => !r);
              setIsFlipped(false);
            },
            { active: studyReversed }
          )}
        </View>

        <View style={{ paddingHorizontal: GUTTER, marginBottom: 22 }}>
          <ProgressBar
            progress={progress}
            height={7}
            color={cardColor}
            accessibilityLabel={`Session progress, card ${cardIndex + 1} of ${sessionCards.length}`}
          />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: GUTTER }}>
          <FlipCard
            front={studyReversed ? card.back : card.front}
            back={studyReversed ? card.front : card.back}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped((f) => !f)}
            color={cardColor}
            isDark={isDark}
            frontLabel={studyReversed ? 'DEFINITION' : 'TERM'}
            backLabel={studyReversed ? 'TERM' : 'DEFINITION'}
          />
          {!isFlipped && (
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textTertiary, marginTop: 28 }}>
              Tap the card to reveal the {studyReversed ? 'term' : 'definition'}
            </Text>
          )}
        </View>

        <View
          pointerEvents={isFlipped ? 'auto' : 'none'}
          style={{ paddingHorizontal: GUTTER, paddingBottom: tabBarHeight + 12, opacity: isFlipped ? 1 : 0 }}
        >
          <Text style={{ ...microLabel, textAlign: 'center', marginBottom: 12 }}>
            How well did you know this?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(() => {
              const isNew = card.interval === 0;
              const formatMin = (m: number) =>
                m < 60 ? `<${m}m` : m < 1440 ? `<${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
              const formatDay = (d: number) => (d < 1 ? '<1d' : `${Math.round(d)}d`);
              const parseSteps = (str: string | undefined) => {
                const p = (str || '1 10')
                  .split(' ')
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => !isNaN(n));
                return p.length > 0 ? p : [1, 10];
              };
              const steps = parseSteps(srSettings.learningSteps);
              const stepIndex = card.stepIndex || 0;
              const againSub = formatMin(steps[0]);
              const hardSub = isNew ? formatMin(steps[stepIndex]) : formatDay(Math.max(1, card.interval * 1.2));
              let goodSub = '';
              if (isNew) {
                goodSub =
                  stepIndex + 1 >= steps.length
                    ? formatDay(srSettings.graduatingInterval || 1)
                    : formatMin(steps[stepIndex + 1]);
              } else {
                goodSub = formatDay(Math.max(1, card.interval * card.easeFactor));
              }
              const easySub = isNew
                ? formatDay(srSettings.easyInterval || 4)
                : formatDay(Math.max(1, card.interval * card.easeFactor * 1.3));
              return [
                { rating: 1 as const, label: 'Again', sub: againSub, tint: tints.danger },
                { rating: 2 as const, label: 'Hard', sub: hardSub, tint: tints.tasks },
                { rating: 3 as const, label: 'Good', sub: goodSub, tint: tints.schedule },
                { rating: 4 as const, label: 'Easy', sub: easySub, tint: tints.attendance },
              ].map((btn) => (
                <AnimatedPressable
                  key={btn.rating}
                  onPress={() => isFlipped && handleRate(btn.rating)}
                  accessibilityRole="button"
                  accessibilityLabel={`${btn.label}, next review in ${btn.sub}`}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: Radius.lg,
                    alignItems: 'center',
                    backgroundColor: btn.tint.fill,
                    borderWidth: 1,
                    borderColor: btn.tint.line,
                    borderBottomWidth: 3,
                    borderBottomColor: btn.tint.line,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 14, color: btn.tint.ink }}>
                    {btn.label}
                  </Text>
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: btn.tint.ink, opacity: 0.75, marginTop: 1 }}>
                    {btn.sub}
                  </Text>
                </AnimatedPressable>
              ));
            })()}
          </View>
        </View>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Practice Test / Quiz
  // ─────────────────────────────────────────────────────────────────────────

  const renderQuiz = () => {
    if (quizQuestions.length === 0) return null;

    if (quizDone) {
      const pct = quizQuestions.length > 0 ? Math.round((quizScore / quizQuestions.length) * 100) : 0;
      return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.background }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: tabBarHeight + 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: pct >= 70 ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons
                name={pct >= 70 ? 'trophy-outline' : 'school-outline'}
                size={48}
                color={pct >= 70 ? '#10b981' : '#f97316'}
              />
            </View>
            <Text className={`font-nunito-black text-3xl text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {pct}% Score
            </Text>
            <Text className={`font-nunito text-sm text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You got {quizScore} out of {quizQuestions.length} correct
            </Text>

            {quizMissed.length > 0 && (
              <View
                className="w-full p-5 rounded-3xl mb-6 border"
                style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip }}
              >
                <Text className={`font-nunito-bold text-xs tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  MISSED TERMS ({quizMissed.length})
                </Text>
                {quizMissed.map((q, i) => (
                  <View
                    key={i}
                    className="mb-3 pb-3"
                    style={{
                      borderBottomWidth: i < quizMissed.length - 1 ? 1 : 0,
                      borderBottomColor: theme.cardBorder,
                    }}
                  >
                    <Text className={`font-nunito-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {q.question}
                    </Text>
                    <Text className={`font-nunito text-xs mt-1 text-emerald-500`}>{q.correctAnswer}</Text>
                  </View>
                ))}
              </View>
            )}

            <View className="flex-row w-full" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setView(activeNode ? 'detail' : 'decks')}
                className="flex-1 py-4 rounded-2xl items-center border"
                style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip }}
              >
                <Text className={`font-nunito-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {activeNode ? 'Back to Deck' : 'All Decks'}
                </Text>
              </TouchableOpacity>
              {quizMissed.length > 0 && activeNode && (
                <TouchableOpacity
                  onPress={() => generateQuiz(activeNode, quizMissed)}
                  className="flex-1 py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30"
                >
                  <Text className="font-nunito-bold text-white">Retry Missed ({quizMissed.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const q = quizQuestions[quizIndex];
    const progress = quizIndex / quizQuestions.length;

    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="flex-row justify-between items-center px-6 py-4">
          <TouchableOpacity
            onPress={() => setView(activeNode ? 'detail' : 'decks')}
            className="w-10 h-10 rounded-full items-center justify-center border"
            style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder }}
          >
            <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
          <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Practice Test</Text>
          <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {quizIndex + 1}/{quizQuestions.length}
          </Text>
        </View>

        <View className="mx-6 h-2 rounded-full mb-8 overflow-hidden" style={{ backgroundColor: theme.surfaceSecondary }}>
          <View style={{ width: `${progress * 100}%`, backgroundColor: '#10b981', height: '100%', borderRadius: 999 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="p-6 rounded-3xl mb-8 border"
            style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip }}
          >
            <Text className={`font-nunito-bold text-xs tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              QUESTION {quizIndex + 1}
            </Text>
            <Text className={`font-nunito-black text-lg leading-relaxed ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {q.question}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {q.options.map((option, idx) => {
              const isSelected = quizSelected === option;
              const isCorrect = option === q.correctAnswer;
              const showResult = quizSelected !== null;
              let bgColor = theme.surface;
              let borderColor = theme.cardBorder;
              let textColor = theme.text;

              if (showResult) {
                if (isCorrect) {
                  bgColor = 'rgba(16,185,129,0.12)';
                  borderColor = '#10b981';
                  textColor = '#10b981';
                } else if (isSelected && !isCorrect) {
                  bgColor = 'rgba(239,68,68,0.12)';
                  borderColor = '#ef4444';
                  textColor = '#ef4444';
                } else {
                  textColor = isDark ? '#475569' : '#94a3b8';
                }
              }

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleQuizAnswer(option)}
                  disabled={quizSelected !== null}
                  style={{ backgroundColor: bgColor, borderColor }}
                  className="p-4 rounded-2xl border flex-row items-center"
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor:
                        showResult && isCorrect
                          ? '#10b981'
                          : showResult && isSelected
                          ? '#ef4444'
                          : isDark
                          ? '#475569'
                          : '#cbd5e1',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {showResult && isCorrect && <Ionicons name="checkmark" size={16} color="#10b981" />}
                    {showResult && isSelected && !isCorrect && <Ionicons name="close" size={16} color="#ef4444" />}
                    {!showResult && (
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                        {String.fromCharCode(65 + idx)}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: textColor, fontFamily: 'Nunito_700Bold', fontSize: 14, flex: 1 }}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: tabBarHeight + 8 }}>
          <View className="flex-row items-center justify-center" style={{ gap: 16 }}>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{quizScore}</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="close-circle" size={16} color="#ef4444" />
              <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {quizMissed.length}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Matching Game
  // ─────────────────────────────────────────────────────────────────────────

  const renderMatch = () => {
    if (matchCards.length === 0) return null;

    if (matchDone) {
      const totalPairs = matchCards.length / 2;
      const accuracy = matchMoves > 0 ? Math.round((totalPairs / matchMoves) * 100) : 100;
      const mins = Math.floor(matchElapsed / 60);
      const secs = matchElapsed % 60;

      return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.background }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: tabBarHeight + 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: 'rgba(249,115,22,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons name="grid-outline" size={48} color="#f97316" />
            </View>
            <Text className={`font-nunito-black text-3xl text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              All Matched!
            </Text>
            <Text className={`font-nunito text-sm text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You matched all {totalPairs} pairs
            </Text>

            <View
              className={`w-full p-6 rounded-3xl mb-8 border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}
            >
              <View className="flex-row justify-around items-center">
                <View className="items-center">
                  <Text className={`font-nunito-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {mins}:{String(secs).padStart(2, '0')}
                  </Text>
                  <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Time
                  </Text>
                </View>
                <View className="items-center">
                  <Text className={`font-nunito-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {matchMoves}
                  </Text>
                  <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Moves
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="font-nunito-black text-2xl text-orange-500">{accuracy}%</Text>
                  <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Accuracy
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-row w-full" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setView(activeNode ? 'detail' : 'decks')}
                className="flex-1 py-4 rounded-2xl items-center border"
                style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip }}
              >
                <Text className={`font-nunito-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {activeNode ? 'Back to Deck' : 'All Decks'}
                </Text>
              </TouchableOpacity>
              {activeNode && (
                <TouchableOpacity
                  onPress={() => startMatch(activeNode)}
                  className="flex-1 py-4 rounded-2xl items-center bg-orange-500 shadow-lg shadow-orange-500/30"
                >
                  <Text className="font-nunito-bold text-white">Play Again</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const cols = 4;
    const cardSize = (SCREEN_WIDTH - 40 - (cols - 1) * 8) / cols;

    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="flex-row justify-between items-center px-6 py-4">
          <TouchableOpacity
            onPress={() => setView(activeNode ? 'detail' : 'decks')}
            className="w-10 h-10 rounded-full items-center justify-center border"
            style={{ backgroundColor: theme.surface, borderColor: theme.cardBorder }}
          >
            <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
          <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Matching Game</Text>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="time-outline" size={15} color={isDark ? '#94a3b8' : '#64748b'} />
              <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {Math.floor(matchElapsed / 60)}:{String(matchElapsed % 60).padStart(2, '0')}
              </Text>
            </View>
            <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {matchMoves} moves
            </Text>
          </View>
        </View>

        <View className="mx-6 h-2 rounded-full mb-6 overflow-hidden" style={{ backgroundColor: theme.surfaceSecondary }}>
          <View
            style={{
              width: `${(matchMatched.size / (matchCards.length / 2)) * 100}%`,
              backgroundColor: '#f97316',
              height: '100%',
              borderRadius: 999,
            }}
          />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarHeight + 24 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {matchCards.map((card) => {
              const isRevealed = matchRevealed.includes(card.id);
              const isMatched = matchMatched.has(card.pairId);
              const showFace = isRevealed || isMatched;

              return (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => handleMatchTap(card.id)}
                  disabled={isMatched || isRevealed}
                  style={{
                    width: cardSize,
                    height: cardSize + 16,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                    backgroundColor: isMatched
                      ? isDark
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(16,185,129,0.06)'
                      : showFace
                      ? isDark
                        ? '#1e293b'
                        : '#ffffff'
                      : isDark
                      ? '#334155'
                      : '#e2e8f0',
                    borderColor: isMatched ? '#10b981' : showFace ? '#f97316' : isDark ? '#475569' : '#cbd5e1',
                    opacity: isMatched ? 0.6 : 1,
                  }}
                >
                  {showFace ? (
                    <Text
                      numberOfLines={4}
                      style={{
                        fontFamily: 'Nunito_700Bold',
                        fontSize: cardSize > 80 ? 11 : 9,
                        textAlign: 'center',
                        color: isMatched ? '#10b981' : isDark ? '#e2e8f0' : '#334155',
                      }}
                    >
                      {card.text}
                    </Text>
                  ) : (
                    <Ionicons name="help-outline" size={20} color={isDark ? '#64748b' : '#94a3b8'} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Deck Management (Card list)
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Shared sheet atoms ──────────────────────────────────────────────────

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

  const PrimaryButton = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        paddingVertical: 14,
        borderRadius: Radius.lg,
        alignItems: 'center',
        backgroundColor: disabled ? theme.surfaceSecondary : theme.primary,
        borderBottomWidth: 3,
        borderBottomColor: disabled ? theme.cardBorder : theme.primaryDark,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5, color: disabled ? theme.textTertiary : '#ffffff' }}>
        {label}
      </Text>
    </AnimatedPressable>
  );

  // ─── Create ──────────────────────────────────────────────────────────────

  const renderCreateSheet = () => (
    <KeyboardSheet
      visible={showCreateSheet}
      onClose={() => setShowCreateSheet(false)}
      title="Create"
      subtitle="A deck holds cards. A folder groups decks."
      icon="add-circle-outline"
      tint={tints.grades}
      maxHeightRatio={0.6}
    >
      {[
        {
          key: 'deck',
          icon: 'albums-outline' as const,
          tint: tints.grades,
          title: 'New deck',
          desc: 'A set of flashcards you study together',
          onPress: () => openAddDeck(),
        },
        {
          key: 'folder',
          icon: 'folder-outline' as const,
          tint: tints.tasks,
          title: 'New folder',
          desc: 'Group decks under a subject, using ::',
          onPress: () => openAddDeck('::'),
        },
      ].map((opt) => (
        <TouchableOpacity
          key={opt.key}
          onPress={opt.onPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${opt.title}. ${opt.desc}`}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 13, marginRight: 12,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: opt.tint.fill, borderWidth: 1, borderColor: opt.tint.line,
          }}>
            <Ionicons name={opt.icon} size={19} color={opt.tint.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>{opt.title}</Text>
            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
              {opt.desc}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} />
        </TouchableOpacity>
      ))}
    </KeyboardSheet>
  );

  // ─── Deck actions ────────────────────────────────────────────────────────

  const renderDeckActionSheet = () => {
    const node = actionNode;
    const deck = node?.deck ? decks.find((d) => d.id === node.deck!.id) || node.deck : null;

    const run = (fn: () => void) => {
      setActionNode(null);
      // Let the sheet finish dismissing before an alert or a view change lands.
      setTimeout(fn, 220);
    };

    const groups: { key: string; items: any[] }[] = node
      ? [
          {
            key: 'study',
            items: [
              { key: 'study', icon: 'play-circle-outline', tint: tints.grades, label: 'Study now', desc: 'Review what is due', onPress: () => startStudy(node) },
              { key: 'ahead', icon: 'flash-outline', tint: tints.schedule, label: 'Study ahead', desc: 'Include cards that are not due yet', onPress: () => startStudy(node, true) },
              {
                key: 'exam', icon: 'calendar-outline', tint: tints.danger, label: 'Exam prep', desc: 'Plan reviews up to an exam date',
                onPress: () => { setActiveNode(node); setActiveDeck(deck); setExamPlan(null); setExamReviewsPerDay(0); setShowExamModal(true); },
              },
            ],
          },
          {
            key: 'organise',
            items: [
              { key: 'cards', icon: 'list-outline', tint: tints.tools, label: 'Manage cards', desc: 'Browse, edit and bulk-select', onPress: () => { setActiveNode(node); setActiveDeck(deck); setDetailSearch(''); setDetailFilter('all'); setView('detail'); } },
              { key: 'sub', icon: 'git-branch-outline', tint: tints.tools, label: 'Add sub-deck', desc: 'Nest a new deck under this one', onPress: () => openAddSubNode(node) },
              ...(deck ? [
                { key: 'edit', icon: 'create-outline', tint: tints.tools, label: 'Edit deck', desc: 'Name, subject, colour and icon', onPress: () => openEditDeck(deck) },
                { key: 'dup', icon: 'copy-outline', tint: tints.tools, label: 'Duplicate deck', desc: 'Copy the deck and all its cards', onPress: () => handleDuplicateDeck(deck) },
                { key: 'move', icon: 'move-outline', tint: tints.tools, label: 'Move deck', desc: 'Put it under a different folder', onPress: () => handleMoveDeck(node) },
              ] : []),
              { key: 'export', icon: 'share-outline', tint: tints.tools, label: 'Export deck', desc: 'Share the cards as CSV text', onPress: () => handleExportDeck(node) },
            ],
          },
          {
            key: 'danger',
            items: [
              { key: 'reset', icon: 'refresh-outline', tint: tints.tasks, label: 'Reset progress', desc: 'Keeps the cards, clears all scheduling', onPress: () => handleResetProgress(node) },
              { key: 'delete', icon: 'trash-outline', tint: tints.danger, label: deck && node.children.size === 0 ? 'Delete deck' : 'Delete folder', desc: 'Removes the cards permanently', onPress: () => handleDeleteNode(node), destructive: true },
            ],
          },
        ]
      : [];

    return (
      <KeyboardSheet
        visible={Boolean(actionNode)}
        onClose={() => setActionNode(null)}
        title={node?.name || ''}
        subtitle={node?.fullPath}
        icon={deck ? 'albums-outline' : 'folder-outline'}
        tint={tints.grades}
      >
        {groups.map((group, gi) => (
          <View
            key={group.key}
            style={{
              marginTop: gi === 0 ? 0 : 10,
              paddingTop: gi === 0 ? 0 : 10,
              borderTopWidth: gi === 0 ? 0 : 1,
              borderTopColor: theme.cardBorder,
            }}
          >
            {group.items.map((action: any) => (
              <TouchableOpacity
                key={action.key}
                onPress={() => run(action.onPress)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${action.label}. ${action.desc}`}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 12, marginRight: 12,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: action.tint.fill, borderWidth: 1, borderColor: action.tint.line,
                }}>
                  <Ionicons name={action.icon} size={17} color={action.tint.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: action.destructive ? action.tint.ink : theme.text }}>
                    {action.label}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
                    {action.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </KeyboardSheet>
    );
  };

  // ─── Deck form ───────────────────────────────────────────────────────────

  const renderAddDeckModal = () => (
    <KeyboardSheet
      visible={showAddDeckModal}
      onClose={() => setShowAddDeckModal(false)}
      title={editingDeck ? 'Edit deck' : 'New deck'}
      subtitle="Use :: in the name to nest it under a folder"
      icon="albums-outline"
      tint={tints.grades}
      footer={<PrimaryButton label={editingDeck ? 'Save changes' : 'Create deck'} onPress={handleSaveDeck} />}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
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
                    backgroundColor: active ? tints.grades.fill : theme.surfaceSecondary,
                    borderWidth: 1, borderColor: active ? tints.grades.line : theme.cardBorder,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? tints.grades.ink : theme.textSecondary }}>
                    {sub.name}
                  </Text>
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
                width: 38, height: 38, borderRadius: 13,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: c,
                borderWidth: active ? 3 : 1,
                borderColor: active ? theme.text : theme.cardBorder,
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
                width: 42, height: 42, borderRadius: Radius.md,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: active ? deckForm.color + (isDark ? '30' : '20') : theme.surfaceSecondary,
                borderWidth: active ? 2 : 1,
                borderColor: active ? deckForm.color : theme.cardBorder,
              }}
            >
              <Ionicons name={iconName as any} size={19} color={active ? deckForm.color : theme.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </KeyboardSheet>
  );

  // ─── Card form ───────────────────────────────────────────────────────────

  const renderAddCardModal = () => (
    <KeyboardSheet
      visible={showAddCardModal}
      onClose={() => setShowAddCardModal(false)}
      title={editingCard ? 'Edit card' : 'New card'}
      subtitle={activeDeck?.name}
      icon="documents-outline"
      tint={tints.grades}
      headerRight={
        <TouchableOpacity
          onPress={() => setCardForm({ front: cardForm.back, back: cardForm.front })}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Swap front and back"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, height: 32, borderRadius: Radius.full,
            backgroundColor: theme.surfaceSecondary,
          }}
        >
          <Ionicons name="swap-vertical" size={14} color={theme.textSecondary} />
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>Swap</Text>
        </TouchableOpacity>
      }
      footer={
        <View style={{ gap: 4 }}>
          <PrimaryButton label={editingCard ? 'Save card' : 'Add card'} onPress={() => handleSaveCard(false)} />
          {!editingCard && (
            <TouchableOpacity
              onPress={() => handleSaveCard(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Save this card and start another"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9 }}
            >
              <Ionicons name="add" size={15} color={theme.textSecondary} />
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>
                Save & add another
              </Text>
            </TouchableOpacity>
          )}
        </View>
      }
    >
      <Text style={{ ...microLabel, marginBottom: 8 }}>Front · the prompt</Text>
      <TextInput
        style={{ ...fieldStyle, minHeight: 88, textAlignVertical: 'top', marginBottom: 16 }}
        placeholder="What is the capital of France?"
        placeholderTextColor={theme.textTertiary}
        value={cardForm.front}
        onChangeText={(t) => setCardForm({ ...cardForm, front: t })}
        accessibilityLabel="Front of card"
        multiline
      />

      <Text style={{ ...microLabel, marginBottom: 8 }}>Back · the answer</Text>
      <TextInput
        style={{ ...fieldStyle, minHeight: 88, textAlignVertical: 'top', marginBottom: 8 }}
        placeholder="Paris"
        placeholderTextColor={theme.textTertiary}
        value={cardForm.back}
        onChangeText={(t) => setCardForm({ ...cardForm, back: t })}
        accessibilityLabel="Back of card"
        multiline
      />
    </KeyboardSheet>
  );

  // ─── Import ──────────────────────────────────────────────────────────────

  const renderImportModal = () => (
    <KeyboardSheet
      visible={showImportModal}
      onClose={closeImportModal}
      title="Import cards"
      subtitle={activeDeck ? `Into ${activeDeck.name}` : undefined}
      icon="cloud-upload-outline"
      tint={tints.tools}
      footer={
        parsedImport.length > 0 ? (
          <PrimaryButton
            label={`Import ${parsedImport.length} card${parsedImport.length !== 1 ? 's' : ''}`}
            onPress={handleConfirmImport}
          />
        ) : importText.trim().length > 0 ? (
          <PrimaryButton label="Preview cards" onPress={handleParseText} />
        ) : undefined
      }
    >
      <Text style={{ ...microLabel, marginBottom: 8 }}>1 · What separates front from back?</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        {(['comma', 'semicolon', 'pipe', 'tab'] as const).map((sep) => {
          const active = importSeparator === sep;
          const glyph = sep === 'comma' ? ',' : sep === 'semicolon' ? ';' : sep === 'pipe' ? '|' : '⇥';
          return (
            <TouchableOpacity
              key={sep}
              onPress={() => { setImportSeparator(sep); setParsedImport([]); }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Separate with ${sep}`}
              style={{
                flex: 1, height: 46, borderRadius: Radius.md,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: active ? tints.tools.fill : theme.surfaceSecondary,
                borderWidth: 1, borderColor: active ? tints.tools.line : theme.cardBorder,
              }}
            >
              <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 15, color: active ? tints.tools.ink : theme.textSecondary }}>
                {glyph}
              </Text>
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: active ? tints.tools.ink : theme.textTertiary }}>
                {sep}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ ...microLabel, marginBottom: 8 }}>2 · Paste your list</Text>
      <TextInput
        value={importText}
        onChangeText={(t) => { setImportText(t); setParsedImport([]); }}
        multiline
        placeholder={'Front, Back\nQ2, A2…'}
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel="Paste cards to import"
        style={{ ...fieldStyle, minHeight: 104, textAlignVertical: 'top', fontSize: 14, marginBottom: 14 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.cardBorder }} />
        <Text style={{ ...microLabel, marginHorizontal: 10 }}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.cardBorder }} />
      </View>

      <TouchableOpacity
        onPress={handlePickFile}
        disabled={importLoading}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Upload a text or CSV file"
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          height: 52, borderRadius: Radius.lg, marginBottom: 18,
          borderWidth: 1, borderStyle: 'dashed',
          borderColor: isDark ? '#3d4468' : '#cbd5e1',
        }}
      >
        {importLoading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <>
            <Ionicons name="document-attach-outline" size={18} color={theme.textSecondary} />
            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>
              {importFileName || 'Upload a .txt or .csv file'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {parsedImport.length > 0 && (
        <>
          <Text style={{ ...microLabel, marginBottom: 8 }}>
            Preview · {parsedImport.length} card{parsedImport.length !== 1 ? 's' : ''} found
          </Text>
          {parsedImport.slice(0, 10).map((card, idx) => (
            <Card key={idx} variant="sunken" padding={11} radius={Radius.md} style={{ marginBottom: 6 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.text }}>
                {card.front}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                {card.back}
              </Text>
            </Card>
          ))}
          {parsedImport.length > 10 && (
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, textAlign: 'center', paddingVertical: 6 }}>
              …and {parsedImport.length - 10} more
            </Text>
          )}
        </>
      )}
    </KeyboardSheet>
  );

  // ─── Exam prep ───────────────────────────────────────────────────────────

  const renderExamModal = () => {
    const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const urgencyTint = daysLeft <= 1 ? tints.danger : daysLeft <= 7 ? tints.tasks : tints.attendance;
    const paceLabel = daysLeft <= 1 ? 'Cram mode' : daysLeft <= 7 ? 'Intensive' : 'Standard pace';

    return (
      <KeyboardSheet
        visible={showExamModal}
        onClose={() => setShowExamModal(false)}
        title="Exam prep"
        subtitle="Reviews are spread with expanding intervals sized to your window"
        icon="calendar-outline"
        tint={tints.danger}
        footer={
          examPlan ? (
            <PrimaryButton label="Apply exam schedule" onPress={applyExamSchedule} />
          ) : (
            <PrimaryButton
              label="Generate study plan"
              onPress={() => {
                const d = Math.max(0.5, (examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                const totalCards = activeNode ? collectCards(activeNode).length : 0;
                const { plan } = computeExamPlan(d, totalCards, examReviewsPerDay);
                setExamPlan(plan);
              }}
            />
          )
        }
      >
        <Text style={{ ...microLabel, marginBottom: 8 }}>When is your exam?</Text>
        <TouchableOpacity
          onPress={() => setExamShowDatePicker(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Exam date, ${examDate.toDateString()}. Tap to change.`}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 14, height: 52, borderRadius: Radius.lg, marginBottom: 10,
            backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder,
          }}
        >
          <Ionicons name="calendar" size={18} color={tints.danger.ink} style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>
            {examDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>

        {examShowDatePicker && (
          <DateTimePicker
            value={examDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(e, d) => {
              setExamShowDatePicker(false);
              if (d) { setExamDate(d); setExamPlan(null); }
            }}
          />
        )}

        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md, marginBottom: 18,
          backgroundColor: urgencyTint.fill, borderWidth: 1, borderColor: urgencyTint.line,
        }}>
          <Ionicons name={daysLeft <= 3 ? 'alert-circle-outline' : 'information-circle-outline'} size={16} color={urgencyTint.ink} />
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: urgencyTint.ink, marginLeft: 7 }}>
            {daysLeft === 0 ? 'Exam is today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textSecondary }}>{paceLabel}</Text>
        </View>

        <Text style={{ ...microLabel, marginBottom: 8 }}>Review sessions</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {([0, 3, 4, 5, 6] as const).map((n) => {
            const active = examReviewsPerDay === n;
            return (
              <TouchableOpacity
                key={n}
                onPress={() => { setExamReviewsPerDay(n); setExamPlan(null); }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={n === 0 ? 'Automatic number of sessions' : `${n} sessions`}
                style={{
                  flex: 1, height: 40, borderRadius: Radius.md,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: active ? tints.danger.fill : theme.surfaceSecondary,
                  borderWidth: 1, borderColor: active ? tints.danger.line : theme.cardBorder,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: active ? tints.danger.ink : theme.textSecondary }}>
                  {n === 0 ? 'Auto' : `${n}×`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {examPlan && (
          <>
            <Text style={{ ...microLabel, marginBottom: 8 }}>
              Your schedule · {examPlan.length} session{examPlan.length !== 1 ? 's' : ''}
            </Text>
            <Card variant="sunken" padding={12} radius={Radius.lg} style={{ marginBottom: 6 }}>
              {examPlan.map((slot, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i === examPlan.length - 1 ? 0 : 9 }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 8, marginRight: 10,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: i === 0 ? tints.danger.solid : theme.surfaceSecondary,
                  }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: i === 0 ? '#ffffff' : theme.textSecondary }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>
                    {slot.label}
                  </Text>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: theme.text }}>
                    {slot.cardsPerSession} cards
                  </Text>
                </View>
              ))}
            </Card>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, lineHeight: 15 }}>
              Intervals expand over time for optimal retention — the spacing effect (Cepeda et al., 2008).
            </Text>
          </>
        )}
      </KeyboardSheet>
    );
  };

  // ─── Move deck ───────────────────────────────────────────────────────────

  const renderMoveModal = () => {
    const paths = new Set<string>();
    decks.forEach((d) => {
      const parts = (d.subject || '').split('::').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('::') + '::');
    });
    const folderOptions = ['', ...Array.from(paths).slice(0, 12)];

    return (
      <KeyboardSheet
        visible={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        title="Move deck"
        subtitle={movingNode ? `Currently at ${movingNode.fullPath}` : undefined}
        icon="move-outline"
        tint={tints.tools}
        footer={<PrimaryButton label="Move here" onPress={confirmMoveDeck} />}
      >
        <Text style={{ ...microLabel, marginBottom: 8 }}>Destination folder</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {folderOptions.map((path) => {
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
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 11, height: 32, borderRadius: Radius.full,
                  backgroundColor: active ? tints.tools.fill : theme.surfaceSecondary,
                  borderWidth: 1, borderColor: active ? tints.tools.line : theme.cardBorder,
                }}
              >
                <Ionicons
                  name={path ? 'folder-outline' : 'home-outline'}
                  size={13}
                  color={active ? tints.tools.ink : theme.textTertiary}
                />
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: active ? tints.tools.ink : theme.textSecondary }}>
                  {path || 'Top level'}
                </Text>
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

  // ─────────────────────────────────────────────────────────────────────────
  // Root render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {view === 'decks' && renderDecks()}
      {view === 'detail' && renderDetail()}
      {view === 'study' && renderStudy()}
      {view === 'quiz' && renderQuiz()}
      {view === 'match' && renderMatch()}

      {renderCreateSheet()}
      {renderDeckActionSheet()}
      {renderAddDeckModal()}
      {renderAddCardModal()}
      {renderImportModal()}

      {renderExamModal()}
      {renderMoveModal()}
    </>
  );
}
