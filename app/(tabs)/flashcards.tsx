import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
    Animated, Pressable, Dimensions, ActivityIndicator, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { SyncService } from '@/services/SyncService';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, Typography, Radius } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import DateTimePicker from '@react-native-community/datetimepicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Flashcard {
    id: string;
    front: string;
    back: string;
    interval: number;
    easeFactor: number;
    nextDue: number;
    reviewCount: number;
    stepIndex?: number;
}

interface FlashcardDeck {
    id: string;
    name: string;
    subject: string;
    color: string;
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

export function buildDeckTree(decks: FlashcardDeck[]): DeckNode[] {
    const rootNodes = new Map<string, DeckNode>();
    decks.forEach(deck => {
        const prefix = (deck.subject && deck.subject.trim()) ? `${deck.subject.trim()}::` : '';
        const fullPath = prefix + deck.name.trim();
        const parts = fullPath.split('::').filter(Boolean);
        let currentMap = rootNodes;
        let currentPath = '';
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? `${currentPath}::${part}` : part;
            if (!currentMap.has(part)) {
                currentMap.set(part, { name: part, fullPath: currentPath, deck: null, children: new Map() });
            }
            const node = currentMap.get(part)!;
            if (i === parts.length - 1) node.deck = deck;
            currentMap = node.children;
        }
    });
    const sortNodes = (map: Map<string, DeckNode>): DeckNode[] => {
        return Array.from(map.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(node => {
                node.children = new Map(sortNodes(node.children).map(n => [n.name, n]));
                return node;
            });
    };
    return sortNodes(rootNodes);
}

export function getNodeStats(node: DeckNode): { new: number, learning: number, due: number, total: number, mastered: number } {
    const stats = { new: 0, learning: 0, due: 0, total: 0, mastered: 0 };
    const now = Date.now();
    const addCards = (cards: Flashcard[]) => {
        for (const c of cards) {
            stats.total++;
            if (c.reviewCount === 0) stats.new++;
            else if (c.interval === 0) stats.learning++;
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
    if (node.deck) {
        cards = cards.concat(node.deck.cards.map(c => ({ ...c, deckId: node.deck!.id })));
    }
    for (const child of node.children.values()) {
        cards = cards.concat(collectCards(child));
    }
    return cards;
}

// ─── Quiz & Match Types ──────────────────────────────────────────────────────

interface QuizQuestion {
    cardId: string;
    question: string;
    correctAnswer: string;
    options: string[];
}

interface MatchCard {
    id: string;
    pairId: string;
    text: string;
    isTerm: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substr(2, 9);

export type SRSettings = {
    learningSteps: string;
    graduatingInterval: number;
    easyInterval: number;
    studyTimeHour: number;
    studyTimeMinute: number;
};

export const DEFAULT_SR_SETTINGS: SRSettings = {
    learningSteps: '1 10',
    graduatingInterval: 1,
    easyInterval: 4,
    studyTimeHour: 8,
    studyTimeMinute: 0,
};

export type FlashcardStats = {
    lastStudyDate: string;
    currentStreak: number;
    masteredToday: number;
};

const DECK_COLORS = [
    '#3b82f6', '#a855f7', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#10b981', '#06b6d4',
];

// ─── SM-2 Spaced Repetition ───────────────────────────────────────────────────

function applyRating(card: Flashcard, rating: 1 | 2 | 3 | 4, sr: SRSettings): Flashcard {
    let { interval, easeFactor, stepIndex = 0 } = card;
    let nextDueOffsetMs = 0;
    const parseSteps = (str: string | undefined) => {
        const parsed = (str || '1 10').split(' ').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        return parsed.length > 0 ? parsed : [1, 10];
    };
    const steps = parseSteps(sr.learningSteps);
    if (interval === 0) {
        if (rating === 1) { stepIndex = 0; nextDueOffsetMs = steps[stepIndex] * 60 * 1000; easeFactor = Math.max(1.3, easeFactor - 0.2); }
        else if (rating === 2) { nextDueOffsetMs = steps[stepIndex] * 60 * 1000; easeFactor = Math.max(1.3, easeFactor - 0.15); }
        else if (rating === 3) { stepIndex++; if (stepIndex >= steps.length) { interval = sr.graduatingInterval || 1; nextDueOffsetMs = interval * 24 * 60 * 60 * 1000; } else { nextDueOffsetMs = steps[stepIndex] * 60 * 1000; } }
        else { interval = sr.easyInterval || 4; nextDueOffsetMs = interval * 24 * 60 * 60 * 1000; easeFactor = Math.min(4.0, easeFactor + 0.1); }
    } else {
        if (rating === 1) { interval = 0; stepIndex = 0; nextDueOffsetMs = steps[0] * 60 * 1000; easeFactor = Math.max(1.3, easeFactor - 0.2); }
        else if (rating === 2) { interval = Math.max(1, Math.round(interval * 1.2)); nextDueOffsetMs = interval * 24 * 60 * 60 * 1000; easeFactor = Math.max(1.3, easeFactor - 0.15); }
        else if (rating === 3) { interval = Math.max(1, Math.round(interval * easeFactor)); nextDueOffsetMs = interval * 24 * 60 * 60 * 1000; }
        else { interval = Math.max(1, Math.round(interval * easeFactor * 1.3)); nextDueOffsetMs = interval * 24 * 60 * 60 * 1000; easeFactor = Math.min(4.0, easeFactor + 0.1); }
    }
    return { ...card, interval, easeFactor, stepIndex, nextDue: Date.now() + nextDueOffsetMs, reviewCount: card.reviewCount + 1 };
}

function makeNewCard(front: string, back: string): Flashcard {
    return { id: generateId(), front: front.trim(), back: back.trim(), interval: 0, easeFactor: 2.5, nextDue: Date.now(), reviewCount: 0, stepIndex: 0 };
}

// ─── File Import Parser ───────────────────────────────────────────────────────

function parseImport(content: string, separator: 'comma' | 'pipe' | 'tab' | 'auto' = 'auto'): { front: string; back: string }[] {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const cards: { front: string; back: string }[] = [];
    for (const line of lines) {
        if (line.startsWith('#') || line.startsWith('//')) continue;
        let front = '', back = '';
        if (separator === 'tab' || (separator === 'auto' && line.includes('\t'))) {
            const [f, ...rest] = line.split('\t'); front = f?.trim() || ''; back = rest.join('\t').trim();
        } else if (separator === 'pipe' || (separator === 'auto' && line.includes('|'))) {
            const [f, ...rest] = line.split('|'); front = f?.replace(/^Q:\s*/i, '').trim() || ''; back = rest.join('|').replace(/^A:\s*/i, '').trim();
        } else if (separator === 'comma' || (separator === 'auto' && line.includes(','))) {
            const idx = line.indexOf(',');
            if (idx >= 0) { front = line.slice(0, idx).replace(/^["']|["']$/g, '').trim(); back = line.slice(idx + 1).replace(/^["']|["']$/g, '').trim(); }
            else { front = line.trim(); }
        }
        if (front && back) cards.push({ front, back });
    }
    return cards;
}

// ─── FlipCard Component ───────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HEIGHT = 260;

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

function FlipCard({ front, back, isFlipped, onFlip, color, isDark, frontLabel = 'QUESTION', backLabel = 'ANSWER' }: FlipCardProps) {
    const flipAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(flipAnim, { toValue: isFlipped ? 1 : 0, friction: 7, tension: 50, useNativeDriver: true }).start();
    }, [isFlipped]);
    const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
    const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });
    const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
    const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });
    const cardBase = { width: SCREEN_WIDTH - 48, height: CARD_HEIGHT, borderRadius: 28, borderWidth: 1.5, position: 'absolute' as const, overflow: 'hidden' as const };
    return (
        <TouchableOpacity onPress={onFlip} activeOpacity={0.95} style={{ width: SCREEN_WIDTH - 48, height: CARD_HEIGHT, alignSelf: 'center', shadowColor: color, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8, backgroundColor: 'transparent' }}>
            <Animated.View style={[cardBase, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }], opacity: frontOpacity, backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: color + '50' }]}>
                <View style={{ height: 6, backgroundColor: color }} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', letterSpacing: 2.5, color, marginBottom: 16, opacity: 0.75 }}>{frontLabel}</Text>
                    <Text style={{ fontSize: 19, fontFamily: 'Nunito_700Bold', textAlign: 'center', lineHeight: 28, color: isDark ? '#f1f5f9' : '#1e293b' }}>{front}</Text>
                </View>
                <View style={{ alignItems: 'center', paddingBottom: 18 }}>
                    <Text style={{ color: isDark ? '#475569' : '#94a3b8', fontSize: 11, fontFamily: 'Nunito_400Regular' }}>Tap to reveal {backLabel.toLowerCase()}</Text>
                </View>
            </Animated.View>
            <Animated.View style={[cardBase, { transform: [{ perspective: 1200 }, { rotateY: backRotate }], opacity: backOpacity, backgroundColor: color + '18', borderColor: color + '60' }]}>
                <View style={{ height: 6, backgroundColor: color }} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', letterSpacing: 2.5, color, marginBottom: 16, opacity: 0.75 }}>{backLabel}</Text>
                    <Text style={{ fontSize: 19, fontFamily: 'Nunito_700Bold', textAlign: 'center', lineHeight: 28, color: isDark ? '#f1f5f9' : '#1e293b' }}>{back}</Text>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FlashcardsScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { selectedYear, selectedSemester } = useSemesterContext();
    const [currentSubjects, setCurrentSubjects] = useState<any[]>([]);

    // ── Data state
    const [decks, setDecks] = useState<FlashcardDeck[]>([]);
    const [loading, setLoading] = useState(true);

    // ── View routing
    const [view, setView] = useState<'decks' | 'detail' | 'study' | 'manage' | 'quiz' | 'match'>('decks');
    const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
    const [activeNode, setActiveNode] = useState<DeckNode | null>(null);

    // ── Study session
    const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
    const [cardIndex, setCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [sessionDone, setSessionDone] = useState(false);
    const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0, mastered: 0 });
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [studyReversed, setStudyReversed] = useState(false);

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
    const [examPlan, setExamPlan] = useState<{ day: number; label: string; cardsPerSession: number }[] | null>(null);

    // ── Move deck state
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveTargetPath, setMoveTargetPath] = useState('');
    const [movingNode, setMovingNode] = useState<DeckNode | null>(null);

    // ── Modals
    const [showAddDeckModal, setShowAddDeckModal] = useState(false);
    const [showAddCardModal, setShowAddCardModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showCreateSheet, setShowCreateSheet] = useState(false);

    // ── Form state
    const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
    const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
    const [deckForm, setDeckForm] = useState({ name: '', subject: '', color: DECK_COLORS[0] });
    const [cardForm, setCardForm] = useState({ front: '', back: '' });

    // ── Import state
    const [importLoading, setImportLoading] = useState(false);
    const [parsedImport, setParsedImport] = useState<{ front: string; back: string }[]>([]);
    const [importFileName, setImportFileName] = useState('');
    const [importText, setImportText] = useState('');
    const [importSeparator, setImportSeparator] = useState<'comma' | 'pipe' | 'tab'>('comma');

    // ── Settings state
    const [srSettings, setSrSettings] = useState<SRSettings>(DEFAULT_SR_SETTINGS);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsForm, setSettingsForm] = useState({ learningSteps: '1 10', graduatingInterval: '1', easyInterval: '4', studyTimeHour: '8', studyTimeMinute: '0' });

    // ── Stats state
    const [flashcardStats, setFlashcardStats] = useState<FlashcardStats>({ lastStudyDate: '', currentStreak: 0, masteredToday: 0 });

    const toggleNode = (path: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path); else next.add(path);
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
                if (ledger.flashcards?.stats) setFlashcardStats(ledger.flashcards.stats);
                if (selectedYear && selectedSemester) {
                    const year = ledger.years?.find((y: any) => y.id === selectedYear);
                    const sem = year?.semesters?.find((s: any) => s.id === selectedSemester);
                    setCurrentSubjects(sem?.subjects || []);
                } else { setCurrentSubjects([]); }
            } else { setDecks([]); setCurrentSubjects([]); }
        } catch (e) { console.error('Failed to load flashcards:', e); }
        finally { setLoading(false); }
    }, [selectedYear, selectedSemester]);

    const saveDecks = async (newDecks: FlashcardDeck[]) => {
        setDecks(newDecks);
        if (activeDeck) {
            const updatedDeck = newDecks.find(d => d.id === activeDeck.id);
            if (updatedDeck) setActiveDeck(updatedDeck);
        }
        if (activeNode) {
            const newTree = buildDeckTree(newDecks);
            const findNode = (nodes: DeckNode[], path: string): DeckNode | null => {
                for (const n of nodes) {
                    if (n.fullPath === path) return n;
                    const found = findNode(Array.from(n.children.values()), path);
                    if (found) return found;
                }
                return null;
            };
            const updatedNode = findNode(newTree, activeNode.fullPath);
            if (updatedNode) setActiveNode(updatedNode);
        }
        try {
            const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
            const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
            ledger.flashcards = { decks: newDecks, settings: srSettings, stats: flashcardStats };
            await SyncService.pushLocalChanges(ledger);
        } catch (e) { console.error('Failed to save flashcards:', e); }
    };

    const saveSrSettings = async (newSettings: SRSettings) => {
        setSrSettings(newSettings);
        try {
            const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
            const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
            if (!ledger.flashcards) ledger.flashcards = { decks: decks, stats: flashcardStats };
            ledger.flashcards.settings = newSettings;
            await SyncService.pushLocalChanges(ledger);
        } catch (e) { console.error('Failed to save SR settings:', e); }
    };

    const saveStats = async (newStats: FlashcardStats) => {
        setFlashcardStats(newStats);
        try {
            const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
            const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
            if (!ledger.flashcards) ledger.flashcards = { decks: decks, settings: srSettings };
            ledger.flashcards.stats = newStats;
            await SyncService.pushLocalChanges(ledger);
        } catch (e) { console.error('Failed to save flashcard stats:', e); }
    };

    useFocusEffect(useCallback(() => { loadDecks(); }, [loadDecks]));

    useEffect(() => {
        const unsub = SyncService.subscribeDataChange(() => { loadDecks(); });
        return () => unsub();
    }, [loadDecks]);

    // Live countdown timer
    useEffect(() => {
        const tick = () => {
            const now = Date.now();
            let dueCount = 0;
            let soonestFutureDue = Infinity;
            for (const deck of decks) {
                for (const card of deck.cards) {
                    if (card.nextDue <= now) dueCount++;
                    else if (card.nextDue < soonestFutureDue) soonestFutureDue = card.nextDue;
                }
            }
            setTotalDueNow(dueCount);
            if (dueCount > 0) { setNextDueIn(''); }
            else if (soonestFutureDue < Infinity) {
                const diffMs = soonestFutureDue - now;
                const totalSec = Math.max(0, Math.floor(diffMs / 1000));
                if (totalSec <= 0) { setNextDueIn(''); setTotalDueNow(prev => prev + 1); }
                else if (totalSec < 60) setNextDueIn(`${totalSec}s`);
                else if (totalSec < 3600) { const m = Math.floor(totalSec / 60); setNextDueIn(`${m}m ${totalSec % 60}s`); }
                else if (totalSec < 86400) { const h = Math.floor(totalSec / 3600); setNextDueIn(`${h}h ${Math.floor((totalSec % 3600) / 60)}m`); }
                else setNextDueIn(`${Math.floor(totalSec / 86400)}d`);
            } else { setNextDueIn(''); }
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
        setDeckForm({ name: prefillName || '', subject: '', color: DECK_COLORS[0] });
        setShowAddDeckModal(true);
        setShowCreateSheet(false);
    };

    const openEditDeck = (deck: FlashcardDeck) => {
        setEditingDeck(deck);
        setDeckForm({ name: deck.name, subject: deck.subject, color: deck.color });
        setShowAddDeckModal(true);
    };

    const handleSaveDeck = async () => {
        if (!deckForm.name.trim()) { AlertService.alert('Missing Name', 'Please enter a deck name.'); return; }
        const nd = [...decks];
        if (editingDeck) {
            const idx = nd.findIndex(d => d.id === editingDeck.id);
            if (idx >= 0) {
                nd[idx] = { ...nd[idx], name: deckForm.name.trim(), subject: deckForm.subject.trim(), color: deckForm.color };
                if (activeDeck?.id === editingDeck.id) setActiveDeck(nd[idx]);
            }
        } else {
            nd.push({ id: generateId(), name: deckForm.name.trim(), subject: deckForm.subject.trim(), color: deckForm.color, createdAt: Date.now(), cards: [] });
        }
        await saveDecks(nd);
        setShowAddDeckModal(false);
        setEditingDeck(null);
    };

    const handleDeleteDeck = (deck: FlashcardDeck) => {
        AlertService.alert('Delete Deck', `Delete "${deck.name}" and all ${deck.cards.length} cards?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                await saveDecks(decks.filter(d => d.id !== deck.id));
                if (activeDeck?.id === deck.id) { setActiveDeck(null); setActiveNode(null); setView('decks'); }
            }}
        ]);
    };

    const collectDecksFromNode = (node: DeckNode): FlashcardDeck[] => {
        let d: FlashcardDeck[] = [];
        if (node.deck) d.push(node.deck);
        node.children.forEach(c => { d = d.concat(collectDecksFromNode(c)); });
        return d;
    };

    const handleDeleteNode = (node: DeckNode) => {
        const decksToDelete = collectDecksFromNode(node);
        const totalCards = decksToDelete.reduce((sum, d) => sum + d.cards.length, 0);
        AlertService.alert('Delete Folder', `Delete "${node.name}" including ${decksToDelete.length} deck(s) and ${totalCards} cards?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete All', style: 'destructive', onPress: async () => {
                const idsToDelete = new Set(decksToDelete.map(d => d.id));
                await saveDecks(decks.filter(d => !idsToDelete.has(d.id)));
                if (activeNode?.fullPath.startsWith(node.fullPath)) { setActiveDeck(null); setActiveNode(null); setView('decks'); }
            }}
        ]);
    };

    const handleResetProgress = (node: DeckNode) => {
        AlertService.alert('Reset Progress', `Reset all learning progress for "${node.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: async () => {
                const decksToReset = collectDecksFromNode(node);
                const idsToReset = new Set(decksToReset.map(d => d.id));
                const nd = decks.map(d => {
                    if (idsToReset.has(d.id)) {
                        return { ...d, cards: d.cards.map(c => ({ ...c, interval: 0, easeFactor: 2.5, nextDue: Date.now(), reviewCount: 0, stepIndex: 0 })) };
                    }
                    return d;
                });
                await saveDecks(nd);
                if (activeDeck && idsToReset.has(activeDeck.id)) {
                    const updatedDeck = nd.find(d => d.id === activeDeck.id);
                    if (updatedDeck) setActiveDeck(updatedDeck);
                }
            }}
        ]);
    };

    const openAddSubNode = (node: DeckNode) => {
        setEditingDeck(null);
        setDeckForm({ name: node.fullPath + '::', subject: '', color: DECK_COLORS[0] });
        setShowAddDeckModal(true);
    };

    const handleDuplicateDeck = (deck: FlashcardDeck) => {
        const nd = [...decks];
        const copy: FlashcardDeck = {
            ...deck,
            id: generateId(),
            name: deck.name + ' (copy)',
            createdAt: Date.now(),
            cards: deck.cards.map(c => ({ ...c, id: generateId() })),
        };
        nd.push(copy);
        saveDecks(nd);
        AlertService.alert('Duplicated!', `Created "${copy.name}" with ${copy.cards.length} cards.`);
    };

    const handleMoveDeck = (node: DeckNode) => {
        setMovingNode(node);
        // Prefill with current path minus the last segment
        const parts = node.fullPath.split('::');
        parts.pop();
        setMoveTargetPath(parts.length > 0 ? parts.join('::') + '::' : '');
        setShowMoveModal(true);
    };

    const confirmMoveDeck = async () => {
        if (!movingNode || !movingNode.deck) { setShowMoveModal(false); return; }
        const deck = movingNode.deck;
        const oldName = deck.name;
        const targetPrefix = moveTargetPath.trim();
        // The deck's fullPath = subject::name. We need to reconstruct.
        // Extract the last segment (the deck's own name)
        const lastSegment = movingNode.name;
        const newFullPath = targetPrefix ? targetPrefix + lastSegment : lastSegment;
        // Parse newFullPath back into subject + name
        const pathParts = newFullPath.split('::').filter(Boolean);
        let newSubject = '';
        let newName = lastSegment;
        if (pathParts.length > 1) {
            newName = pathParts[pathParts.length - 1];
            newSubject = pathParts.slice(0, -1).join('::');
        }
        const nd = decks.map(d => d.id === deck.id ? { ...d, name: newName, subject: newSubject } : d);
        await saveDecks(nd);
        setShowMoveModal(false);
        setMovingNode(null);
        // Refresh active node
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
        if (updatedNode) { setActiveNode(updatedNode); setActiveDeck(updatedNode.deck); }
    };

    // Shared action sheet for deck (used by long-press AND ellipsis button)
    const showDeckActions = (node: DeckNode) => {
        const deck = node.deck ? (decks.find(d => d.id === node.deck!.id) || node.deck) : null;
        const actions: any[] = [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Study Now', onPress: () => startStudy(node) },
            { text: 'Study Ahead', onPress: () => startStudy(node, true) },
            { text: 'Exam Prep', onPress: () => { setActiveNode(node); setActiveDeck(deck); setExamPlan(null); setExamReviewsPerDay(0); setShowExamModal(true); } },
            { text: 'Add Sub-deck', onPress: () => openAddSubNode(node) },
            { text: 'Manage Cards', onPress: () => { setActiveNode(node); setActiveDeck(deck); setView('manage'); } },
        ];
        if (deck) {
            actions.push({ text: 'Edit Deck', onPress: () => openEditDeck(deck) });
            actions.push({ text: 'Duplicate Deck', onPress: () => handleDuplicateDeck(deck) });
            actions.push({ text: 'Move Deck', onPress: () => handleMoveDeck(node) });
        }
        actions.push({ text: 'Reset Progress', onPress: () => handleResetProgress(node) });
        actions.push({ text: 'Delete', style: 'destructive' as const, onPress: () => handleDeleteNode(node) });
        AlertService.alert(node.name, 'Choose an action:', actions);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Exam Prep Scheduling (based on Cepeda et al. 2008 optimal spacing)
    // Optimal gap ≈ 10-20% of retention interval. Uses expanding intervals.
    // ─────────────────────────────────────────────────────────────────────────

    const computeExamPlan = (daysUntilExam: number, totalCards: number) => {
        // Determine number of review sessions based on days available
        let numReviews: number;
        if (daysUntilExam <= 1) numReviews = 4;       // cram: 4 sessions today
        else if (daysUntilExam <= 3) numReviews = 3;
        else if (daysUntilExam <= 7) numReviews = 4;
        else if (daysUntilExam <= 14) numReviews = 5;
        else if (daysUntilExam <= 30) numReviews = 6;
        else numReviews = 7;

        if (examReviewsPerDay > 0) numReviews = examReviewsPerDay;

        // Generate expanding intervals that fit within the available window
        // Based on expanding retrieval practice (Landauer & Bjork, 1978)
        const intervals: number[] = [];
        if (daysUntilExam <= 1) {
            // Cram mode: reviews at 0min, 20min, 1h, 3h (all today)
            const cramGaps = [0, 0.014, 0.042, 0.125]; // in days
            for (let i = 0; i < numReviews; i++) intervals.push(cramGaps[Math.min(i, cramGaps.length - 1)] || 0.125 * (i - 2));
        } else {
            // Optimal first gap = ~15% of retention interval (Cepeda et al.)
            const optimalFirstGap = Math.max(0.5, daysUntilExam * 0.12);
            let currentGap = optimalFirstGap;
            let dayOffset = 0;
            for (let i = 0; i < numReviews; i++) {
                intervals.push(dayOffset);
                dayOffset += currentGap;
                currentGap *= 1.6; // expanding factor
                // Ensure we don't exceed exam day
                if (dayOffset > daysUntilExam - 0.5) dayOffset = daysUntilExam - 0.5;
            }
        }

        // Build plan
        const now = new Date();
        const plan = intervals.map((dayOff, i) => {
            const reviewDate = new Date(now.getTime() + dayOff * 24 * 60 * 60 * 1000);
            const isToday = dayOff < 1;
            const label = isToday
                ? (i === 0 ? 'Now' : `+${Math.round(dayOff * 24)}h`)
                : reviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return { day: Math.round(dayOff * 10) / 10, label, cardsPerSession: totalCards };
        });

        return { plan, numReviews };
    };

    const applyExamSchedule = async () => {
        if (!activeNode || !examPlan) return;
        const allCards = collectCards(activeNode);
        if (allCards.length === 0) return;

        const now = Date.now();
        const daysUntilExam = Math.max(0.5, (examDate.getTime() - now) / (24 * 60 * 60 * 1000));

        // Schedule each card's nextDue to the first review slot
        // and set interval to match the expanding gap
        const firstGapDays = examPlan.length > 1 ? examPlan[1].day - examPlan[0].day : 1;
        const nd = decks.map(d => {
            const nodeDecks = collectDecksFromNode(activeNode);
            const nodeDeckIds = new Set(nodeDecks.map(dd => dd.id));
            if (!nodeDeckIds.has(d.id)) return d;
            return {
                ...d,
                cards: d.cards.map(c => ({
                    ...c,
                    nextDue: now + (examPlan[0].day * 24 * 60 * 60 * 1000), // first review time
                    interval: Math.max(1, Math.round(firstGapDays)),
                    easeFactor: 2.5,
                    reviewCount: c.reviewCount, // preserve history
                    stepIndex: 0,
                })),
            };
        });
        await saveDecks(nd);
        setShowExamModal(false);
        setExamPlan(null);
        AlertService.alert('Exam Prep Active!', `Scheduled ${allCards.length} cards across ${examPlan.length} review sessions before your exam.`);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Card actions
    // ─────────────────────────────────────────────────────────────────────────

    const openAddCard = () => {
        setEditingCard(null);
        setCardForm({ front: '', back: '' });
        setShowAddCardModal(true);
    };

    const handleSaveCard = async () => {
        if (!cardForm.front.trim() || !cardForm.back.trim()) { AlertService.alert('Missing Fields', 'Please fill in both the question and answer.'); return; }
        if (!activeDeck) return;
        const nd = [...decks];
        const di = nd.findIndex(d => d.id === activeDeck.id);
        if (di < 0) return;
        if (editingCard) {
            nd[di].cards = nd[di].cards.map(c => c.id === editingCard.id ? { ...c, front: cardForm.front.trim(), back: cardForm.back.trim() } : c);
        } else {
            nd[di].cards.push(makeNewCard(cardForm.front, cardForm.back));
        }
        await saveDecks(nd);
        setActiveDeck(nd[di]);
        setShowAddCardModal(false);
        setEditingCard(null);
        setCardForm({ front: '', back: '' });
    };

    const handleDeleteCard = (card: Flashcard) => {
        if (!activeDeck) return;
        AlertService.alert('Delete Card', 'Remove this card from the deck?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                const nd = [...decks];
                const di = nd.findIndex(d => d.id === activeDeck.id);
                nd[di].cards = nd[di].cards.filter(c => c.id !== card.id);
                await saveDecks(nd);
                setActiveDeck(nd[di]);
            }}
        ]);
    };

    const handleBulkDelete = () => {
        if (selectedCardIds.size === 0) return;
        AlertService.alert('Delete Cards', `Remove ${selectedCardIds.size} selected card(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                const nd = decks.map(d => ({ ...d, cards: d.cards.filter(c => !selectedCardIds.has(c.id)) }));
                await saveDecks(nd);
                if (activeDeck) { const u = nd.find(d => d.id === activeDeck.id); if (u) setActiveDeck(u); }
                setSelectedCardIds(new Set());
                setIsSelectionMode(false);
            }}
        ]);
    };

    const handleBulkReverse = (onlySelected: boolean = false) => {
        if (onlySelected && selectedCardIds.size === 0) return;
        if (!onlySelected && !activeNode) return;
        const title = onlySelected ? 'Reverse Selected' : 'Reverse Folder';
        const msg = onlySelected ? `Swap Front/Back for ${selectedCardIds.size} card(s)?` : 'Swap Front/Back of all cards under this folder?';
        AlertService.alert(title, msg, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reverse', onPress: async () => {
                let deckIdsToReverse = new Set<string>();
                if (!onlySelected && activeNode) {
                    deckIdsToReverse = new Set(collectDecksFromNode(activeNode).map(d => d.id));
                }
                const nd = decks.map(d => ({
                    ...d,
                    cards: d.cards.map(c => {
                        const shouldReverse = onlySelected ? selectedCardIds.has(c.id) : deckIdsToReverse.has(d.id);
                        if (shouldReverse) return { ...c, front: c.back, back: c.front };
                        return c;
                    })
                }));
                await saveDecks(nd);
                if (onlySelected) { setSelectedCardIds(new Set()); setIsSelectionMode(false); }
            }}
        ]);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Study session
    // ─────────────────────────────────────────────────────────────────────────

    const startStudy = (node: DeckNode, advance: boolean = false) => {
        const allCards = collectCards(node);
        if (allCards.length === 0) { AlertService.alert('No Cards', 'Add some cards before studying!'); return; }
        const now = Date.now();
        const due = allCards.filter(c => c.nextDue <= now);
        const session = (due.length > 0 && !advance) ? due : [...allCards];
        const shuffled = [...session].sort(() => Math.random() - 0.5);
        setSessionCards(shuffled);
        setCardIndex(0);
        setIsFlipped(false);
        setSessionDone(false);
        setSessionStats({ again: 0, hard: 0, good: 0, easy: 0, mastered: 0 });
        setStudyReversed(false);
        setActiveNode(node);
        setActiveDeck(node.deck || decks[0] || null);
        setView('study');
    };

    const startStudyAll = () => {
        const now = Date.now();
        const allDue: SessionCard[] = [];
        for (const deck of decks) {
            for (const card of deck.cards) {
                if (card.nextDue <= now) allDue.push({ ...card, deckId: deck.id });
            }
        }
        if (allDue.length === 0) { AlertService.alert('All Caught Up!', 'No cards are due for review right now.'); return; }
        const shuffled = [...allDue].sort(() => Math.random() - 0.5);
        setSessionCards(shuffled);
        setCardIndex(0);
        setIsFlipped(false);
        setSessionDone(false);
        setSessionStats({ again: 0, hard: 0, good: 0, easy: 0, mastered: 0 });
        setActiveNode(null);
        setActiveDeck(decks[0] || null);
        setView('study');
    };

    const handleRate = async (rating: 1 | 2 | 3 | 4) => {
        const card = sessionCards[cardIndex];
        const updatedCard = applyRating(card, rating, srSettings);
        const nd = [...decks];
        const di = nd.findIndex(d => d.id === card.deckId);
        if (di >= 0) {
            nd[di].cards = nd[di].cards.map(c => c.id === card.id ? updatedCard : c);
            await saveDecks(nd);
            if (activeDeck?.id === card.deckId) setActiveDeck(nd[di]);
        }
        const ratingKey: Record<number, keyof Omit<typeof sessionStats, 'mastered'>> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
        let justMastered = false;
        if (card.interval === 0 && updatedCard.interval > 0) justMastered = true;
        setSessionStats(prev => ({ ...prev, [ratingKey[rating]]: prev[ratingKey[rating]] + 1, mastered: prev.mastered + (justMastered ? 1 : 0) }));
        const REQUEUE_WINDOW_MS = 20 * 60 * 1000;
        const shouldRequeue = updatedCard.interval === 0 && (updatedCard.nextDue - Date.now()) < REQUEUE_WINDOW_MS;
        if (shouldRequeue) setSessionCards(prev => [...prev, { ...updatedCard, deckId: card.deckId }]);
        if (cardIndex + 1 >= sessionCards.length && !shouldRequeue) {
            setSessionDone(true);
            const todayStr = new Date().toISOString().split('T')[0];
            let newStreak = flashcardStats.currentStreak;
            if (flashcardStats.lastStudyDate !== todayStr) {
                const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                newStreak = flashcardStats.lastStudyDate === yesterdayStr ? newStreak + 1 : 1;
            }
            saveStats({ lastStudyDate: todayStr, currentStreak: newStreak, masteredToday: (flashcardStats.lastStudyDate === todayStr ? flashcardStats.masteredToday : 0) + sessionStats.mastered + (justMastered ? 1 : 0) });
        } else {
            setIsFlipped(false);
            setTimeout(() => setCardIndex(prev => prev + 1), 120);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // File import
    // ─────────────────────────────────────────────────────────────────────────

    const handlePickFile = async () => {
        try {
            setImportLoading(true);
            const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/csv', 'application/csv', '*/*'], copyToCacheDirectory: true });
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
        } finally { setImportLoading(false); }
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
        const di = nd.findIndex(d => d.id === activeDeck.id);
        parsedImport.forEach(({ front, back }) => nd[di].cards.push(makeNewCard(front, back)));
        await saveDecks(nd);
        setActiveDeck(nd[di]);
        const count = parsedImport.length;
        setParsedImport([]); setImportFileName(''); setShowImportModal(false);
        AlertService.alert('Imported!', `${count} card${count !== 1 ? 's' : ''} added to "${activeDeck.name}".`);
    };

    const closeImportModal = () => { setShowImportModal(false); setParsedImport([]); setImportFileName(''); setImportText(''); };

    // ─────────────────────────────────────────────────────────────────────────
    // Quiz logic
    // ─────────────────────────────────────────────────────────────────────────

    const generateQuiz = (node: DeckNode, onlyMissed?: QuizQuestion[]) => {
        const allCards = collectCards(node);
        if (allCards.length < 2) { AlertService.alert('Not Enough Cards', 'You need at least 2 cards for a quiz.'); return; }

        let source: SessionCard[];
        if (onlyMissed) {
            const missedIds = new Set(onlyMissed.map(q => q.cardId));
            source = allCards.filter(c => missedIds.has(c.id));
        } else {
            source = [...allCards].sort(() => Math.random() - 0.5).slice(0, Math.min(10, allCards.length));
        }

        const questions: QuizQuestion[] = source.map(card => {
            const otherBacks = allCards.filter(c => c.id !== card.id).map(c => c.back);
            const shuffledOthers = [...otherBacks].sort(() => Math.random() - 0.5);
            const distractors = shuffledOthers.slice(0, 3);
            const options = [...distractors, card.back].sort(() => Math.random() - 0.5);
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
        if (quizSelected !== null) return; // already answered
        setQuizSelected(answer);
        const q = quizQuestions[quizIndex];
        const isCorrect = answer === q.correctAnswer;
        if (isCorrect) {
            setQuizScore(prev => prev + 1);
        } else {
            setQuizMissed(prev => [...prev, q]);
        }
        // Auto-advance after delay
        setTimeout(() => {
            if (quizIndex + 1 >= quizQuestions.length) {
                setQuizDone(true);
            } else {
                setQuizIndex(prev => prev + 1);
                setQuizSelected(null);
            }
        }, 1200);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Match game logic
    // ─────────────────────────────────────────────────────────────────────────

    const startMatch = (node: DeckNode) => {
        const allCards = collectCards(node);
        if (allCards.length < 2) { AlertService.alert('Not Enough Cards', 'You need at least 2 cards for the matching game.'); return; }

        const selected = [...allCards].sort(() => Math.random() - 0.5).slice(0, Math.min(8, allCards.length));
        const cards: MatchCard[] = [];
        selected.forEach(card => {
            cards.push({ id: generateId(), pairId: card.id, text: card.front, isTerm: true });
            cards.push({ id: generateId(), pairId: card.id, text: card.back, isTerm: false });
        });
        // Shuffle
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
        if (matchRevealed.length >= 2) return; // wait for mismatch timeout
        if (matchRevealed.includes(cardId)) return; // already revealed
        const card = matchCards.find(c => c.id === cardId);
        if (!card || matchMatched.has(card.pairId)) return; // already matched

        const newRevealed = [...matchRevealed, cardId];
        setMatchRevealed(newRevealed);

        if (newRevealed.length === 2) {
            setMatchMoves(prev => prev + 1);
            const [first, second] = newRevealed.map(id => matchCards.find(c => c.id === id)!);
            if (first.pairId === second.pairId && first.isTerm !== second.isTerm) {
                // Match!
                setTimeout(() => {
                    setMatchMatched(prev => {
                        const next = new Set(prev);
                        next.add(first.pairId);
                        // Check if all matched
                        const totalPairs = matchCards.length / 2;
                        if (next.size >= totalPairs) {
                            setMatchDone(true);
                            setMatchElapsed(Math.floor((Date.now() - matchStartTime) / 1000));
                        }
                        return next;
                    });
                    setMatchRevealed([]);
                }, 400);
            } else {
                // Mismatch — flip back
                setTimeout(() => setMatchRevealed([]), 800);
            }
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    const getNextDueText = (node: DeckNode): string => {
        const now = Date.now();
        let soonest = Infinity;
        const checkCards = (n: DeckNode) => {
            if (n.deck) { for (const c of n.deck.cards) { if (c.nextDue > now && c.nextDue < soonest) soonest = c.nextDue; } }
            for (const child of n.children.values()) checkCards(child);
        };
        checkCards(node);
        if (soonest === Infinity) return '';
        const diffSec = Math.floor((soonest - now) / 1000);
        if (diffSec < 60) return `${diffSec}s`;
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
        return `${Math.floor(diffSec / 86400)}d`;
    };

    const getCardStatus = (card: Flashcard): 'new' | 'learning' | 'due' | 'mastered' => {
        const now = Date.now();
        if (card.reviewCount === 0) return 'new';
        if (card.interval === 0) return 'learning';
        if (card.nextDue <= now) return 'due';
        return 'mastered';
    };

    const STATUS_CONFIG = {
        new: { label: 'New', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
        learning: { label: 'Learning', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
        due: { label: 'Review', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
        mastered: { label: 'Mastered', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    };


    // ─────────────────────────────────────────────────────────────────────────
    // Render: Decks Tree (Redesigned)
    // ─────────────────────────────────────────────────────────────────────────

    const renderDecks = () => {
        const totalCards = decks.reduce((sum, d) => sum + d.cards.length, 0);
        const theme = getTheme(isDark);

        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, zIndex: 10, borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9', backgroundColor: theme.surface, ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 } : {}) }}>
                    <View>
                        <Text style={{ ...Typography.title, color: theme.text }}>Flash Study</Text>
                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, marginTop: 2, color: theme.textSecondary }}>
                            {decks.length} deck{decks.length !== 1 ? 's' : ''} · {totalCards} cards
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity onPress={() => setShowCreateSheet(true)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, ...(!isDark ? { shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 } : {}) }}>
                            <Ionicons name="add" size={24} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setSettingsForm({ learningSteps: srSettings.learningSteps || '1 10', graduatingInterval: String(srSettings.graduatingInterval || 1), easyInterval: String(srSettings.easyInterval || 4), studyTimeHour: String(srSettings.studyTimeHour ?? 8), studyTimeMinute: String(srSettings.studyTimeMinute ?? 0) }); setShowSettingsModal(true); }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}>
                            <Ionicons name="settings-sharp" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {loading ? (
                    <ListSkeleton count={4} cardHeight={70} />
                ) : decks.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-8 pb-20">
                        <View className="w-24 h-24 bg-indigo-500/10 rounded-full items-center justify-center mb-6">
                            <Ionicons name="albums-outline" size={48} color="#6366f1" />
                        </View>
                        <Text className={`font-nunito-black text-2xl text-center mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Your Study Space</Text>
                        <Text className={`font-nunito text-center text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Create your first flashcard deck to start memorizing effectively.</Text>
                        <TouchableOpacity onPress={() => openAddDeck()} className="mt-8 bg-indigo-500 px-8 py-4 rounded-full shadow-lg shadow-indigo-500/30">
                            <Text className="font-nunito-bold text-white text-base">Create Deck</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                        {/* Global Study Dashboard */}
                        <View className={`rounded-3xl p-5 mb-5 border ${isDark ? 'bg-[#1a1a1b] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm shadow-slate-900/5'}`}>
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center" style={{ gap: 8 }}>
                                    <View className="flex-row items-center" style={{ display: flashcardStats.currentStreak > 0 ? 'flex' : 'none' }}>
                                        <Text className="font-nunito-black text-lg text-orange-500">{flashcardStats.currentStreak}</Text>
                                        <Text className="text-sm ml-0.5">🔥</Text>
                                    </View>
                                </View>
                                <View className={`px-2.5 py-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Text className={`font-nunito text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{totalCards} total cards</Text>
                                </View>
                            </View>
                            {totalDueNow > 0 ? (
                                <View className="items-center mb-4">
                                    <Text className="font-nunito-black text-5xl text-indigo-500">{totalDueNow}</Text>
                                    <Text className={`font-nunito-bold text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>card{totalDueNow !== 1 ? 's' : ''} due now</Text>
                                </View>
                            ) : nextDueIn ? (
                                <View className="items-center mb-4">
                                    <Text className={`font-nunito-black text-3xl ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>All clear!</Text>
                                    <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
                                        <Ionicons name="time-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                                        <Text className={`font-nunito text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Next review in <Text className="font-nunito-bold text-indigo-500">{nextDueIn}</Text></Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="items-center mb-4">
                                    <Text className={`font-nunito-black text-3xl ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>All caught up!</Text>
                                    <Text className={`font-nunito text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No cards scheduled for review</Text>
                                </View>
                            )}
                            <TouchableOpacity onPress={startStudyAll} className="bg-indigo-500 py-3.5 rounded-2xl items-center shadow-lg shadow-indigo-500/30" style={{ display: totalDueNow > 0 ? 'flex' : 'none' }}>
                                <Text className="font-nunito-bold text-white text-base">Study All Due</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Deck Tree */}
                        {(() => {
                            const tree = buildDeckTree(decks);
                            const renderTreeNode = (node: DeckNode, depth: number = 0) => {
                                const isExpanded = expandedNodes.has(node.fullPath);
                                const hasChildren = node.children.size > 0;
                                const stats = getNodeStats(node);
                                const isTopLevel = depth === 0;
                                const dueNowCount = stats.due + stats.learning;
                                const nextText = dueNowCount === 0 && stats.new === 0 ? getNextDueText(node) : '';
                                const deckColor = node.deck?.color || '#6366f1';

                                return (
                                    <View key={node.fullPath} style={{ marginLeft: depth > 0 ? 14 : 0 }} className="mb-2.5">
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                setActiveNode(node);
                                                setActiveDeck(node.deck);
                                                setDetailSearch('');
                                                setDetailFilter('all');
                                                setView('detail');
                                            }}
                                            onLongPress={() => {
                                                showDeckActions(node);
                                            }}
                                            className={`flex-row items-center rounded-2xl border overflow-hidden ${isDark ? 'bg-[#1a1a1b] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm shadow-slate-900/5'}`}
                                        >
                                            {/* Color accent bar */}
                                            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: hasChildren && !node.deck ? (isDark ? '#475569' : '#cbd5e1') : deckColor, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />

                                            {/* Expand/collapse */}
                                            {hasChildren ? (
                                                <TouchableOpacity className="justify-center pl-3 pr-1.5 py-4" onPress={() => toggleNode(node.fullPath)}>
                                                    <View className={`w-7 h-7 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                        <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={15} color={isDark ? '#cbd5e1' : '#475569'} />
                                                    </View>
                                                </TouchableOpacity>
                                            ) : (
                                                <View className="justify-center pl-3 pr-1.5 py-4">
                                                    <View className="w-7 h-7 rounded-full items-center justify-center">
                                                        <Ionicons name={node.deck ? "albums-outline" : "folder-outline"} size={15} color={isDark ? '#475569' : '#cbd5e1'} />
                                                    </View>
                                                </View>
                                            )}

                                            {/* Content */}
                                            <View className="flex-1 flex-row items-center py-3.5 pr-4">
                                                <View className="flex-1 mr-2">
                                                    <Text className={`font-nunito-bold text-[15px] ${isDark ? 'text-slate-100' : 'text-slate-800'}`} numberOfLines={1}>{node.name}</Text>
                                                    <Text className={`font-nunito text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {stats.total} card{stats.total !== 1 ? 's' : ''}
                                                        {nextText ? ` · next in ${nextText}` : ''}
                                                    </Text>
                                                </View>
                                                {/* Status badges */}
                                                <View className="flex-row items-center" style={{ gap: 5 }}>
                                                    <View className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-violet-900/30' : 'bg-violet-50'}`} style={{ display: stats.new > 0 ? 'flex' : 'none' }}><Text className={`font-nunito-bold text-[11px] ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{stats.new}</Text></View>
                                                    <View className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-900/30' : 'bg-orange-50'}`} style={{ display: stats.learning > 0 ? 'flex' : 'none' }}><Text className={`font-nunito-bold text-[11px] ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{stats.learning}</Text></View>
                                                    <View className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`} style={{ display: stats.due > 0 ? 'flex' : 'none' }}><Text className={`font-nunito-bold text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.due}</Text></View>
                                                    <View style={{ display: dueNowCount === 0 && stats.new === 0 && stats.total > 0 ? 'flex' : 'none' }}><Ionicons name="checkmark-circle" size={18} color={isDark ? '#22c55e' : '#16a34a'} /></View>
                                                </View>
                                            </View>
                                        </TouchableOpacity>

                                        {hasChildren && isExpanded && (
                                            <View className="pt-1.5">
                                                {Array.from(node.children.values()).map(child => renderTreeNode(child, depth + 1))}
                                            </View>
                                        )}
                                    </View>
                                );
                            };
                            return tree.map(node => renderTreeNode(node));
                        })()}
                    </ScrollView>
                )}
            </SafeAreaView>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Deck Detail (NEW)
    // ─────────────────────────────────────────────────────────────────────────

    const renderDetail = () => {
        if (!activeNode) return null;
        const theme = getTheme(isDark);
        const stats = getNodeStats(activeNode);
        const allCards = collectCards(activeNode);
        const deck = activeNode.deck ? (decks.find(d => d.id === activeNode.deck!.id) || activeNode.deck) : null;
        const color = deck?.color || '#6366f1';
        const masteredPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;

        // Filtered cards for terms list
        let filteredCards = allCards;
        if (detailSearch.trim()) {
            const q = detailSearch.toLowerCase();
            filteredCards = filteredCards.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q));
        }
        if (detailFilter !== 'all') {
            filteredCards = filteredCards.filter(c => getCardStatus(c) === detailFilter);
        }

        const studyModes = [
            { id: 'flashcards', icon: 'albums-outline' as const, title: 'Flashcards', desc: 'Flip & rate your recall', color: '#6366f1' },
            { id: 'spaced', icon: 'refresh-outline' as const, title: 'Spaced Rep.', desc: 'Study only due cards', color: '#3b82f6' },
            { id: 'match', icon: 'grid-outline' as const, title: 'Matching', desc: 'Match terms to defs', color: '#f97316' },
            { id: 'quiz', icon: 'document-text-outline' as const, title: 'Practice Test', desc: 'Multiple choice quiz', color: '#10b981' },
            { id: 'exam', icon: 'calendar-outline' as const, title: 'Exam Prep', desc: 'Schedule by exam date', color: '#ec4899' },
        ];

        // Compute next review time (once per render, not per-second — no lag)
        const nextReviewText = getNextDueText(activeNode);

        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9', backgroundColor: theme.surface }}>
                    <TouchableOpacity onPress={() => setView('decks')} className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <Ionicons name="arrow-back" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className={`font-nunito-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{activeNode.name}</Text>
                        <Text className={`font-nunito text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`} numberOfLines={1}>{activeNode.fullPath}</Text>
                    </View>
                    <TouchableOpacity onPress={() => showDeckActions(activeNode)} className={`w-9 h-9 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                    {/* Study Progress */}
                    <View className={`mx-5 mt-4 p-5 rounded-3xl border ${isDark ? 'bg-[#1a1a1b] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className={`font-nunito-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>Study Progress</Text>
                            <View className="flex-row items-center" style={{ gap: 4 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 10, color }}>{masteredPct}%</Text>
                                </View>
                            </View>
                        </View>
                        {/* Next review timer */}
                        {(stats.due + stats.learning > 0) ? (
                            <View className={`flex-row items-center mb-3 px-3 py-2 rounded-xl ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                                <Ionicons name="flash-outline" size={14} color="#3b82f6" />
                                <Text className={`font-nunito-bold text-xs ml-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.due + stats.learning} card{(stats.due + stats.learning) !== 1 ? 's' : ''} ready to review now</Text>
                            </View>
                        ) : nextReviewText ? (
                            <View className={`flex-row items-center mb-3 px-3 py-2 rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                                <Ionicons name="time-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                                <Text className={`font-nunito text-xs ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Next review in <Text className={`font-nunito-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{nextReviewText}</Text></Text>
                            </View>
                        ) : null}
                        {/* Progress bars */}
                        {([
                            { key: 'new', label: 'New', count: stats.new, color: '#8b5cf6' },
                            { key: 'learning', label: 'Learning', count: stats.learning, color: '#f97316' },
                            { key: 'due', label: 'Review', count: stats.due, color: '#3b82f6' },
                            { key: 'mastered', label: 'Mastered', count: stats.mastered, color: '#10b981' },
                        ] as const).map(item => (
                            <View key={item.key} className="flex-row items-center mb-2.5">
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 10 }} />
                                <Text className={`font-nunito-bold text-xs w-20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</Text>
                                <View className={`flex-1 h-2.5 rounded-full mx-2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <View style={{ width: stats.total > 0 ? `${(item.count / stats.total) * 100}%` : '0%', backgroundColor: item.color, height: '100%', borderRadius: 999 }} />
                                </View>
                                <Text className={`font-nunito-bold text-xs w-8 text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.count}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Study Modes Grid */}
                    <View className="mx-5 mt-4">
                        <Text className={`font-nunito-black text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Study Modes</Text>
                        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                            {studyModes.map(mode => (
                                <TouchableOpacity
                                    key={mode.id}
                                    onPress={() => {
                                        if (mode.id === 'flashcards') startStudy(activeNode, true);
                                        else if (mode.id === 'spaced') startStudy(activeNode, false);
                                        else if (mode.id === 'match') startMatch(activeNode);
                                        else if (mode.id === 'quiz') generateQuiz(activeNode);
                                        else if (mode.id === 'exam') { setExamPlan(null); setExamReviewsPerDay(0); setShowExamModal(true); }
                                    }}
                                    className={`rounded-2xl p-4 border ${isDark ? 'bg-[#1a1a1b] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm'}`}
                                    style={{ width: (SCREEN_WIDTH - 52) / 2 }}
                                >
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: mode.color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                        <Ionicons name={mode.icon} size={18} color={mode.color} />
                                    </View>
                                    <Text className={`font-nunito-bold text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{mode.title}</Text>
                                    <Text className={`font-nunito text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{mode.desc}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Terms Section */}
                    <View className="mx-5 mt-6">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className={`font-nunito-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>Terms ({allCards.length})</Text>
                            <View className="flex-row items-center" style={{ gap: 8 }}>
                                {deck && (
                                    <TouchableOpacity onPress={() => { setActiveDeck(deck); setShowImportModal(true); }} className={`flex-row items-center px-3 h-8 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Ionicons name="cloud-upload-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                                        <Text className={`font-nunito-bold text-[11px] ml-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Import</Text>
                                    </TouchableOpacity>
                                )}
                                {deck && (
                                    <TouchableOpacity onPress={openAddCard} className="flex-row items-center px-3 h-8 rounded-full" style={{ backgroundColor: color }}>
                                        <Ionicons name="add" size={14} color="white" />
                                        <Text className="font-nunito-bold text-[11px] ml-0.5 text-white">Add</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Search */}
                        <View className={`flex-row items-center rounded-2xl px-4 mb-3 ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'}`}>
                            <Ionicons name="search" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                            <TextInput
                                value={detailSearch}
                                onChangeText={setDetailSearch}
                                placeholder="Search terms/definitions"
                                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                className={`flex-1 py-2.5 ml-2 font-nunito text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}
                            />
                            {detailSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setDetailSearch('')}>
                                    <Ionicons name="close-circle" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filter tabs */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                            <View className="flex-row" style={{ gap: 8 }}>
                                {([
                                    { key: 'all', label: `All (${allCards.length})` },
                                    { key: 'new', label: `New (${stats.new})` },
                                    { key: 'learning', label: `Learning (${stats.learning})` },
                                    { key: 'due', label: `Due (${stats.due})` },
                                ] as const).map(tab => (
                                    <TouchableOpacity
                                        key={tab.key}
                                        onPress={() => setDetailFilter(tab.key)}
                                        className={`px-3.5 py-1.5 rounded-full ${detailFilter === tab.key ? 'bg-indigo-500' : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`}
                                    >
                                        <Text className={`font-nunito-bold text-[11px] ${detailFilter === tab.key ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{tab.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* Card list */}
                        {filteredCards.length === 0 ? (
                            <View className="py-8 items-center">
                                <Text className={`font-nunito text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No cards found</Text>
                            </View>
                        ) : (
                            filteredCards.map((card, idx) => {
                                const status = getCardStatus(card);
                                const cfg = STATUS_CONFIG[status];
                                return (
                                    <View key={card.id} className={`mb-2.5 p-4 rounded-2xl border ${isDark ? 'bg-[#1a1a1b] border-slate-800/60' : 'bg-white border-slate-100'}`}>
                                        <View className="flex-row items-start">
                                            <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <Text className={`font-nunito-bold text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{idx + 1}</Text>
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center mb-1.5">
                                                    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                                                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: cfg.color }}>{cfg.label}</Text>
                                                    </View>
                                                </View>
                                                <Text className={`font-nunito-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{card.front}</Text>
                                                <Text className={`font-nunito text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{card.back}</Text>
                                            </View>
                                            {deck && (
                                                <View className="flex-row items-center ml-2" style={{ gap: 10 }}>
                                                    <TouchableOpacity onPress={() => { setActiveDeck(deck); setEditingCard(card); setCardForm({ front: card.front, back: card.back }); setShowAddCardModal(true); }}>
                                                        <Ionicons name="pencil-outline" size={15} color={isDark ? '#64748b' : '#94a3b8'} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => { setActiveDeck(deck); handleDeleteCard(card); }}>
                                                        <Ionicons name="trash-outline" size={15} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </ScrollView>

                {/* Bottom CTA */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12, backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)', borderTopWidth: 1, borderTopColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                    <TouchableOpacity onPress={() => startStudy(activeNode, true)} style={{ backgroundColor: color }} className="py-4 rounded-2xl items-center shadow-lg">
                        <Text className="font-nunito-bold text-white text-base">Study Flashcards</Text>
                    </TouchableOpacity>
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
                for (const card of deck.cards) {
                    if (card.nextDue <= now) moreDueNow++;
                    else if (card.nextDue < soonestDue) soonestDue = card.nextDue;
                }
            }
            const nextDueDiffSec = soonestDue < Infinity ? Math.floor((soonestDue - now) / 1000) : -1;
            let nextDueLabel = '';
            if (nextDueDiffSec > 0 && nextDueDiffSec < 60) nextDueLabel = `${nextDueDiffSec}s`;
            else if (nextDueDiffSec >= 60 && nextDueDiffSec < 3600) nextDueLabel = `${Math.floor(nextDueDiffSec / 60)}m`;
            else if (nextDueDiffSec >= 3600 && nextDueDiffSec < 86400) nextDueLabel = `${Math.floor(nextDueDiffSec / 3600)}h ${Math.floor((nextDueDiffSec % 3600) / 60)}m`;
            else if (nextDueDiffSec >= 86400) nextDueLabel = `${Math.floor(nextDueDiffSec / 86400)}d`;

            return (
                <SafeAreaView className={`flex-1 px-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    <View className="flex-1 items-center justify-center">
                        <Image source={require('../../assets/images/happy.png')} style={{ width: 110, height: 110, marginBottom: 20 }} resizeMode="contain" />
                        <Text className={`font-nunito-black text-3xl text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Session Complete!</Text>
                        <Text className={`font-nunito text-sm text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>You reviewed {sessionCards.length} card{sessionCards.length !== 1 ? 's' : ''}. Fin is proud of you!</Text>
                        <View className={`w-full p-6 rounded-3xl mb-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <Text className={`font-nunito-bold text-xs text-center tracking-widest mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>SESSION ANALYTICS</Text>
                            <View className="flex-row justify-around items-center">
                                <View className="items-center flex-1 border-r border-slate-200 dark:border-slate-800">
                                    <Text className="font-nunito-black text-3xl text-indigo-500">{sessionCards.length > 0 ? Math.round(((sessionCards.length - sessionStats.again) / sessionCards.length) * 100) : 0}%</Text>
                                    <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Accuracy</Text>
                                </View>
                                <View className="items-center flex-1 border-r border-slate-200 dark:border-slate-800">
                                    <Text className="font-nunito-black text-3xl text-emerald-500">{sessionStats.mastered}</Text>
                                    <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Mastered</Text>
                                </View>
                                <View className="items-center flex-1">
                                    <View className="flex-row items-center justify-center">
                                        <Text className="font-nunito-black text-3xl text-orange-500">{flashcardStats.currentStreak}</Text>
                                        <Text className="text-xl ml-1">🔥</Text>
                                    </View>
                                    <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Day Streak</Text>
                                </View>
                            </View>
                        </View>
                        {moreDueNow > 0 ? (
                            <View className={`w-full p-4 rounded-2xl mb-6 ${isDark ? 'bg-indigo-950/40 border border-indigo-800/30' : 'bg-indigo-50 border border-indigo-100'}`}>
                                <Text className={`font-nunito-bold text-center text-sm ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{moreDueNow} more card{moreDueNow !== 1 ? 's' : ''} due right now!</Text>
                            </View>
                        ) : nextDueLabel ? (
                            <View className={`w-full p-4 rounded-2xl mb-6 flex-row items-center justify-center ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="time-outline" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                                <Text className={`font-nunito text-sm ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Next review in <Text className="font-nunito-bold text-indigo-500">{nextDueLabel}</Text></Text>
                            </View>
                        ) : null}
                        <View className="flex-row w-full" style={{ gap: 12 }}>
                            <TouchableOpacity onPress={() => { setView(activeNode ? 'detail' : 'decks'); }} className={`flex-1 py-4 rounded-2xl items-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Text className={`font-nunito-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{activeNode ? 'Back to Deck' : 'All Decks'}</Text>
                            </TouchableOpacity>
                            {moreDueNow > 0 ? (
                                <TouchableOpacity onPress={startStudyAll} className="flex-1 py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30">
                                    <Text className="font-nunito-bold text-white">Continue ({moreDueNow})</Text>
                                </TouchableOpacity>
                            ) : activeNode ? (
                                <TouchableOpacity onPress={() => startStudy(activeNode)} style={{ backgroundColor: activeDeck?.color || '#6366f1', flex: 1 }} className="py-4 rounded-2xl items-center">
                                    <Text className="font-nunito-bold text-white">Study Again</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                </SafeAreaView>
            );
        }

        const card = sessionCards[cardIndex];
        const progress = cardIndex / sessionCards.length;

        return (
            <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <View className="flex-row justify-between items-center px-6 py-4">
                    <TouchableOpacity onPress={() => setView(activeNode ? 'detail' : 'decks')} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm shadow-slate-200'}`}>
                        <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{activeNode ? (activeNode.deck?.name || activeNode.name) : 'All Decks'}</Text>
                        <Text className={`font-nunito text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cardIndex + 1} / {sessionCards.length}</Text>
                    </View>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        <TouchableOpacity onPress={() => { setStudyReversed(r => !r); setIsFlipped(false); }} className={`w-10 h-10 rounded-full items-center justify-center ${studyReversed ? 'bg-indigo-500/20 border border-indigo-500/40' : isDark ? 'bg-slate-800' : 'bg-white shadow-sm shadow-slate-200'}`}>
                            <Ionicons name="swap-vertical" size={18} color={studyReversed ? '#6366f1' : isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setView('manage')} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm shadow-slate-200'}`}>
                            <Ionicons name="list" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                    </View>
                </View>
                <View className={`mx-6 h-2 rounded-full mb-8 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <View style={{ width: `${progress * 100}%`, backgroundColor: activeDeck?.color || '#6366f1', height: '100%', borderRadius: 999 }} />
                </View>
                <View className="flex-1 items-center justify-center px-6">
                    <FlipCard front={studyReversed ? card.back : card.front} back={studyReversed ? card.front : card.back} isFlipped={isFlipped} onFlip={() => setIsFlipped(f => !f)} color={activeDeck?.color || '#6366f1'} isDark={isDark} frontLabel={studyReversed ? 'DEFINITION' : 'TERM'} backLabel={studyReversed ? 'TERM' : 'DEFINITION'} />
                    {!isFlipped && <Text className={`font-nunito text-xs mt-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Tap the card to reveal the {studyReversed ? 'term' : 'definition'}</Text>}
                </View>
                <View className={`px-6 pb-24 ${isFlipped ? '' : 'opacity-0 pointer-events-none'}`}>
                    <Text className={`font-nunito-bold text-xs text-center mb-4 tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>HOW WELL DID YOU KNOW THIS?</Text>
                    <View className="flex-row" style={{ gap: 10 }}>
                        {(() => {
                            const isNew = card.interval === 0;
                            const formatMin = (m: number) => m < 60 ? `<${m}m` : (m < 1440 ? `<${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`);
                            const formatDay = (d: number) => d < 1 ? '<1d' : `${Math.round(d)}d`;
                            const parseSteps = (str: string | undefined) => { const p = (str || '1 10').split(' ').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)); return p.length > 0 ? p : [1, 10]; };
                            const steps = parseSteps(srSettings.learningSteps);
                            const stepIndex = card.stepIndex || 0;
                            const againSub = formatMin(steps[0]);
                            const hardSub = isNew ? formatMin(steps[stepIndex]) : formatDay(Math.max(1, card.interval * 1.2));
                            let goodSub = '';
                            if (isNew) { goodSub = stepIndex + 1 >= steps.length ? formatDay(srSettings.graduatingInterval || 1) : formatMin(steps[stepIndex + 1]); }
                            else { goodSub = formatDay(Math.max(1, card.interval * card.easeFactor)); }
                            const easySub = isNew ? formatDay(srSettings.easyInterval || 4) : formatDay(Math.max(1, card.interval * card.easeFactor * 1.3));
                            return ([
                                { rating: 1 as const, label: 'Again', sub: againSub, color: '#ef4444', darkBg: '#450a0a', lightBg: '#fff1f2' },
                                { rating: 2 as const, label: 'Hard', sub: hardSub, color: '#f97316', darkBg: '#431407', lightBg: '#fff7ed' },
                                { rating: 3 as const, label: 'Good', sub: goodSub, color: '#3b82f6', darkBg: '#1e3a5f', lightBg: '#eff6ff' },
                                { rating: 4 as const, label: 'Easy', sub: easySub, color: '#10b981', darkBg: '#022c22', lightBg: '#ecfdf5' },
                            ]).map(btn => (
                                <TouchableOpacity key={btn.rating} onPress={() => isFlipped && handleRate(btn.rating)} style={{ backgroundColor: isDark ? btn.darkBg : btn.lightBg, borderColor: btn.color + '50', flex: 1 }} className="py-3.5 rounded-2xl items-center border">
                                    <Text style={{ color: btn.color }} className="font-nunito-black text-sm">{btn.label}</Text>
                                    <Text style={{ color: btn.color + '99' }} className="font-nunito text-[10px]">{btn.sub}</Text>
                                </TouchableOpacity>
                            ));
                        })()}
                    </View>
                </View>
            </SafeAreaView>
        );
    };


    // ─────────────────────────────────────────────────────────────────────────
    // Render: Practice Test / Quiz (NEW)
    // ─────────────────────────────────────────────────────────────────────────

    const renderQuiz = () => {
        if (quizQuestions.length === 0) return null;

        // Score screen
        if (quizDone) {
            const pct = quizQuestions.length > 0 ? Math.round((quizScore / quizQuestions.length) * 100) : 0;
            return (
                <SafeAreaView className={`flex-1 px-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    <View className="flex-1 items-center justify-center">
                        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: pct >= 70 ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                            <Ionicons name={pct >= 70 ? 'trophy-outline' : 'school-outline'} size={48} color={pct >= 70 ? '#10b981' : '#f97316'} />
                        </View>
                        <Text className={`font-nunito-black text-3xl text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>{pct}%</Text>
                        <Text className={`font-nunito text-sm text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            You got {quizScore} out of {quizQuestions.length} correct
                        </Text>

                        {quizMissed.length > 0 && (
                            <View className={`w-full p-5 rounded-3xl mb-6 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                <Text className={`font-nunito-bold text-xs tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>MISSED TERMS ({quizMissed.length})</Text>
                                {quizMissed.map((q, i) => (
                                    <View key={i} className={`mb-3 pb-3 ${i < quizMissed.length - 1 ? (isDark ? 'border-b border-slate-800' : 'border-b border-slate-100') : ''}`}>
                                        <Text className={`font-nunito-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{q.question}</Text>
                                        <Text className={`font-nunito text-xs mt-1 text-emerald-500`}>{q.correctAnswer}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View className="flex-row w-full" style={{ gap: 12 }}>
                            <TouchableOpacity onPress={() => setView('detail')} className={`flex-1 py-4 rounded-2xl items-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Text className={`font-nunito-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Back to Deck</Text>
                            </TouchableOpacity>
                            {quizMissed.length > 0 && activeNode && (
                                <TouchableOpacity onPress={() => generateQuiz(activeNode, quizMissed)} className="flex-1 py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30">
                                    <Text className="font-nunito-bold text-white">Retry Missed ({quizMissed.length})</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            );
        }

        const q = quizQuestions[quizIndex];
        const progress = (quizIndex) / quizQuestions.length;

        return (
            <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                {/* Header */}
                <View className="flex-row justify-between items-center px-6 py-4">
                    <TouchableOpacity onPress={() => setView('detail')} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                        <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                    <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Practice Test</Text>
                    <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{quizIndex + 1}/{quizQuestions.length}</Text>
                </View>

                {/* Progress bar */}
                <View className={`mx-6 h-2 rounded-full mb-8 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <View style={{ width: `${progress * 100}%`, backgroundColor: '#10b981', height: '100%', borderRadius: 999 }} />
                </View>

                {/* Question */}
                <View className="flex-1 px-6">
                    <View className={`p-6 rounded-3xl mb-8 border ${isDark ? 'bg-[#1a1a1b] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <Text className={`font-nunito-bold text-xs tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>QUESTION {quizIndex + 1}</Text>
                        <Text className={`font-nunito-black text-lg leading-relaxed ${isDark ? 'text-white' : 'text-slate-800'}`}>{q.question}</Text>
                    </View>

                    {/* Answer options */}
                    <View style={{ gap: 12 }}>
                        {q.options.map((option, idx) => {
                            const isSelected = quizSelected === option;
                            const isCorrect = option === q.correctAnswer;
                            const showResult = quizSelected !== null;
                            let bgColor = isDark ? '#1a1a1b' : '#ffffff';
                            let borderColor = isDark ? '#334155' : '#e2e8f0';
                            let textColor = isDark ? '#e2e8f0' : '#334155';

                            if (showResult) {
                                if (isCorrect) { bgColor = 'rgba(16,185,129,0.12)'; borderColor = '#10b981'; textColor = '#10b981'; }
                                else if (isSelected && !isCorrect) { bgColor = 'rgba(239,68,68,0.12)'; borderColor = '#ef4444'; textColor = '#ef4444'; }
                                else { textColor = isDark ? '#475569' : '#94a3b8'; }
                            }

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => handleQuizAnswer(option)}
                                    disabled={quizSelected !== null}
                                    style={{ backgroundColor: bgColor, borderColor }}
                                    className="p-4 rounded-2xl border flex-row items-center"
                                >
                                    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: showResult && isCorrect ? '#10b981' : (showResult && isSelected ? '#ef4444' : (isDark ? '#475569' : '#cbd5e1')), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        {showResult && isCorrect && <Ionicons name="checkmark" size={16} color="#10b981" />}
                                        {showResult && isSelected && !isCorrect && <Ionicons name="close" size={16} color="#ef4444" />}
                                        {!showResult && <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>{String.fromCharCode(65 + idx)}</Text>}
                                    </View>
                                    <Text style={{ color: textColor, fontFamily: 'Nunito_700Bold', fontSize: 14, flex: 1 }}>{option}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Score indicator */}
                <View className="px-6 pb-8 pt-4">
                    <View className="flex-row items-center justify-center" style={{ gap: 16 }}>
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{quizScore}</Text>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                            <Ionicons name="close-circle" size={16} color="#ef4444" />
                            <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{quizMissed.length}</Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Matching Game (NEW)
    // ─────────────────────────────────────────────────────────────────────────

    const renderMatch = () => {
        if (matchCards.length === 0) return null;

        // Completion screen
        if (matchDone) {
            const totalPairs = matchCards.length / 2;
            const accuracy = matchMoves > 0 ? Math.round((totalPairs / matchMoves) * 100) : 100;
            const mins = Math.floor(matchElapsed / 60);
            const secs = matchElapsed % 60;

            return (
                <SafeAreaView className={`flex-1 px-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    <View className="flex-1 items-center justify-center">
                        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                            <Ionicons name="grid-outline" size={48} color="#f97316" />
                        </View>
                        <Text className={`font-nunito-black text-3xl text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>All Matched!</Text>
                        <Text className={`font-nunito text-sm text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>You matched all {totalPairs} pairs</Text>

                        <View className={`w-full p-6 rounded-3xl mb-8 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <View className="flex-row justify-around items-center">
                                <View className="items-center">
                                    <Text className={`font-nunito-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>{mins}:{String(secs).padStart(2, '0')}</Text>
                                    <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Time</Text>
                                </View>
                                <View className="items-center">
                                    <Text className={`font-nunito-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>{matchMoves}</Text>
                                    <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Moves</Text>
                                </View>
                                <View className="items-center">
                                    <Text className="font-nunito-black text-2xl text-orange-500">{accuracy}%</Text>
                                    <Text className={`font-nunito-bold text-[10px] uppercase tracking-wider mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Accuracy</Text>
                                </View>
                            </View>
                        </View>

                        <View className="flex-row w-full" style={{ gap: 12 }}>
                            <TouchableOpacity onPress={() => setView('detail')} className={`flex-1 py-4 rounded-2xl items-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Text className={`font-nunito-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Back to Deck</Text>
                            </TouchableOpacity>
                            {activeNode && (
                                <TouchableOpacity onPress={() => startMatch(activeNode)} className="flex-1 py-4 rounded-2xl items-center bg-orange-500 shadow-lg shadow-orange-500/30">
                                    <Text className="font-nunito-bold text-white">Play Again</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            );
        }

        const cols = 4;
        const cardSize = (SCREEN_WIDTH - 40 - (cols - 1) * 8) / cols;

        return (
            <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                {/* Header */}
                <View className="flex-row justify-between items-center px-6 py-4">
                    <TouchableOpacity onPress={() => setView('detail')} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                        <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                    <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Matching Game</Text>
                    <View className="flex-row items-center" style={{ gap: 12 }}>
                        <Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{matchMoves} moves</Text>
                    </View>
                </View>

                {/* Progress */}
                <View className={`mx-6 h-2 rounded-full mb-6 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <View style={{ width: `${(matchMatched.size / (matchCards.length / 2)) * 100}%`, backgroundColor: '#f97316', height: '100%', borderRadius: 999 }} />
                </View>

                {/* Card grid */}
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {matchCards.map(card => {
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
                                        backgroundColor: isMatched ? (isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)') : showFace ? (isDark ? '#1e293b' : '#ffffff') : (isDark ? '#334155' : '#e2e8f0'),
                                        borderColor: isMatched ? '#10b981' : showFace ? '#f97316' : (isDark ? '#475569' : '#cbd5e1'),
                                        opacity: isMatched ? 0.6 : 1,
                                    }}
                                >
                                    {showFace ? (
                                        <Text numberOfLines={4} style={{ fontFamily: 'Nunito_700Bold', fontSize: cardSize > 80 ? 11 : 9, textAlign: 'center', color: isMatched ? '#10b981' : (isDark ? '#e2e8f0' : '#334155') }}>
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
    // Render: Deck Management (card list)
    // ─────────────────────────────────────────────────────────────────────────

    const renderManage = () => {
        if (!activeNode) return null;
        const stats = getNodeStats(activeNode);
        const deck = activeNode.deck ? (decks.find(d => d.id === activeNode.deck!.id) || activeNode.deck) : null;
        const color = deck ? deck.color : '#6366f1';

        return (
            <SafeAreaView className={`flex-1 ${isDark ? 'bg-[#1a1a1b]' : 'bg-slate-50'}`}>
                <View className={`flex-row items-center px-6 py-4 border-b ${isDark ? 'bg-[#1a1a1b] border-slate-800/50' : 'bg-white border-slate-200'}`}>
                    <TouchableOpacity onPress={() => setView('detail')} className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <Ionicons name="arrow-back" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className={`font-nunito-black text-sm leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={2}>{activeNode.fullPath}</Text>
                    </View>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        {deck && (
                            <>
                                <TouchableOpacity onPress={() => { setActiveDeck(deck); setShowImportModal(true); }} className={`flex-row items-center px-3 h-10 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="cloud-upload-outline" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                                    <Text className={`font-nunito-bold ml-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Import</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={openAddCard} style={{ backgroundColor: color }} className="w-10 h-10 rounded-full items-center justify-center">
                                    <Ionicons name="add" size={24} color="white" />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    <View className="items-center pt-12 pb-10">
                        <View className="w-48 mb-8" style={{ gap: 8 }}>
                            <View className="flex-row justify-between"><Text className={`font-nunito-bold text-base ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>New:</Text><Text className={`font-nunito-bold text-base ${stats.new > 0 ? (isDark ? 'text-violet-400' : 'text-violet-600') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>{stats.new}</Text></View>
                            <View className="flex-row justify-between"><Text className={`font-nunito-bold text-base ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Learning:</Text><Text className={`font-nunito-bold text-base ${stats.learning > 0 ? (isDark ? 'text-orange-400' : 'text-orange-600') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>{stats.learning}</Text></View>
                            <View className="flex-row justify-between"><Text className={`font-nunito-bold text-base ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>To Review:</Text><Text className={`font-nunito-bold text-base ${stats.due > 0 ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>{stats.due}</Text></View>
                        </View>
                        <TouchableOpacity onPress={() => startStudy(activeNode)} style={{ backgroundColor: color }} className="px-10 py-3.5 rounded-full flex-row items-center justify-center">
                            <Text className="font-nunito-bold text-white text-base">Study Now</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="px-6 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className={`font-nunito-bold text-sm tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{isSelectionMode ? `${selectedCardIds.size} SELECTED` : (deck ? 'CARDS IN DECK' : 'ALL CARDS IN FOLDER')}</Text>
                            <View className="flex-row items-center" style={{ gap: 16 }}>
                                {isSelectionMode ? (
                                    <>
                                        {selectedCardIds.size > 0 && (
                                            <>
                                                <TouchableOpacity onPress={() => handleBulkReverse(true)}><Text className={`font-nunito-bold text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Reverse</Text></TouchableOpacity>
                                                <TouchableOpacity onPress={handleBulkDelete}><Text className="font-nunito-bold text-red-500 text-sm">Delete</Text></TouchableOpacity>
                                            </>
                                        )}
                                        <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedCardIds(new Set()); }}><Text className={`font-nunito-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cancel</Text></TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <TouchableOpacity onPress={() => handleBulkReverse(false)} className="flex-row items-center"><Ionicons name="swap-vertical" size={16} color={isDark ? '#94a3b8' : '#64748b'} /><Text className={`font-nunito-bold text-xs ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Reverse</Text></TouchableOpacity>
                                        <TouchableOpacity onPress={() => setIsSelectionMode(true)} className="flex-row items-center"><Ionicons name="checkmark-circle-outline" size={16} color={isDark ? '#94a3b8' : '#64748b'} /><Text className={`font-nunito-bold text-xs ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Select</Text></TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>

                        {(() => {
                            const decksToRender = collectDecksFromNode(activeNode).filter(d => d.cards.length > 0);
                            if (decksToRender.length === 0) {
                                return (
                                    <View className="py-10 items-center">
                                        <Image source={require('../../assets/images/confused.png')} style={{ width: 80, height: 80, marginBottom: 12 }} resizeMode="contain" />
                                        <Text className={`font-nunito-bold text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No cards yet!</Text>
                                        <Text className={`font-nunito text-xs text-center mt-1 px-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tap + to add cards, or use the import button.</Text>
                                    </View>
                                );
                            }
                            return decksToRender.map((d) => (
                                <View key={d.id} className="mb-2">
                                    {!deck && <Text className={`font-nunito-bold text-xs mb-2 ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{d.name.toUpperCase()}</Text>}
                                    {d.cards.map((card) => {
                                        const cardDue = card.nextDue <= Date.now();
                                        const nextDueText = cardDue ? 'Due now' : new Date(card.nextDue).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                        const isSelected = selectedCardIds.has(card.id);
                                        return (
                                            <TouchableOpacity key={card.id} activeOpacity={isSelectionMode ? 0.7 : 1} onPress={() => { if (isSelectionMode) { const newSet = new Set(selectedCardIds); if (newSet.has(card.id)) newSet.delete(card.id); else newSet.add(card.id); setSelectedCardIds(newSet); } }}
                                                className={`mb-3 p-4 rounded-3xl border flex-row items-center ${isSelected ? (isDark ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}>
                                                {isSelectionMode && <View className="mr-3"><Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={22} color={isSelected ? '#6366f1' : (isDark ? '#475569' : '#cbd5e1')} /></View>}
                                                <View className="flex-1">
                                                    <View className="flex-row justify-between items-start">
                                                        <View className="flex-1 mr-3">
                                                            <Text className={`font-nunito-bold text-sm leading-tight mb-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={2}>{card.front}</Text>
                                                            <Text className={`font-nunito text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={2}>{card.back}</Text>
                                                        </View>
                                                        {!isSelectionMode && (
                                                            <View className="items-end" style={{ gap: 8 }}>
                                                                <View className={`px-2.5 py-0.5 rounded-full ${cardDue ? 'bg-amber-500/20' : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`}>
                                                                    <Text className={`font-nunito-bold text-[10px] ${cardDue ? 'text-amber-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{nextDueText}</Text>
                                                                </View>
                                                                <View className="flex-row items-center" style={{ gap: 12 }}>
                                                                    <TouchableOpacity onPress={() => { setActiveDeck(d); setEditingCard(card); setCardForm({ front: card.front, back: card.back }); setShowAddCardModal(true); }}><Ionicons name="pencil" size={15} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                                                                    <TouchableOpacity onPress={() => { setActiveDeck(d); handleDeleteCard(card); }}><Ionicons name="trash-outline" size={15} color="#ef4444" /></TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        )}
                                                    </View>
                                                    {card.reviewCount > 0 && (
                                                        <View className={`mt-2.5 pt-2.5 border-t flex-row items-center ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                                            <Ionicons name="repeat-outline" size={11} color={isDark ? '#475569' : '#94a3b8'} />
                                                            <Text className={`font-nunito text-[10px] ml-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Reviewed {card.reviewCount} time{card.reviewCount !== 1 ? 's' : ''}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ));
                        })()}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    };


    // ─────────────────────────────────────────────────────────────────────────
    // Modals
    // ─────────────────────────────────────────────────────────────────────────

    const renderCreateSheet = () => (
        <Modal visible={showCreateSheet} transparent animationType="slide" onRequestClose={() => setShowCreateSheet(false)}>
            <View className="flex-1 justify-end bg-black/60">
                <Pressable className="flex-1" onPress={() => setShowCreateSheet(false)} />
                <View className={`rounded-t-[32px] pt-4 pb-12 px-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="items-center mb-5">
                        <View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
                    </View>
                    <Text className={`font-nunito-black text-xl mb-6 ${isDark ? 'text-white' : 'text-slate-800'}`}>Create</Text>
                    <TouchableOpacity onPress={() => openAddDeck()} className={`flex-row items-center p-4 rounded-2xl mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                            <Ionicons name="albums-outline" size={20} color="#6366f1" />
                        </View>
                        <View className="flex-1">
                            <Text className={`font-nunito-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>New Deck</Text>
                            <Text className={`font-nunito text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Create a flashcard deck</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={isDark ? '#475569' : '#cbd5e1'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { openAddDeck('::'); }} className={`flex-row items-center p-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                            <Ionicons name="folder-outline" size={20} color="#f97316" />
                        </View>
                        <View className="flex-1">
                            <Text className={`font-nunito-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>New Folder</Text>
                            <Text className={`font-nunito text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Organize decks into a folder (use :: separator)</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={isDark ? '#475569' : '#cbd5e1'} />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const renderAddDeckModal = () => (
        <Modal visible={showAddDeckModal} transparent animationType="slide" onRequestClose={() => setShowAddDeckModal(false)}>
            <View className="flex-1 justify-end bg-black/60">
                <Pressable className="flex-1" onPress={() => setShowAddDeckModal(false)} />
                <View className={`rounded-t-[32px] pt-4 pb-12 px-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="items-center mb-5"><View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} /></View>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>{editingDeck ? 'Edit Deck' : 'New Deck'}</Text>
                        <TouchableOpacity onPress={() => setShowAddDeckModal(false)} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                    </View>
                    <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deck Name *</Text>
                    <TextInput className={`p-4 rounded-2xl mb-4 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`} placeholder="e.g. Biology Chapter 3" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} value={deckForm.name} onChangeText={t => setDeckForm({ ...deckForm, name: t })} />
                    <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Subject Tag (Optional)</Text>
                    {currentSubjects.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                            <View className="flex-row" style={{ gap: 8 }}>
                                {currentSubjects.map((s: any) => (
                                    <TouchableOpacity key={s.id} onPress={() => setDeckForm({ ...deckForm, subject: s.name })} className={`px-3 py-1.5 rounded-full border ${deckForm.subject === s.name ? (isDark ? 'bg-indigo-500/20 border-indigo-500' : 'bg-indigo-100 border-indigo-500') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}>
                                        <Text className={`font-nunito-bold text-xs ${deckForm.subject === s.name ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{s.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                    <TextInput className={`p-4 rounded-2xl mb-5 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`} placeholder="e.g. BIOL101 (or select above)" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} value={deckForm.subject} onChangeText={t => setDeckForm({ ...deckForm, subject: t })} />
                    <Text className={`font-nunito-bold text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accent Color</Text>
                    <View className="flex-row flex-wrap mb-6" style={{ gap: 12 }}>
                        {DECK_COLORS.map(c => (
                            <TouchableOpacity key={c} onPress={() => setDeckForm({ ...deckForm, color: c })} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: deckForm.color === c ? 3 : 0, borderColor: 'white', shadowColor: c, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 5, elevation: 5 }} />
                        ))}
                    </View>
                    <TouchableOpacity onPress={handleSaveDeck} className="py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30">
                        <Text className="font-nunito-bold text-white text-base">{editingDeck ? 'Save Changes' : 'Create Deck'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const renderAddCardModal = () => (
        <Modal visible={showAddCardModal} transparent animationType="slide" onRequestClose={() => setShowAddCardModal(false)}>
            <View className="flex-1 justify-end bg-black/60">
                <Pressable className="flex-1" onPress={() => setShowAddCardModal(false)} />
                <View className={`rounded-t-[32px] pt-4 pb-12 px-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="items-center mb-5"><View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} /></View>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>{editingCard ? 'Edit Card' : 'New Card'}</Text>
                        <View className="flex-row items-center" style={{ gap: 12 }}>
                            <TouchableOpacity onPress={() => setCardForm({ front: cardForm.back, back: cardForm.front })} className={`flex-row items-center px-3 h-8 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="swap-vertical" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                                <Text className={`font-nunito-bold text-xs ml-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Reverse</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowAddCardModal(false)} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                        </View>
                    </View>
                    <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Front (Question)</Text>
                    <TextInput className={`p-4 rounded-2xl mb-4 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`} placeholder="What is the capital of France?" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} value={cardForm.front} onChangeText={t => setCardForm({ ...cardForm, front: t })} multiline textAlignVertical="top" style={{ minHeight: 88 }} />
                    <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Back (Answer)</Text>
                    <TextInput className={`p-4 rounded-2xl mb-6 font-nunito border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'}`} placeholder="Paris" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} value={cardForm.back} onChangeText={t => setCardForm({ ...cardForm, back: t })} multiline textAlignVertical="top" style={{ minHeight: 88 }} />
                    <TouchableOpacity onPress={handleSaveCard} className="py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30">
                        <Text className="font-nunito-bold text-white text-base">{editingCard ? 'Save Card' : 'Add Card'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const renderImportModal = () => (
        <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={closeImportModal}>
            <View className="flex-1 justify-end bg-black/60">
                <Pressable className="flex-1" onPress={closeImportModal} />
                <View className={`rounded-t-[32px] pt-4 pb-12 px-6 max-h-[88%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="items-center mb-5"><View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} /></View>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>Import Cards</Text>
                        <TouchableOpacity onPress={closeImportModal} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                    </View>
                    <View className="mb-4">
                        <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>1. Select Separator</Text>
                        <View className="flex-row" style={{ gap: 8 }}>
                            {(['comma', 'pipe', 'tab'] as const).map(sep => (
                                <TouchableOpacity key={sep} onPress={() => { setImportSeparator(sep); setParsedImport([]); }} className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${importSeparator === sep ? 'bg-indigo-500/10 border-indigo-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}>
                                    <Text className={`font-nunito-bold text-sm ${importSeparator === sep ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{sep.charAt(0).toUpperCase() + sep.slice(1)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <View className="mb-4">
                        <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>2. Paste Text</Text>
                        <TextInput value={importText} onChangeText={t => { setImportText(t); setParsedImport([]); }} multiline numberOfLines={4} placeholder={"Front, Back\nQ2, A2..."} placeholderTextColor={isDark ? '#64748b' : '#94a3b8'} style={{ minHeight: 100, textAlignVertical: 'top' }} className={`w-full p-4 rounded-2xl font-nunito text-sm ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`} />
                        {importText.trim().length > 0 && parsedImport.length === 0 && (
                            <TouchableOpacity onPress={handleParseText} className={`mt-3 py-3 rounded-xl items-center ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                <Text className={`font-nunito-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>Parse Text</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text className={`font-nunito-bold text-sm mb-2 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>OR</Text>
                    <TouchableOpacity onPress={handlePickFile} disabled={importLoading} className={`flex-row items-center justify-center p-4 rounded-2xl border-2 border-dashed mb-5 ${isDark ? 'border-slate-600' : 'border-slate-300'}`}>
                        {importLoading ? <ActivityIndicator color="#3b82f6" /> : (
                            <>
                                <Ionicons name="cloud-upload-outline" size={22} color={isDark ? '#60a5fa' : '#3b82f6'} />
                                <Text className={`font-nunito-bold ml-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{importFileName || 'Upload .txt or .csv'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    {parsedImport.length > 0 && (
                        <>
                            <Text className={`font-nunito-bold text-sm mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{parsedImport.length} card{parsedImport.length !== 1 ? 's' : ''} found — Preview</Text>
                            <ScrollView className="max-h-44 mb-5" showsVerticalScrollIndicator={false}>
                                {parsedImport.slice(0, 10).map((card, idx) => (
                                    <View key={idx} className={`p-3 rounded-xl mb-2 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                        <Text className={`font-nunito-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{card.front}</Text>
                                        <Text className={`font-nunito text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>{card.back}</Text>
                                    </View>
                                ))}
                                {parsedImport.length > 10 && <Text className={`font-nunito text-xs text-center py-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>...and {parsedImport.length - 10} more</Text>}
                            </ScrollView>
                            <TouchableOpacity onPress={handleConfirmImport} className="py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30">
                                <Text className="font-nunito-bold text-white text-base">Import {parsedImport.length} Card{parsedImport.length !== 1 ? 's' : ''}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );

    const renderSettingsModal = () => (
        <Modal visible={showSettingsModal} transparent animationType="slide" onRequestClose={() => setShowSettingsModal(false)}>
            <View className="flex-1 justify-end bg-black/60">
                <Pressable className="flex-1" onPress={() => setShowSettingsModal(false)} />
                <View className={`rounded-t-[32px] pt-4 pb-12 px-6 max-h-[90%] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <View className="items-center mb-5"><View className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} /></View>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className={`font-nunito-black text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>Study Options</Text>
                        <TouchableOpacity onPress={() => setShowSettingsModal(false)} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                    </View>
                    <Text className={`font-nunito text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>FinScholar uses SM-2 Spaced Repetition. Customize your learning steps and intervals.</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="mb-4">
                            <Text className={`font-nunito-bold text-sm mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Learning Steps (Minutes)</Text>
                            <Text className={`font-nunito text-xs mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Space-separated (e.g., "1 10")</Text>
                            <TextInput value={settingsForm.learningSteps} onChangeText={(t) => setSettingsForm(prev => ({ ...prev, learningSteps: t }))} className={`w-full p-4 rounded-2xl font-nunito-bold text-base ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`} />
                        </View>
                        <View className="mb-4">
                            <Text className={`font-nunito-bold text-sm mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Graduating Interval (Days)</Text>
                            <TextInput value={settingsForm.graduatingInterval} onChangeText={(t) => setSettingsForm(prev => ({ ...prev, graduatingInterval: t }))} keyboardType="numeric" className={`w-full p-4 rounded-2xl font-nunito-bold text-base ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`} />
                        </View>
                        <View className="mb-6">
                            <Text className={`font-nunito-bold text-sm mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Easy Interval (Days)</Text>
                            <TextInput value={settingsForm.easyInterval} onChangeText={(t) => setSettingsForm(prev => ({ ...prev, easyInterval: t }))} keyboardType="numeric" className={`w-full p-4 rounded-2xl font-nunito-bold text-base ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`} />
                        </View>
                        <TouchableOpacity onPress={async () => {
                            await saveSrSettings({ learningSteps: settingsForm.learningSteps || '1 10', graduatingInterval: parseInt(settingsForm.graduatingInterval) || 1, easyInterval: parseInt(settingsForm.easyInterval) || 4, studyTimeHour: parseInt(settingsForm.studyTimeHour) || 8, studyTimeMinute: parseInt(settingsForm.studyTimeMinute) || 0 });
                            setShowSettingsModal(false);
                        }} className="w-full py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30">
                            <Text className="font-nunito-bold text-white text-base">Save Settings</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Exam Prep Modal
    // ─────────────────────────────────────────────────────────────────────────

    const renderExamModal = () => (
        <Modal visible={showExamModal} transparent animationType="slide" onRequestClose={() => setShowExamModal(false)}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View className={`rounded-t-3xl p-6 pb-10 ${isDark ? 'bg-[#121212]' : 'bg-white'}`} style={{ maxHeight: '85%' }}>
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(236,72,153,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="calendar-outline" size={18} color="#ec4899" />
                            </View>
                            <Text className={`font-nunito-black text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>Exam Prep</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowExamModal(false)} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                    </View>
                    <Text className={`font-nunito text-xs mb-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Based on Cepeda et al. (2008) optimal spacing — reviews are distributed using expanding intervals sized to your available study window.</Text>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Exam date picker */}
                        <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>When is your exam?</Text>
                        <TouchableOpacity onPress={() => setExamShowDatePicker(true)} className={`flex-row items-center justify-between p-4 rounded-2xl border mb-1 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <View className="flex-row items-center" style={{ gap: 8 }}>
                                <Ionicons name="calendar" size={18} color="#ec4899" />
                                <Text className={`font-nunito-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{examDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                        </TouchableOpacity>
                        {examShowDatePicker && (
                            <DateTimePicker value={examDate} mode="date" display="default" minimumDate={new Date()} onChange={(e, d) => { setExamShowDatePicker(false); if (d) { setExamDate(d); setExamPlan(null); } }} />
                        )}

                        {/* Days remaining indicator */}
                        {(() => {
                            const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
                            const urgency = daysLeft <= 1 ? '#ef4444' : daysLeft <= 3 ? '#f97316' : daysLeft <= 7 ? '#eab308' : '#10b981';
                            return (
                                <View className={`flex-row items-center mt-3 mb-4 px-3 py-2.5 rounded-xl`} style={{ backgroundColor: urgency + '15' }}>
                                    <Ionicons name={daysLeft <= 3 ? 'alert-circle-outline' : 'information-circle-outline'} size={16} color={urgency} />
                                    <Text className={`font-nunito-bold text-xs ml-2`} style={{ color: urgency }}>{daysLeft === 0 ? 'Exam is today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}</Text>
                                    <Text className={`font-nunito text-xs ml-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{daysLeft <= 1 ? 'Cram mode' : daysLeft <= 7 ? 'Intensive' : 'Standard pace'}</Text>
                                </View>
                            );
                        })()}

                        {/* Review count override */}
                        <Text className={`font-nunito-bold text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Review Sessions</Text>
                        <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
                            <TouchableOpacity onPress={() => { setExamReviewsPerDay(0); setExamPlan(null); }} className={`flex-1 py-2.5 rounded-xl items-center border ${examReviewsPerDay === 0 ? 'border-pink-500 bg-pink-500/10' : isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
                                <Text className={`font-nunito-bold text-xs ${examReviewsPerDay === 0 ? 'text-pink-500' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>Auto</Text>
                            </TouchableOpacity>
                            {[3, 4, 5, 6].map(n => (
                                <TouchableOpacity key={n} onPress={() => { setExamReviewsPerDay(n); setExamPlan(null); }} className={`flex-1 py-2.5 rounded-xl items-center border ${examReviewsPerDay === n ? 'border-pink-500 bg-pink-500/10' : isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
                                    <Text className={`font-nunito-bold text-xs ${examReviewsPerDay === n ? 'text-pink-500' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>{n}x</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Generate / Show plan */}
                        {!examPlan ? (
                            <TouchableOpacity onPress={() => {
                                const daysLeft = Math.max(0.5, (examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                                const totalCards = activeNode ? collectCards(activeNode).length : 0;
                                const { plan } = computeExamPlan(daysLeft, totalCards);
                                setExamPlan(plan);
                            }} className="w-full py-3.5 rounded-2xl items-center bg-pink-500 shadow-lg shadow-pink-500/30 mb-4">
                                <Text className="font-nunito-bold text-white text-sm">Generate Study Plan</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className={`p-4 rounded-2xl border mb-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <Text className={`font-nunito-black text-xs mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Your Review Schedule ({examPlan.length} sessions)</Text>
                                {examPlan.map((slot, i) => (
                                    <View key={i} className="flex-row items-center mb-2">
                                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i === 0 ? '#ec4899' : isDark ? '#334155' : '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: i === 0 ? '#fff' : isDark ? '#94a3b8' : '#64748b' }}>{i + 1}</Text>
                                        </View>
                                        <Text className={`font-nunito-bold text-xs flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{slot.label}</Text>
                                        <Text className={`font-nunito text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{slot.cardsPerSession} cards</Text>
                                    </View>
                                ))}
                                <Text className={`font-nunito text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Intervals expand over time for optimal retention (spacing effect).</Text>
                            </View>
                        )}

                        {/* Apply button */}
                        {examPlan && (
                            <TouchableOpacity onPress={applyExamSchedule} className="w-full py-4 rounded-2xl items-center bg-pink-500 shadow-lg shadow-pink-500/30">
                                <Text className="font-nunito-bold text-white text-base">Apply Exam Schedule</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Move Deck Modal
    // ─────────────────────────────────────────────────────────────────────────

    const renderMoveModal = () => (
        <Modal visible={showMoveModal} transparent animationType="slide" onRequestClose={() => setShowMoveModal(false)}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View className={`rounded-t-3xl p-6 pb-10 ${isDark ? 'bg-[#121212]' : 'bg-white'}`}>
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="move-outline" size={18} color="#6366f1" />
                            </View>
                            <Text className={`font-nunito-black text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>Move Deck</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowMoveModal(false)} className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                    </View>
                    <Text className={`font-nunito text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Enter the destination path. Use "::" to nest under a folder. Leave empty to move to root level.</Text>

                    {/* Current location */}
                    {movingNode && (
                        <View className={`flex-row items-center mb-3 px-3 py-2.5 rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                            <Ionicons name="location-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                            <Text className={`font-nunito text-xs ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Current: <Text className="font-nunito-bold">{movingNode.fullPath}</Text></Text>
                        </View>
                    )}

                    <Text className={`font-nunito-bold text-sm mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Destination Path</Text>
                    <TextInput
                        value={moveTargetPath}
                        onChangeText={setMoveTargetPath}
                        placeholder="e.g. DDS032::  (or empty for root)"
                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                        className={`w-full p-4 rounded-2xl font-nunito-bold text-sm mb-4 ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`}
                    />

                    {/* Quick path suggestions from existing decks */}
                    <Text className={`font-nunito-bold text-xs mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Existing folders:</Text>
                    <View className="flex-row flex-wrap mb-4" style={{ gap: 6 }}>
                        {(() => {
                            const paths = new Set<string>();
                            decks.forEach(d => {
                                const parts = d.subject.split('::');
                                for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('::') + '::');
                            });
                            return Array.from(paths).slice(0, 8).map(p => (
                                <TouchableOpacity key={p} onPress={() => setMoveTargetPath(p)} className={`px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Text className={`font-nunito text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p}</Text>
                                </TouchableOpacity>
                            ));
                        })()}
                    </View>

                    <TouchableOpacity onPress={confirmMoveDeck} className="w-full py-4 rounded-2xl items-center bg-indigo-500 shadow-lg shadow-indigo-500/30">
                        <Text className="font-nunito-bold text-white text-base">Move Here</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Root render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            {view === 'decks' && renderDecks()}
            {view === 'detail' && renderDetail()}
            {view === 'study' && renderStudy()}
            {view === 'manage' && renderManage()}
            {view === 'quiz' && renderQuiz()}
            {view === 'match' && renderMatch()}

            {renderCreateSheet()}
            {renderAddDeckModal()}
            {renderAddCardModal()}
            {renderImportModal()}
            {renderSettingsModal()}
            {renderExamModal()}
            {renderMoveModal()}
        </>
    );
}
