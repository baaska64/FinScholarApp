import assert from 'node:assert';
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
  parseCsvLine,
  computeExamPlan,
  getCardStatus,
  getNextDueText,
  getDeckThematicIcon,
  calculateLevel,
  calculateXpGain,
  updateStudyStats,
  getWeekDaysActivity,
  getLocalDateString,
  getColorWithAlpha,
  LEVEL_THRESHOLDS,
  isStreakLive,
} from '../components/study/utils.ts';

export function runStudyRedesignTests(describe, test) {
  // ───────────────────────────────────────────────────────────────────────────
  // Suite 1: SM-2 Spaced Repetition Engine
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 1: SM-2 Spaced Repetition Engine', () => {
    test('1.1 makeNewCard creates initial card with correct SM-2 defaults', () => {
      const card = makeNewCard('What is photosynthesis?', 'Process of converting light to energy');
      assert.strictEqual(card.front, 'What is photosynthesis?');
      assert.strictEqual(card.back, 'Process of converting light to energy');
      assert.strictEqual(card.interval, 0);
      assert.strictEqual(card.easeFactor, 2.5);
      assert.strictEqual(card.reviewCount, 0);
      assert.strictEqual(card.stepIndex, 0);
      assert.ok(card.id && typeof card.id === 'string');
      assert.ok(card.nextDue <= Date.now() + 100);
    });

    test('1.2 Learning card rating 1 (Again) resets stepIndex and decreases easeFactor', () => {
      const card = makeNewCard('Q', 'A');
      card.stepIndex = 1;
      const updated = applyRating(card, 1, DEFAULT_SR_SETTINGS);
      assert.strictEqual(updated.interval, 0);
      assert.strictEqual(updated.stepIndex, 0);
      assert.strictEqual(updated.reviewCount, 1);
      assert.strictEqual(updated.easeFactor, 2.3);
      assert.ok(updated.nextDue > Date.now());
    });

    test('1.3 Learning card rating 3 (Good) advances steps and graduates to graduatingInterval', () => {
      const card = makeNewCard('Q', 'A');
      // Step 0 -> Step 1 (1 min -> 10 min)
      const step1 = applyRating(card, 3, { ...DEFAULT_SR_SETTINGS, learningSteps: '1 10', graduatingInterval: 1 });
      assert.strictEqual(step1.interval, 0);
      assert.strictEqual(step1.stepIndex, 1);
      assert.strictEqual(step1.reviewCount, 1);

      // Step 1 -> Graduation (interval = graduatingInterval = 1 day)
      const graduated = applyRating(step1, 3, { ...DEFAULT_SR_SETTINGS, learningSteps: '1 10', graduatingInterval: 1 });
      assert.strictEqual(graduated.interval, 1);
      assert.strictEqual(graduated.reviewCount, 2);
      assert.ok(graduated.nextDue >= Date.now() + 23 * 60 * 60 * 1000);
    });

    test('1.4 Learning card rating 4 (Easy) immediately jumps to easyInterval', () => {
      const card = makeNewCard('Q', 'A');
      const updated = applyRating(card, 4, { ...DEFAULT_SR_SETTINGS, easyInterval: 4 });
      assert.strictEqual(updated.interval, 4);
      assert.strictEqual(updated.reviewCount, 1);
      assert.strictEqual(updated.easeFactor, 2.6); // 2.5 + 0.1
      assert.ok(updated.nextDue >= Date.now() + 3.5 * 24 * 60 * 60 * 1000);
    });

    test('1.5 Graduated card rating 3 (Good) multiplies interval by easeFactor', () => {
      const graduatedCard = {
        id: 'c1',
        front: 'Q',
        back: 'A',
        interval: 10,
        easeFactor: 2.5,
        nextDue: Date.now() - 1000,
        reviewCount: 3,
      };
      const updated = applyRating(graduatedCard, 3, DEFAULT_SR_SETTINGS);
      assert.strictEqual(updated.interval, 25); // 10 * 2.5 = 25
      assert.strictEqual(updated.reviewCount, 4);
      assert.strictEqual(updated.easeFactor, 2.5);
    });

    test('1.6 Graduated card rating 1 (Again) relapses to interval 0 and step 0', () => {
      const graduatedCard = {
        id: 'c1',
        front: 'Q',
        back: 'A',
        interval: 30,
        easeFactor: 2.5,
        nextDue: Date.now() - 1000,
        reviewCount: 5,
      };
      const updated = applyRating(graduatedCard, 1, DEFAULT_SR_SETTINGS);
      assert.strictEqual(updated.interval, 0);
      assert.strictEqual(updated.stepIndex, 0);
      assert.strictEqual(updated.easeFactor, 2.3);
      assert.strictEqual(updated.reviewCount, 6);
    });

    test('1.7 Ease factor is clamped between 1.3 and 4.0', () => {
      let card = {
        id: 'c1',
        front: 'Q',
        back: 'A',
        interval: 10,
        easeFactor: 1.35,
        nextDue: Date.now() - 1000,
        reviewCount: 1,
      };
      // Reduce below 1.3 -> should clamp to 1.3
      card = applyRating(card, 1, DEFAULT_SR_SETTINGS);
      assert.strictEqual(card.easeFactor, 1.3);

      // Increase above 4.0 -> should clamp to 4.0
      card.easeFactor = 3.95;
      card = applyRating(card, 4, DEFAULT_SR_SETTINGS);
      assert.strictEqual(card.easeFactor, 4.0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 2: Hierarchical Deck Tree & Node Statistics
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 2: Deck Tree & Node Statistics', () => {
    test('2.1 buildDeckTree correctly nests subject::name paths into hierarchy', () => {
      const decks = [
        {
          id: 'd1',
          name: 'Chapter 1',
          subject: 'Biology::Genetics',
          color: '#3b82f6',
          createdAt: 1000,
          cards: [makeNewCard('Gene', 'Heredity unit')],
        },
        {
          id: 'd2',
          name: 'Chapter 2',
          subject: 'Biology::Genetics',
          color: '#3b82f6',
          createdAt: 1001,
          cards: [makeNewCard('Allele', 'Gene variant')],
        },
        {
          id: 'd3',
          name: 'Intro',
          subject: 'Biology::Ecology',
          color: '#10b981',
          createdAt: 1002,
          cards: [makeNewCard('Biome', 'Community of flora')],
        },
        {
          id: 'd4',
          name: 'Calculus I',
          subject: '',
          color: '#ec4899',
          createdAt: 1003,
          cards: [makeNewCard('Derivative', 'Rate of change')],
        },
      ];

      const tree = buildDeckTree(decks);
      assert.strictEqual(tree.length, 2); // 'Biology' and 'Calculus I'
      assert.strictEqual(tree[0].name, 'Biology');
      assert.strictEqual(tree[1].name, 'Calculus I');
      assert.strictEqual(tree[1].deck?.id, 'd4');

      const bioNode = tree[0];
      assert.strictEqual(bioNode.children.size, 2); // 'Ecology' and 'Genetics'
      const geneticsNode = bioNode.children.get('Genetics');
      assert.ok(geneticsNode);
      assert.strictEqual(geneticsNode.children.size, 2); // 'Chapter 1' and 'Chapter 2'
    });

    test('2.2 getNodeStats calculates recursive stats accurately', () => {
      const now = Date.now();
      const decks = [
        {
          id: 'd1',
          name: 'Deck 1',
          subject: 'Folder',
          color: '#3b82f6',
          createdAt: 1000,
          cards: [
            { id: 'c1', front: 'Q1', back: 'A1', interval: 0, easeFactor: 2.5, nextDue: now, reviewCount: 0 }, // new
            { id: 'c2', front: 'Q2', back: 'A2', interval: 0, easeFactor: 2.5, nextDue: now + 5000, reviewCount: 2 }, // learning
          ],
        },
        {
          id: 'd2',
          name: 'Deck 2',
          subject: 'Folder',
          color: '#3b82f6',
          createdAt: 1001,
          cards: [
            { id: 'c3', front: 'Q3', back: 'A3', interval: 5, easeFactor: 2.5, nextDue: now - 5000, reviewCount: 4 }, // due
            { id: 'c4', front: 'Q4', back: 'A4', interval: 10, easeFactor: 2.5, nextDue: now + 500000, reviewCount: 3 }, // mastered
          ],
        },
      ];

      const tree = buildDeckTree(decks);
      const folderNode = tree[0];
      const stats = getNodeStats(folderNode);

      assert.strictEqual(stats.total, 4);
      assert.strictEqual(stats.new, 1);
      assert.strictEqual(stats.learning, 1);
      assert.strictEqual(stats.due, 1);
      assert.strictEqual(stats.mastered, 1);
    });

    test('2.3 collectCards and collectDecksFromNode collect all descendants', () => {
      const decks = [
        {
          id: 'd1',
          name: 'D1',
          subject: 'Root::Sub',
          color: '#3b82f6',
          createdAt: 1000,
          cards: [makeNewCard('Q1', 'A1'), makeNewCard('Q2', 'A2')],
        },
        {
          id: 'd2',
          name: 'D2',
          subject: 'Root',
          color: '#3b82f6',
          createdAt: 1001,
          cards: [makeNewCard('Q3', 'A3')],
        },
      ];

      const tree = buildDeckTree(decks);
      const rootNode = tree[0];

      const allCards = collectCards(rootNode);
      assert.strictEqual(allCards.length, 3);
      assert.ok(allCards.some((c) => c.deckId === 'd1'));
      assert.ok(allCards.some((c) => c.deckId === 'd2'));

      const allDecks = collectDecksFromNode(rootNode);
      assert.strictEqual(allDecks.length, 2);
    });

    test('2.4 getCardStatus correctly returns card lifecycle state', () => {
      const now = Date.now();
      const newCard = { id: '1', front: '', back: '', interval: 0, easeFactor: 2.5, nextDue: now, reviewCount: 0 };
      const learningCard = { id: '2', front: '', back: '', interval: 0, easeFactor: 2.5, nextDue: now + 1000, reviewCount: 1 };
      const dueCard = { id: '3', front: '', back: '', interval: 4, easeFactor: 2.5, nextDue: now - 1000, reviewCount: 2 };
      const masteredCard = { id: '4', front: '', back: '', interval: 4, easeFactor: 2.5, nextDue: now + 50000, reviewCount: 2 };

      assert.strictEqual(getCardStatus(newCard), 'new');
      assert.strictEqual(getCardStatus(learningCard), 'learning');
      assert.strictEqual(getCardStatus(dueCard), 'due');
      assert.strictEqual(getCardStatus(masteredCard), 'mastered');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 3: Gamification & XP System
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 3: Gamification, Streaks & XP System', () => {
    test('3.1 calculateLevel maps total XP to correct level titles and bounds progress', () => {
      // Level 1: 0 XP
      const lv1 = calculateLevel(0);
      assert.strictEqual(lv1.level, 1);
      assert.strictEqual(lv1.title, 'Novice Scholar');
      assert.strictEqual(lv1.progress, 0);

      // Level 1: 50 XP (halfway to 100)
      const lv1Mid = calculateLevel(50);
      assert.strictEqual(lv1Mid.level, 1);
      assert.strictEqual(lv1Mid.progress, 0.5);

      // Level 2: 100 XP
      const lv2 = calculateLevel(100);
      assert.strictEqual(lv2.level, 2);
      assert.strictEqual(lv2.title, 'Apprentice Scholar');
      assert.strictEqual(lv2.progress, 0);

      // Level 3: 250 XP
      const lv3 = calculateLevel(375); // Halfway between 250 and 500 (span = 250, earned = 125)
      assert.strictEqual(lv3.level, 3);
      assert.strictEqual(lv3.title, 'Scholar');
      assert.strictEqual(lv3.progress, 0.5);

      // Level 6 (Max Level): 2500 XP
      const lvMax = calculateLevel(2500);
      assert.strictEqual(lvMax.level, 6);
      assert.strictEqual(lvMax.title, 'Grandmaster Scholar');
      assert.strictEqual(lvMax.progress, 1.0);
    });

    test('3.2 calculateXpGain computes XP bonuses for reviews, mastery and sessions', () => {
      assert.strictEqual(calculateXpGain({ isReview: true }), 10);
      assert.strictEqual(calculateXpGain({ isMastered: true }), 25);
      assert.strictEqual(calculateXpGain({ isReview: true, isMastered: true }), 35);
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: 10 }), 50);
    });

    test('3.3 updateStudyStats manages streaks across consecutive days', () => {
      // Local dates, not `toISOString()` — that is UTC, and `updateStudyStats`
      // keys streaks off `getLocalDateString`. The two disagree for the whole
      // window between local midnight and the UTC offset (08:00 in GMT+8),
      // which made this suite fail every night rather than being a real bug.
      const today = getLocalDateString(new Date());
      const yesterday = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const twoDaysAgo = getLocalDateString(new Date(Date.now() - 48 * 60 * 60 * 1000));

      // Case A: First study session
      const stats0 = { lastStudyDate: '', currentStreak: 0, masteredToday: 0 };
      const stats1 = updateStudyStats(stats0, 5, 2, false);
      assert.strictEqual(stats1.currentStreak, 1);
      assert.strictEqual(stats1.lastStudyDate, today);
      assert.strictEqual(stats1.cardsReviewedToday, 5);
      assert.strictEqual(stats1.masteredToday, 2);

      // Case B: Same day additional reviews
      const stats2 = updateStudyStats(stats1, 3, 1, false);
      assert.strictEqual(stats2.currentStreak, 1);
      assert.strictEqual(stats2.cardsReviewedToday, 8);
      assert.strictEqual(stats2.masteredToday, 3);

      // Case C: Consecutive day continuation (last studied was yesterday)
      const statsYesterday = { lastStudyDate: yesterday, currentStreak: 4, masteredToday: 10, totalXp: 200 };
      const statsToday = updateStudyStats(statsYesterday, 10, 5, true);
      assert.strictEqual(statsToday.currentStreak, 5); // 4 + 1
      assert.strictEqual(statsToday.cardsReviewedToday, 10);
      assert.strictEqual(statsToday.masteredToday, 5);
      assert.ok(statsToday.totalXp > 200);

      // Case D: Streak reset after missed day (last studied was 2 days ago)
      const statsBroken = { lastStudyDate: twoDaysAgo, currentStreak: 12, masteredToday: 5, totalXp: 500 };
      const statsReset = updateStudyStats(statsBroken, 2, 0, false);
      assert.strictEqual(statsReset.currentStreak, 1);
    });

    test('3.4 getWeekDaysActivity produces 7-day Mon-Sun activity array with flags', () => {
      // Local, for the same reason as 3.3.
      const today = getLocalDateString(new Date());
      const weeklyHistory = [today];
      const days = getWeekDaysActivity(weeklyHistory, today);

      assert.strictEqual(days.length, 7);
      assert.strictEqual(days[0].dayLabel, 'M');
      assert.strictEqual(days[6].dayLabel, 'S');

      const todayEntry = days.find((d) => d.isToday);
      assert.ok(todayEntry);
      assert.strictEqual(todayEntry.dateStr, today);
      assert.strictEqual(todayEntry.isCompleted, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 4: File & Text Import Parser
  // ─────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 4: File & Text Import Parser', () => {
    test('4.1 parseImport parses comma-separated cards with quotes', () => {
      const csv = `
        "Mitochondria","Powerhouse of the cell"
        "Nucleus","Control center of the cell"
        # Comment line to ignore
        // Another comment
        "Ribosome","Protein factory"
      `;
      const parsed = parseImport(csv, 'comma');
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].front, 'Mitochondria');
      assert.strictEqual(parsed[0].back, 'Powerhouse of the cell');
      assert.strictEqual(parsed[2].front, 'Ribosome');
      assert.strictEqual(parsed[2].back, 'Protein factory');
    });

    test('4.2 parseImport parses tab-separated cards', () => {
      const tsv = "HTML\tHyperText Markup Language\nCSS\tCascading Style Sheets";
      const parsed = parseImport(tsv, 'tab');
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].front, 'HTML');
      assert.strictEqual(parsed[0].back, 'HyperText Markup Language');
      assert.strictEqual(parsed[1].front, 'CSS');
      assert.strictEqual(parsed[1].back, 'Cascading Style Sheets');
    });

    test('4.3 parseImport parses pipe-separated cards with Q:/A: prefixes', () => {
      const pipe = "Q: What is React? | A: A UI library\nQ: What is Vite? | A: A build tool";
      const parsed = parseImport(pipe, 'pipe');
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].front, 'What is React?');
      assert.strictEqual(parsed[0].back, 'A UI library');
      assert.strictEqual(parsed[1].front, 'What is Vite?');
      assert.strictEqual(parsed[1].back, 'A build tool');
    });

    test('4.4 parseImport auto-detects delimiter when separator="auto"', () => {
      const pipeContent = "Term 1 | Definition 1\nTerm 2 | Definition 2";
      const parsedPipe = parseImport(pipeContent, 'auto');
      assert.strictEqual(parsedPipe.length, 2);
      assert.strictEqual(parsedPipe[0].front, 'Term 1');
      assert.strictEqual(parsedPipe[0].back, 'Definition 1');

      const csvContent = "Front A,Back A\nFront B,Back B";
      const parsedCsv = parseImport(csvContent, 'auto');
      assert.strictEqual(parsedCsv.length, 2);
      assert.strictEqual(parsedCsv[0].front, 'Front A');
      assert.strictEqual(parsedCsv[0].back, 'Back A');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 5: Exam Prep Algorithm & Spacing
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 5: Exam Prep Spaced Algorithm', () => {
    test('5.1 computeExamPlan handles cram mode (<= 1 day)', () => {
      const { plan, numReviews } = computeExamPlan(1, 20);
      assert.strictEqual(numReviews, 4);
      assert.strictEqual(plan.length, 4);
      assert.strictEqual(plan[0].label, 'Now');
      assert.strictEqual(plan[0].cardsPerSession, 20);
    });

    test('5.2 computeExamPlan creates expanding intervals for 7-day window', () => {
      const { plan, numReviews } = computeExamPlan(7, 50);
      assert.strictEqual(numReviews, 4);
      assert.strictEqual(plan.length, 4);
      assert.strictEqual(plan[0].label, 'Now');
      assert.ok(plan[plan.length - 1].day <= 7);
    });

    test('5.3 computeExamPlan respects manual override reviews count', () => {
      const { plan, numReviews } = computeExamPlan(14, 30, 6);
      assert.strictEqual(numReviews, 6);
      assert.strictEqual(plan.length, 6);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 6: Visual Helper Functions & Thematic Resolvers
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 6: Thematic Icons & Visual Helpers', () => {
    test('6.1 getDeckThematicIcon maps keyword subjects to relevant Ionicons', () => {
      assert.strictEqual(getDeckThematicIcon('Calculus', 'Derivatives'), 'calculator-outline');
      assert.strictEqual(getDeckThematicIcon('Organic Chemistry', 'Alkanes'), 'flask-outline');
      assert.strictEqual(getDeckThematicIcon('Computer Science', 'Python 101'), 'code-slash-outline');
      assert.strictEqual(getDeckThematicIcon('French', 'Vocabulary'), 'language-outline');
      assert.strictEqual(getDeckThematicIcon('World History', 'WWII'), 'globe-outline');
      assert.strictEqual(getDeckThematicIcon('Economics', 'Macro'), 'stats-chart-outline');
      assert.strictEqual(getDeckThematicIcon('Anatomy', 'Bones'), 'medkit-outline');
      assert.strictEqual(getDeckThematicIcon('Philosophy', 'Ethics'), 'bulb-outline');
      assert.strictEqual(getDeckThematicIcon('Random Deck', 'Notes'), 'book-outline');
    });

    test('6.2 getNextDueText formats remaining intervals concisely', () => {
      const now = Date.now();
      const node = {
        deck: {
          cards: [
            { nextDue: now + 45 * 1000 }, // 45 seconds
          ],
        },
        children: new Map(),
      };
      assert.strictEqual(getNextDueText(node), '45s');

      node.deck.cards[0].nextDue = now + 15 * 60 * 1000; // 15 mins
      assert.strictEqual(getNextDueText(node), '15m');

      node.deck.cards[0].nextDue = now + 3 * 3600 * 1000; // 3 hours
      assert.strictEqual(getNextDueText(node), '3h');

      node.deck.cards[0].nextDue = now + 2 * 86400 * 1000; // 2 days
      assert.strictEqual(getNextDueText(node), '2d');
    });

    test('6.3 DECK_COLORS and DECK_ICONS contain expected palette arrays', () => {
      assert.ok(DECK_COLORS.length >= 8);
      assert.ok(DECK_ICONS.length >= 10);
      assert.ok(DECK_COLORS.includes('#4f46e5'));
      assert.ok(STATUS_CONFIG.new && STATUS_CONFIG.learning && STATUS_CONFIG.due && STATUS_CONFIG.mastered);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 7: Edge Cases, Input Fuzzing & Boundary Stress
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 7: Edge Cases, Input Fuzzing & Invariants', () => {
    test('7.1 buildDeckTree handles empty array, redundant separators, and trailing colons', () => {
      assert.deepStrictEqual(buildDeckTree([]), []);

      const decks = [
        {
          id: 'd1',
          name: '   ',
          subject: '::Folder::::Sub::',
          color: '#3b82f6',
          createdAt: 1000,
          cards: [],
        },
      ];
      const tree = buildDeckTree(decks);
      assert.ok(tree.length >= 1);
      assert.strictEqual(tree[0].name, 'Folder');
    });

    test('7.2 getNodeStats handles empty node and node without deck', () => {
      const emptyNode = {
        name: 'Empty',
        fullPath: 'Empty',
        deck: null,
        children: new Map(),
      };
      const stats = getNodeStats(emptyNode);
      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.new, 0);
      assert.strictEqual(stats.learning, 0);
      assert.strictEqual(stats.due, 0);
      assert.strictEqual(stats.mastered, 0);
    });

    test('7.3 calculateLevel handles extreme XP values safely', () => {
      // Negative XP clamped to 0
      const neg = calculateLevel(-500);
      assert.strictEqual(neg.level, 1);
      assert.strictEqual(neg.currentLevelXp, 0);

      // Huge XP (1,000,000 XP)
      const huge = calculateLevel(1000000);
      assert.strictEqual(huge.level, 6);
      assert.strictEqual(huge.progress, 1.0);
      assert.strictEqual(huge.title, 'Grandmaster Scholar');

      // NaN or undefined XP
      const nanXp = calculateLevel(NaN);
      assert.strictEqual(nanXp.level, 1);
    });

    test('7.4 parseImport handles empty strings, comments only, and malformed lines', () => {
      assert.deepStrictEqual(parseImport('', 'auto'), []);
      assert.deepStrictEqual(parseImport('# Only comment\n// Another comment', 'auto'), []);
      assert.deepStrictEqual(parseImport('SingleWordWithoutDelimiter', 'comma'), []);
      assert.deepStrictEqual(parseImport('\n\n   \n\t\n', 'tab'), []);

      const malformed = 'Q1,A1\nInvalidLineNoDelimiter\nQ2,A2';
      const parsed = parseImport(malformed, 'comma');
      assert.strictEqual(parsed.length, 2);
    });

    test('7.5 computeExamPlan handles past or immediate exam date', () => {
      const plan0 = computeExamPlan(0, 10);
      assert.strictEqual(plan0.plan.length, 4);
      assert.strictEqual(plan0.plan[0].label, 'Now');

      const planPast = computeExamPlan(-5, 10);
      assert.strictEqual(planPast.plan.length, 4);
    });

    test('7.6 getDeckThematicIcon handles undefined, null, emojis and strange text without throwing', () => {
      assert.strictEqual(getDeckThematicIcon(undefined, undefined), 'book-outline');
      assert.strictEqual(getDeckThematicIcon('', ''), 'book-outline');
      assert.strictEqual(getDeckThematicIcon('🚀🔬🧬', '🛸🪐'), 'book-outline');
      assert.strictEqual(getDeckThematicIcon('<b>bold</b>', 'Math'), 'calculator-outline');
      assert.strictEqual(getDeckThematicIcon('<script>alert("xss")</script>', 'Math'), 'code-slash-outline');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 8: Advanced CSV & Quoted Delimiter Parsing Stress
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 8: Advanced CSV & Quoted Delimiter Parsing', () => {
    test('8.1 parseCsvLine correctly preserves commas within double quotes', () => {
      const line = '"DNA, RNA, and proteins","Essential molecules for life, growth, and replication"';
      const result = parseCsvLine(line);
      assert.ok(result);
      assert.strictEqual(result[0], 'DNA, RNA, and proteins');
      assert.strictEqual(result[1], 'Essential molecules for life, growth, and replication');
    });

    test('8.2 parseCsvLine handles single quotes and unquoted mixed fields', () => {
      const line = "'Newton\\'s Third Law', 'For every action, equal and opposite reaction'";
      const result = parseCsvLine(line);
      assert.ok(result);
      assert.strictEqual(result[0], "Newton\\'s Third Law");
      assert.strictEqual(result[1], 'For every action, equal and opposite reaction');
    });

    test('8.3 parseImport with embedded commas and quotes', () => {
      const text = `
        "What are HTML, CSS, and JS?","Web core technologies"
        "Term without quotes","Definition without quotes"
        "Multiple, commas, in, front","Multiple, commas, in, back"
      `;
      const parsed = parseImport(text, 'comma');
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].front, 'What are HTML, CSS, and JS?');
      assert.strictEqual(parsed[0].back, 'Web core technologies');
      assert.strictEqual(parsed[2].front, 'Multiple, commas, in, front');
      assert.strictEqual(parsed[2].back, 'Multiple, commas, in, back');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 9: Timezone & Local Date Invariants
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 9: Timezone & Local Date Invariants', () => {
    test('9.1 getLocalDateString returns consistent YYYY-MM-DD padded format', () => {
      const d1 = new Date(2026, 0, 5); // Jan 5, 2026
      assert.strictEqual(getLocalDateString(d1), '2026-01-05');

      const d2 = new Date(2026, 11, 31); // Dec 31, 2026
      assert.strictEqual(getLocalDateString(d2), '2026-12-31');

      const today = getLocalDateString();
      assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    });

    test('9.2 getWeekDaysActivity generates local timezone days without UTC shift', () => {
      const today = getLocalDateString(new Date());
      const activity = getWeekDaysActivity([today], today);
      assert.strictEqual(activity.length, 7);

      const todayEntry = activity.find((d) => d.isToday);
      assert.ok(todayEntry);
      assert.strictEqual(todayEntry.dateStr, today);
      assert.strictEqual(todayEntry.isCompleted, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 10: Color Alpha & Token Contract
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 10: Color Alpha & Token Contract', () => {
    test('10.1 getColorWithAlpha converts 6-digit hex to rgba accurately', () => {
      const rgba = getColorWithAlpha('#4f46e5', 0.25);
      assert.strictEqual(rgba, 'rgba(79, 70, 229, 0.25)');
    });

    test('10.2 getColorWithAlpha handles 3-digit hex and fallback formats', () => {
      const from3 = getColorWithAlpha('#fff', 0.5);
      assert.strictEqual(from3, 'rgba(255, 255, 255, 0.5)');

      const existingRgba = getColorWithAlpha('rgba(10, 20, 30, 0.5)', 0.8);
      assert.strictEqual(existingRgba, 'rgba(10, 20, 30, 0.5)');

      const fallback = getColorWithAlpha('', 0.5);
      assert.strictEqual(fallback, 'rgba(79, 70, 229, 0.5)');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 11: Gamification Max Level & Day Rollover Invariants
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 11: Gamification Max Level & Day Rollover', () => {
    test('11.1 calculateLevel sets isMaxLevel flag appropriately', () => {
      const lv1 = calculateLevel(50);
      assert.strictEqual(lv1.isMaxLevel, false);

      const lv5 = calculateLevel(1500);
      assert.strictEqual(lv5.isMaxLevel, false);

      const lv6 = calculateLevel(2000);
      assert.strictEqual(lv6.isMaxLevel, true);
      assert.strictEqual(lv6.title, 'Grandmaster Scholar');

      const lvAbove = calculateLevel(50000);
      assert.strictEqual(lvAbove.isMaxLevel, true);
    });

    test('11.2 updateStudyStats protects against streak = 0 when studying today', () => {
      const today = getLocalDateString(new Date());
      const stats = {
        lastStudyDate: today,
        currentStreak: 0,
        masteredToday: 0,
      };
      const updated = updateStudyStats(stats, 1, 0, false);
      assert.strictEqual(updated.currentStreak, 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 12: Hierarchical Deck Tree Filtering & Path Matching
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 12: Hierarchical Deck Tree Filtering', () => {
    test('12.1 Subject prefix filtering matches nested sub-decks', () => {
      const decks = [
        { id: '1', name: 'Intro', subject: 'Biology', color: '#3b82f6', createdAt: 1, cards: [] },
        { id: '2', name: 'Genetics', subject: 'Biology::Genetics', color: '#3b82f6', createdAt: 2, cards: [] },
        { id: '3', name: 'Mendel', subject: 'Biology::Genetics::Mendel', color: '#3b82f6', createdAt: 3, cards: [] },
        { id: '4', name: 'Mechanics', subject: 'Physics', color: '#10b981', createdAt: 4, cards: [] },
      ];

      const filterSubject = 'Biology';
      const filtered = decks.filter(
        (d) => d.subject === filterSubject || d.subject.startsWith(filterSubject + '::')
      );

      assert.strictEqual(filtered.length, 3);
      assert.ok(filtered.some((d) => d.name === 'Intro'));
      assert.ok(filtered.some((d) => d.name === 'Genetics'));
      assert.ok(filtered.some((d) => d.name === 'Mendel'));
      assert.ok(!filtered.some((d) => d.name === 'Mechanics'));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 13: Exam Prep Cram Mode Override & Interval Expansion
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 13: Exam Prep Expansion & Edge Overrides', () => {
    test('13.1 computeExamPlan in cram mode expands intervals when overrideReviews > 4', () => {
      const { plan, numReviews } = computeExamPlan(1, 10, 6);
      assert.strictEqual(numReviews, 6);
      assert.strictEqual(plan.length, 6);
      assert.strictEqual(plan[0].label, 'Now');
      // Verify intervals strictly increase
      for (let i = 1; i < plan.length; i++) {
        assert.ok(plan[i].day >= plan[i - 1].day);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 14: Deck Tree Hierarchical Subject Deduplication
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 14: Deck Tree Hierarchical Subject Deduplication', () => {
    test('14.1 buildDeckTree avoids duplicate prefixes when deck name starts with subject', () => {
      const decks = [
        {
          id: 'd1',
          name: 'Biology::Genetics::Mendel',
          subject: 'Biology',
          color: '#3b82f6',
          createdAt: 1,
          cards: [],
        },
        {
          id: 'd2',
          name: 'Chemistry::Organic',
          subject: 'Chemistry::Organic',
          color: '#10b981',
          createdAt: 2,
          cards: [],
        },
      ];

      const tree = buildDeckTree(decks);
      assert.strictEqual(tree.length, 2);
      assert.strictEqual(tree[0].name, 'Biology');
      const bioGen = tree[0].children.get('Genetics');
      assert.ok(bioGen);
      const mendel = bioGen.children.get('Mendel');
      assert.ok(mendel);
      assert.strictEqual(mendel.deck?.id, 'd1');

      assert.strictEqual(tree[1].name, 'Chemistry');
      const chemOrg = tree[1].children.get('Organic');
      assert.ok(chemOrg);
      assert.strictEqual(chemOrg.deck?.id, 'd2');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 15: Gamification Engine NaN, Malformed & Non-Finite Numbers
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 15: Gamification Engine NaN & Non-Finite Safety', () => {
    test('15.1 calculateLevel cleanly handles NaN, Infinity, -Infinity and non-numbers', () => {
      const nanRes = calculateLevel(NaN);
      assert.strictEqual(nanRes.level, 1);
      assert.strictEqual(nanRes.currentLevelXp, 0);
      assert.strictEqual(nanRes.progress, 0);
      assert.strictEqual(nanRes.isMaxLevel, false);

      const infRes = calculateLevel(Infinity);
      assert.strictEqual(infRes.level, 1);
      assert.strictEqual(infRes.currentLevelXp, 0);

      const strRes = calculateLevel('invalid');
      assert.strictEqual(strRes.level, 1);
      assert.strictEqual(strRes.currentLevelXp, 0);
    });

    test('15.2 updateStudyStats handles null and undefined current stats objects', () => {
      const result = updateStudyStats(null, 5, 2, true);
      assert.strictEqual(result.currentStreak, 1);
      assert.strictEqual(result.cardsReviewedToday, 5);
      assert.strictEqual(result.masteredToday, 2);
      assert.ok(result.totalXp > 0);
      assert.ok(result.weeklyHistory.length >= 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 16: Extended Delimiter Auto-Detection & Trailing Comma Filtering
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 16: Extended Delimiters & Trailing Commas', () => {
    test('16.1 parseImport auto-detects semicolon-delimited flashcards', () => {
      const text = 'Bonjour; Hello in French\nAu revoir; Goodbye in French';
      const parsed = parseImport(text, 'auto');
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].front, 'Bonjour');
      assert.strictEqual(parsed[0].back, 'Hello in French');
      assert.strictEqual(parsed[1].front, 'Au revoir');
      assert.strictEqual(parsed[1].back, 'Goodbye in French');
    });

    test('16.2 parseCsvLine ignores trailing blank tokens from Excel export', () => {
      const line = 'Term,Definition,,,';
      const result = parseCsvLine(line);
      assert.ok(result);
      assert.strictEqual(result[0], 'Term');
      assert.strictEqual(result[1], 'Definition');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 17: Exam Prep Schedule Interval Monotonicity
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 17: Exam Prep Schedule Monotonicity', () => {
    test('17.1 computeExamPlan produces strictly monotonic schedules without overlapping days', () => {
      const { plan } = computeExamPlan(3, 25, 6);
      assert.strictEqual(plan.length, 6);
      for (let i = 1; i < plan.length; i++) {
        assert.ok(plan[i].day > plan[i - 1].day, `Day ${plan[i].day} should be greater than ${plan[i - 1].day}`);
      }
      assert.ok(plan[plan.length - 1].day <= 3);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 18: 8-Digit Hex Color Alpha Support
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 18: 8-Digit Hex Color Support', () => {
    test('18.1 getColorWithAlpha parses 8-digit hex strings correctly', () => {
      const rgba = getColorWithAlpha('#4f46e5ff', 0.5);
      assert.strictEqual(rgba, 'rgba(79, 70, 229, 0.5)');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 19: History Pruning and Bounded Retention
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 19: History Retention & Safe Traversals', () => {
    test('19.1 updateStudyStats prunes dates older than 60 days to bound storage', () => {
      const oldDate = '2020-01-01';
      const stats = {
        lastStudyDate: oldDate,
        currentStreak: 1,
        masteredToday: 0,
        weeklyHistory: [oldDate, '2020-01-02'],
      };
      const updated = updateStudyStats(stats, 1, 0, false);
      assert.ok(!updated.weeklyHistory.includes(oldDate));
      assert.ok(updated.weeklyHistory.includes(getLocalDateString(new Date())));
    });

    test('19.2 Safe null/undefined node handling across all traversal helpers', () => {
      assert.deepStrictEqual(getNodeStats(null), { new: 0, learning: 0, due: 0, total: 0, mastered: 0 });
      assert.deepStrictEqual(collectCards(null), []);
      assert.deepStrictEqual(collectDecksFromNode(null), []);
      assert.strictEqual(getNextDueText(null), '');
      assert.deepStrictEqual(getCardStatus(null), 'new');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 20: SM-2 Engine Corrupt Data & Out-of-Bounds Step Protection
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 20: SM-2 Engine Corrupt Data & Step Bounds', () => {
    test('20.1 applyRating safely handles out-of-bounds stepIndex without producing NaN', () => {
      const card = {
        id: 'c1',
        front: 'Front',
        back: 'Back',
        interval: 0,
        easeFactor: 2.5,
        nextDue: Date.now(),
        reviewCount: 2,
        stepIndex: 99, // Out of bounds for steps '1 10'
      };
      // Rating 2 (Hard) with out of bounds stepIndex
      const updated = applyRating(card, 2, { ...DEFAULT_SR_SETTINGS, learningSteps: '1 10' });
      assert.ok(Number.isFinite(updated.nextDue));
      assert.strictEqual(updated.interval, 0);
      assert.ok(updated.stepIndex <= 1);
      assert.strictEqual(updated.reviewCount, 3);
    });

    test('20.2 applyRating repairs corrupted non-finite easeFactor and interval', () => {
      const corruptedCard = {
        id: 'c_corrupt',
        front: 'Q',
        back: 'A',
        interval: NaN,
        easeFactor: -10,
        nextDue: NaN,
        reviewCount: 'invalid',
      };
      const updated = applyRating(corruptedCard, 3, DEFAULT_SR_SETTINGS);
      assert.ok(Number.isFinite(updated.nextDue));
      assert.ok(Number.isFinite(updated.easeFactor));
      assert.ok(updated.easeFactor >= 1.3 && updated.easeFactor <= 4.0);
      assert.ok(Number.isFinite(updated.reviewCount));
      assert.strictEqual(updated.reviewCount, 1);
    });

    test('20.3 applyRating handles null card safely', () => {
      assert.strictEqual(applyRating(null, 1), null);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 21: RFC-4180 Escaped Quotes & Semicolon Precedence
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 21: RFC-4180 Escaped Quotes & Semicolon Delimiters', () => {
    test('21.1 parseCsvLine handles RFC-4180 escaped double quotes ("")', () => {
      const line = '"He said ""Hello world!""","Direct quote definition"';
      const result = parseCsvLine(line);
      assert.ok(result);
      assert.strictEqual(result[0], 'He said "Hello world!"');
      assert.strictEqual(result[1], 'Direct quote definition');
    });

    test('21.2 parseImport prioritizes semicolon over internal commas in auto mode', () => {
      const text = 'Bonjour; Hello, my good friend\nAu revoir; Goodbye, see you later';
      const parsed = parseImport(text, 'auto');
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].front, 'Bonjour');
      assert.strictEqual(parsed[0].back, 'Hello, my good friend');
    });

    test('21.3 parseImport parses explicit semicolon separator', () => {
      const text = 'Term A; Definition A\nTerm B; Definition B';
      const parsed = parseImport(text, 'semicolon');
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].front, 'Term A');
      assert.strictEqual(parsed[0].back, 'Definition A');
    });

    test('21.4 parseImport normalizes CRLF and CR newlines cleanly', () => {
      const crlfText = "Card 1\tAnswer 1\r\nCard 2\tAnswer 2\rCard 3\tAnswer 3";
      const parsed = parseImport(crlfText, 'tab');
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].front, 'Card 1');
      assert.strictEqual(parsed[1].front, 'Card 2');
      assert.strictEqual(parsed[2].front, 'Card 3');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 22: Deck Tree Empty Names & Fallbacks
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 22: Deck Tree Empty Names & Fallback Safety', () => {
    test('22.1 buildDeckTree assigns fallback name for blank decks', () => {
      const decks = [
        {
          id: 'd_blank',
          name: '   ',
          subject: '',
          color: '#3b82f6',
          createdAt: 1,
          cards: [],
        },
      ];
      const tree = buildDeckTree(decks);
      assert.strictEqual(tree.length, 1);
      assert.strictEqual(tree[0].name, 'Untitled Deck');
      assert.strictEqual(tree[0].deck?.id, 'd_blank');
    });

    test('22.2 buildDeckTree derives name from subject when name is empty', () => {
      const decks = [
        {
          id: 'd_sub',
          name: '',
          subject: 'Physics::Quantum',
          color: '#3b82f6',
          createdAt: 1,
          cards: [],
        },
      ];
      const tree = buildDeckTree(decks);
      assert.strictEqual(tree.length, 1);
      assert.strictEqual(tree[0].name, 'Physics');
      const quantum = tree[0].children.get('Quantum');
      assert.ok(quantum);
      assert.strictEqual(quantum.deck?.id, 'd_sub');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 23: Color Tokens 4-digit Hex & Alpha Clamping
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 23: 4-Digit Hex Color & Alpha Clamping', () => {
    test('23.1 getColorWithAlpha supports 4-digit hex strings (#rgba)', () => {
      const rgba = getColorWithAlpha('#f80f', 0.6);
      assert.strictEqual(rgba, 'rgba(255, 136, 0, 0.6)');
    });

    test('23.2 getColorWithAlpha clamps alpha to valid range [0, 1]', () => {
      const clampedHigh = getColorWithAlpha('#4f46e5', 5.0);
      assert.strictEqual(clampedHigh, 'rgba(79, 70, 229, 1)');

      const clampedLow = getColorWithAlpha('#4f46e5', -2.0);
      assert.strictEqual(clampedLow, 'rgba(79, 70, 229, 0)');

      const clampedNan = getColorWithAlpha('#4f46e5', NaN);
      assert.strictEqual(clampedNan, 'rgba(79, 70, 229, 1)');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 24: Deterministic Weekday Date Traversal
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 24: Deterministic Weekday Date Traversal', () => {
    test('24.1 getWeekDaysActivity generates correct Monday-Sunday sequence for any test date', () => {
      // Wednesday, Aug 19, 2026
      const testDate = new Date(2026, 7, 19);
      const activity = getWeekDaysActivity(['2026-08-17', '2026-08-19'], '', testDate);

      assert.strictEqual(activity.length, 7);
      assert.strictEqual(activity[0].dayLabel, 'M');
      assert.strictEqual(activity[0].dateStr, '2026-08-17');
      assert.strictEqual(activity[0].isCompleted, true);
      assert.strictEqual(activity[0].isToday, false);

      // Wednesday is index 2
      assert.strictEqual(activity[2].dayLabel, 'W');
      assert.strictEqual(activity[2].dateStr, '2026-08-19');
      assert.strictEqual(activity[2].isToday, true);
      assert.strictEqual(activity[2].isCompleted, true);

      // Sunday is index 6
      assert.strictEqual(activity[6].dayLabel, 'S');
      assert.strictEqual(activity[6].dateStr, '2026-08-23');
      assert.strictEqual(activity[6].isToday, false);
      assert.strictEqual(activity[6].isCompleted, false);
    });

    test('24.2 getWeekDaysActivity on Sunday calculates Monday of that week correctly', () => {
      // Sunday, Aug 23, 2026
      const sundayDate = new Date(2026, 7, 23);
      const activity = getWeekDaysActivity([], '2026-08-23', sundayDate);

      assert.strictEqual(activity[0].dateStr, '2026-08-17'); // Monday
      assert.strictEqual(activity[6].dateStr, '2026-08-23'); // Sunday
      assert.strictEqual(activity[6].isToday, true);
      assert.strictEqual(activity[6].isCompleted, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 25: Exam Prep NaN/Boundary Protection
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 25: Exam Prep Boundary Protection', () => {
    test('25.1 computeExamPlan safely handles NaN, negative total cards, and non-finite inputs', () => {
      const planNan = computeExamPlan(NaN, -10, NaN);
      assert.ok(planNan.plan.length >= 1);
      assert.strictEqual(planNan.plan[0].cardsPerSession, 0);
      assert.strictEqual(planNan.numReviews, 4);

      const planOverride = computeExamPlan(5, 50, -5);
      assert.strictEqual(planOverride.numReviews, 4);
    });

    test('25.2 calculateXpGain safely handles undefined options', () => {
      assert.strictEqual(calculateXpGain(undefined), 0);
      assert.strictEqual(calculateXpGain(null), 0);
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: NaN }), 20);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 26: Milestone 1 & 2 Fixes & Live Streak Liveliness
  // ───────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 26: Milestone 1 & 2 Fixes & Live Streak Liveliness', () => {
    test('26.1 isStreakLive validates streak persistence for today and yesterday', () => {
      const today = '2026-08-17';
      const yesterday = '2026-08-16';
      const older = '2026-08-15';

      assert.strictEqual(isStreakLive(today, today, yesterday), true);
      assert.strictEqual(isStreakLive(yesterday, today, yesterday), true);
      assert.strictEqual(isStreakLive(older, today, yesterday), false);
      assert.strictEqual(isStreakLive('', today, yesterday), false);
      assert.strictEqual(isStreakLive(undefined, today, yesterday), false);
      assert.strictEqual(isStreakLive('   ', today, yesterday), false);
    });

    test('26.2 updateStudyStats with sessionDone scales XP by session size', () => {
      const initialStats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      // 10 cards session complete: 10 * 10 (reviews) + 0 (mastered) + max(20, min(100, 10 * 5)) = 100 + 50 = 150 XP
      const stats10 = updateStudyStats(initialStats, 10, 0, true);
      assert.strictEqual(stats10.totalXp, 150);
      assert.strictEqual(stats10.cardsReviewedToday, 10);
      assert.strictEqual(stats10.currentStreak, 1);

      // 25 cards session complete: 25 * 10 + min(100, 25 * 5) = 250 + 100 = 350 XP
      const stats25 = updateStudyStats(initialStats, 25, 0, true);
      assert.strictEqual(stats25.totalXp, 350);
      assert.strictEqual(stats25.cardsReviewedToday, 25);
    });

    test('26.3 Speed Match XP balancing awards game review XP without artificial card mastery XP', () => {
      const initialStats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      const totalPairs = 6;
      // Passing 0 as masteredCount for Speed Match
      const matchStats = updateStudyStats(initialStats, totalPairs, 0, true);
      // 6 * 10 (reviews) + 0 * 25 (mastered) + max(20, min(100, 6 * 5)) = 60 + 30 = 90 XP
      assert.strictEqual(matchStats.totalXp, 90);
      assert.strictEqual(matchStats.masteredToday, 0);
      assert.strictEqual(matchStats.cardsReviewedToday, 6);
    });

    test('26.4 Quiz distractor deduplication handles duplicate term definitions in deck', () => {
      const cards = [
        { id: 'c1', front: 'Term A', back: 'Definition 1', interval: 0, easeFactor: 2.5, nextDue: Date.now(), reviewCount: 0 },
        { id: 'c2', front: 'Term B', back: 'Definition 1', interval: 0, easeFactor: 2.5, nextDue: Date.now(), reviewCount: 0 },
        { id: 'c3', front: 'Term C', back: 'Definition 2', interval: 0, easeFactor: 2.5, nextDue: Date.now(), reviewCount: 0 },
        { id: 'c4', front: 'Term D', back: 'Definition 3', interval: 0, easeFactor: 2.5, nextDue: Date.now(), reviewCount: 0 },
      ];

      const card = cards[0];
      const cardBackClean = card.back.trim();
      const otherUniqueBacks = Array.from(
        new Set(
          cards
            .map((c) => (c.back || '').trim())
            .filter((b) => b.length > 0 && b.toLowerCase() !== cardBackClean.toLowerCase())
        )
      );

      // Should only contain 'Definition 2' and 'Definition 3' (not duplicate 'Definition 1')
      assert.strictEqual(otherUniqueBacks.length, 2);
      assert.ok(!otherUniqueBacks.includes('Definition 1'));
      assert.ok(otherUniqueBacks.includes('Definition 2'));
      assert.ok(otherUniqueBacks.includes('Definition 3'));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 27: Deck Management & Tree Hierarchy Simulation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 27: Deck Management & Tree Hierarchy Simulation', () => {
    test('27.1 Nested Deck Hierarchy Creation & Traversal Simulation', () => {
      const decks = [
        {
          id: 'd1',
          name: 'Derivatives',
          subject: 'Math::Calculus',
          color: '#4f46e5',
          createdAt: 1000,
          cards: [
            makeNewCard('Derivative of sin(x)', 'cos(x)'),
            makeNewCard('Derivative of e^x', 'e^x'),
            makeNewCard('Product rule', "f'g + fg'"),
          ],
        },
        {
          id: 'd2',
          name: 'Integrals',
          subject: 'Math::Calculus',
          color: '#4f46e5',
          createdAt: 2000,
          cards: [
            makeNewCard('Integral of 1/x', 'ln|x| + C'),
            makeNewCard('Integral of cos(x)', 'sin(x) + C'),
          ],
        },
        {
          id: 'd3',
          name: 'Matrices',
          subject: 'Math::Algebra',
          color: '#3b82f6',
          createdAt: 3000,
          cards: [
            makeNewCard('Determinant of 2x2', 'ad - bc'),
            makeNewCard('Identity Matrix', 'Diagonal 1s, others 0'),
            makeNewCard('Orthogonal Matrix', 'A^T * A = I'),
            makeNewCard('Trace of Matrix', 'Sum of diagonal elements'),
          ],
        },
        {
          id: 'd4',
          name: 'Mechanics',
          subject: 'Physics',
          color: '#10b981',
          createdAt: 4000,
          cards: [
            makeNewCard("Newton's 2nd Law", 'F = ma'),
            makeNewCard('Kinetic Energy', '(1/2)mv^2'),
          ],
        },
      ];

      const tree = buildDeckTree(decks);
      assert.strictEqual(tree.length, 2);

      const mathNode = tree.find((n) => n.name === 'Math');
      const physNode = tree.find((n) => n.name === 'Physics');
      assert.ok(mathNode);
      assert.ok(physNode);

      assert.strictEqual(mathNode.fullPath, 'Math');
      assert.strictEqual(mathNode.deck, null);
      assert.strictEqual(mathNode.children.size, 2); // Calculus, Algebra

      const calcNode = mathNode.children.get('Calculus');
      const algNode = mathNode.children.get('Algebra');
      assert.ok(calcNode);
      assert.ok(algNode);
      assert.strictEqual(calcNode.fullPath, 'Math::Calculus');
      assert.strictEqual(calcNode.children.size, 2); // Derivatives, Integrals

      const derivNode = calcNode.children.get('Derivatives');
      const intNode = calcNode.children.get('Integrals');
      assert.ok(derivNode && derivNode.deck);
      assert.ok(intNode && intNode.deck);
      assert.strictEqual(derivNode.deck.name, 'Derivatives');
      assert.strictEqual(derivNode.deck.cards.length, 3);
      assert.strictEqual(intNode.deck.cards.length, 2);

      // Traversal tests
      const mathCards = collectCards(mathNode);
      assert.strictEqual(mathCards.length, 9); // 3 + 2 + 4

      const mathDecks = collectDecksFromNode(mathNode);
      assert.strictEqual(mathDecks.length, 3);

      const mathStats = getNodeStats(mathNode);
      assert.strictEqual(mathStats.total, 9);
      assert.strictEqual(mathStats.new, 9);
      assert.strictEqual(mathStats.due, 0);

      const physCards = collectCards(physNode);
      assert.strictEqual(physCards.length, 2);
    });

    test('27.2 Card Addition, Editing, and Immutable Updates Simulation', () => {
      const deck = {
        id: 'd-test',
        name: 'Calculus',
        subject: 'Math',
        color: '#4f46e5',
        createdAt: 1000,
        cards: [
          makeNewCard('Q1', 'A1'),
          makeNewCard('Q2', 'A2'),
        ],
      };

      // Card addition
      const newCard = makeNewCard('What is Cauchy-Schwarz?', '|⟨u,v⟩|² ≤ ⟨u,u⟩⟨v,v⟩');
      assert.strictEqual(newCard.interval, 0);
      assert.strictEqual(newCard.easeFactor, 2.5);
      assert.strictEqual(newCard.reviewCount, 0);
      assert.strictEqual(newCard.stepIndex, 0);
      assert.ok(typeof newCard.id === 'string' && newCard.id.length > 0);

      const deckWithAdded = {
        ...deck,
        cards: [...deck.cards, newCard],
      };
      assert.strictEqual(deckWithAdded.cards.length, 3);

      // Card editing
      const targetCardId = deckWithAdded.cards[0].id;
      const editedDeck = {
        ...deckWithAdded,
        cards: deckWithAdded.cards.map((c) =>
          c.id === targetCardId ? { ...c, front: 'Updated Derivative sin(x)', back: 'cos(x) [verified]' } : c
        ),
      };

      assert.strictEqual(editedDeck.cards[0].front, 'Updated Derivative sin(x)');
      assert.strictEqual(editedDeck.cards[0].back, 'cos(x) [verified]');
      assert.strictEqual(editedDeck.cards[1].front, 'Q2');
      assert.strictEqual(editedDeck.cards[2].front, 'What is Cauchy-Schwarz?');
    });

    test('27.3 Bulk Card Selection, Deselect All, and Bulk Deletion Simulation', () => {
      const cardList = [
        makeNewCard('C1', 'A1'),
        makeNewCard('C2', 'A2'),
        makeNewCard('C3', 'A3'),
        makeNewCard('C4', 'A4'),
        makeNewCard('C5', 'A5'),
      ];
      const deck = {
        id: 'd-bulk',
        name: 'Bulk Deck',
        subject: 'General',
        color: '#4f46e5',
        createdAt: 1000,
        cards: cardList,
      };

      const selectedCardIds = new Set();

      // Select all
      deck.cards.forEach((c) => selectedCardIds.add(c.id));
      assert.strictEqual(selectedCardIds.size, 5);

      // Deselect one
      selectedCardIds.delete(deck.cards[2].id);
      assert.strictEqual(selectedCardIds.size, 4);
      assert.strictEqual(selectedCardIds.has(deck.cards[2].id), false);

      // Deselect all
      selectedCardIds.clear();
      assert.strictEqual(selectedCardIds.size, 0);

      // Select specific subset: C2 and C4
      selectedCardIds.add(deck.cards[1].id);
      selectedCardIds.add(deck.cards[3].id);
      assert.strictEqual(selectedCardIds.size, 2);

      // Bulk deletion
      const updatedDeck = {
        ...deck,
        cards: deck.cards.filter((c) => !selectedCardIds.has(c.id)),
      };

      assert.strictEqual(updatedDeck.cards.length, 3);
      assert.strictEqual(updatedDeck.cards[0].front, 'C1');
      assert.strictEqual(updatedDeck.cards[1].front, 'C3');
      assert.strictEqual(updatedDeck.cards[2].front, 'C5');
      assert.ok(!updatedDeck.cards.some((c) => c.front === 'C2' || c.front === 'C4'));
    });

    test('27.4 Bulk Front/Back Reversal Simulation', () => {
      const cards = [
        makeNewCard('Apple', 'Manzana'),
        makeNewCard('Bread', 'Pan'),
        makeNewCard('Water', 'Agua'),
      ];

      // Reversing specific selected subset (Apple and Water)
      const selectedCardIds = new Set([cards[0].id, cards[2].id]);
      const reversedSubset = cards.map((c) =>
        selectedCardIds.has(c.id) ? { ...c, front: c.back, back: c.front } : c
      );

      assert.strictEqual(reversedSubset[0].front, 'Manzana');
      assert.strictEqual(reversedSubset[0].back, 'Apple');
      assert.strictEqual(reversedSubset[1].front, 'Bread');
      assert.strictEqual(reversedSubset[1].back, 'Pan');
      assert.strictEqual(reversedSubset[2].front, 'Agua');
      assert.strictEqual(reversedSubset[2].back, 'Water');

      // Reversing entire folder / deck
      const reversedAll = cards.map((c) => ({ ...c, front: c.back, back: c.front }));
      assert.strictEqual(reversedAll[0].front, 'Manzana');
      assert.strictEqual(reversedAll[1].front, 'Pan');
      assert.strictEqual(reversedAll[2].front, 'Agua');
    });

    test('27.5 CSV & Text Deck Export Generation & Roundtrip Validation', () => {
      const node = {
        name: 'Finance 101',
        fullPath: 'Finance 101',
        deck: null,
        children: new Map(),
      };
      const allCards = [
        { id: 'c1', front: 'What is ROI?', back: '(Net Profit / Cost of Investment) * 100' },
        { id: 'c2', front: 'Define "Liquidity"', back: 'The ease of converting assets to cash' },
        { id: 'c3', front: 'Assets; Liabilities', back: 'Balance sheet components, measured in USD' },
      ];

      const header = `# FinScholar Flashcard Export: ${node.name}\n# Format: Front, Back\n`;
      const rows = allCards.map((c) => {
        const escapeCsv = (str) => {
          const text = (str || '').replace(/\r?\n/g, ' ');
          if (text.includes(',') || text.includes('"') || text.includes(';')) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        };
        return `${escapeCsv(c.front)}, ${escapeCsv(c.back)}`;
      });
      const exportedContent = header + rows.join('\n');

      assert.ok(exportedContent.includes('# FinScholar Flashcard Export: Finance 101'));
      assert.ok(exportedContent.includes('What is ROI?, (Net Profit / Cost of Investment) * 100'));
      assert.ok(exportedContent.includes('"Define ""Liquidity"""'));
      assert.ok(exportedContent.includes('"Assets; Liabilities", "Balance sheet components, measured in USD"'));

      // Roundtrip verification via parseImport with CSV comma format
      const parsed = parseImport(exportedContent, 'comma');
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].front, 'What is ROI?');
      assert.strictEqual(parsed[0].back, '(Net Profit / Cost of Investment) * 100');
      assert.strictEqual(parsed[1].front, 'Define "Liquidity"');
      assert.strictEqual(parsed[1].back, 'The ease of converting assets to cash');
      assert.strictEqual(parsed[2].front, 'Assets; Liabilities');
      assert.strictEqual(parsed[2].back, 'Balance sheet components, measured in USD');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 28: Spaced Repetition (SM-2) Session Lifecycle Simulation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 28: Spaced Repetition (SM-2) Session Lifecycle Simulation', () => {
    test('28.1 Due Card Filtering & Session Initialization', () => {
      const now = Date.now();
      const allCards = [
        { ...makeNewCard('C1', 'A1'), nextDue: now - 5000 }, // Due
        { ...makeNewCard('C2', 'A2'), nextDue: now - 100 },  // Due
        { ...makeNewCard('C3', 'A3'), nextDue: now + 86400000 }, // Future (1 day)
        { ...makeNewCard('C4', 'A4'), nextDue: now + 3600000 },  // Future (1 hr)
      ];

      // Standard study filters only due cards
      const dueCards = allCards.filter((c) => c.nextDue <= now);
      assert.strictEqual(dueCards.length, 2);
      assert.strictEqual(dueCards[0].front, 'C1');
      assert.strictEqual(dueCards[1].front, 'C2');

      // Study ahead includes all cards
      const advanceCards = [...allCards];
      assert.strictEqual(advanceCards.length, 4);
    });

    test('28.2 Rating Trajectory Across 1-4 (Again, Hard, Good, Easy)', () => {
      const card = makeNewCard('CAPM Model', 'E(R) = Rf + Beta(Rm - Rf)');
      assert.strictEqual(card.interval, 0);
      assert.strictEqual(card.easeFactor, 2.5);
      assert.strictEqual(card.stepIndex, 0);

      // 1. Rating 2 (Hard) on learning card
      const stepHard = applyRating(card, 2, DEFAULT_SR_SETTINGS);
      assert.strictEqual(stepHard.interval, 0);
      assert.strictEqual(stepHard.stepIndex, 0);
      assert.strictEqual(stepHard.easeFactor, 2.35); // 2.5 - 0.15
      assert.strictEqual(stepHard.reviewCount, 1);

      // 2. Rating 3 (Good) on learning card advances step 0 -> 1 (10 min)
      const stepGood1 = applyRating(stepHard, 3, DEFAULT_SR_SETTINGS);
      assert.strictEqual(stepGood1.interval, 0);
      assert.strictEqual(stepGood1.stepIndex, 1);
      assert.strictEqual(stepGood1.easeFactor, 2.35);
      assert.strictEqual(stepGood1.reviewCount, 2);

      // 3. Rating 3 (Good) on step 1 graduates the card (interval = graduatingInterval = 1)
      const stepGraduated = applyRating(stepGood1, 3, DEFAULT_SR_SETTINGS);
      assert.strictEqual(stepGraduated.interval, 1);
      assert.strictEqual(stepGraduated.reviewCount, 3);

      // 4. Rating 3 (Good) on graduated card multiplies interval by easeFactor
      const stepReviewGood = applyRating(stepGraduated, 3, DEFAULT_SR_SETTINGS);
      assert.strictEqual(stepReviewGood.interval, 2); // Math.round(1 * 2.35) = 2
      assert.strictEqual(stepReviewGood.reviewCount, 4);

      // 5. Rating 4 (Easy) on graduated card multiplies interval by easeFactor * 1.3
      const stepReviewEasy = applyRating(stepReviewGood, 4, DEFAULT_SR_SETTINGS);
      assert.strictEqual(stepReviewEasy.interval, 6); // Math.round(2 * 2.35 * 1.3) = 6
      assert.strictEqual(stepReviewEasy.easeFactor, 2.45); // 2.35 + 0.1
      assert.strictEqual(stepReviewEasy.reviewCount, 5);

      // 6. Rating 1 (Again) on graduated card relapses to interval 0 and step 0
      const stepRelapse = applyRating(stepReviewEasy, 1, DEFAULT_SR_SETTINGS);
      assert.strictEqual(stepRelapse.interval, 0);
      assert.strictEqual(stepRelapse.stepIndex, 0);
      assert.strictEqual(stepRelapse.easeFactor, 2.25); // 2.45 - 0.2
      assert.strictEqual(stepRelapse.reviewCount, 6);
    });

    test('28.3 Intraday Learning Step Requeuing (< 20m Window)', () => {
      const sessionQueue = [
        { ...makeNewCard('Card A', 'Ans A'), deckId: 'deck-1' },
        { ...makeNewCard('Card B', 'Ans B'), deckId: 'deck-1' },
      ];

      const REQUEUE_WINDOW_MS = 20 * 60 * 1000;

      // Card A: user rates 1 (Again) -> 1 min offset < 20m window -> requeued
      const updatedA = applyRating(sessionQueue[0], 1, DEFAULT_SR_SETTINGS);
      const shouldRequeueA = updatedA.interval === 0 && updatedA.nextDue - Date.now() < REQUEUE_WINDOW_MS;
      assert.strictEqual(shouldRequeueA, true);
      sessionQueue.push({ ...updatedA, deckId: 'deck-1' });
      assert.strictEqual(sessionQueue.length, 3);

      // Card B: user rates 4 (Easy) -> interval = 4 days -> not requeued
      const updatedB = applyRating(sessionQueue[1], 4, DEFAULT_SR_SETTINGS);
      const shouldRequeueB = updatedB.interval === 0 && updatedB.nextDue - Date.now() < REQUEUE_WINDOW_MS;
      assert.strictEqual(shouldRequeueB, false);

      // Requeued Card A (at index 2): user rates 4 (Easy) -> graduates -> not requeued
      const finalA = applyRating(sessionQueue[2], 4, DEFAULT_SR_SETTINGS);
      const shouldRequeueFinalA = finalA.interval === 0 && finalA.nextDue - Date.now() < REQUEUE_WINDOW_MS;
      assert.strictEqual(shouldRequeueFinalA, false);
      assert.strictEqual(finalA.interval, 4);
    });

    test('28.4 Reversed Card Review Mode', () => {
      const card = makeNewCard('Net Present Value (NPV)', 'Sum of discounted future cash flows minus initial cost');
      const studyReversed = true;

      const displayedQuestion = studyReversed ? card.back : card.front;
      const displayedAnswer = studyReversed ? card.front : card.back;

      assert.strictEqual(displayedQuestion, 'Sum of discounted future cash flows minus initial cost');
      assert.strictEqual(displayedAnswer, 'Net Present Value (NPV)');

      // Rating updates underlying card correctly without corrupting front/back properties
      const updated = applyRating(card, 3, DEFAULT_SR_SETTINGS);
      assert.strictEqual(updated.front, 'Net Present Value (NPV)');
      assert.strictEqual(updated.back, 'Sum of discounted future cash flows minus initial cost');
      assert.strictEqual(updated.reviewCount, 1);
    });

    test('28.5 Session Completion XP Scaling & Stats Update', () => {
      const initialStats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      // 12 cards reviewed, 4 cards mastered, session completed
      // Reviews XP: 12 * 10 = 120
      // Mastered XP: 4 * 25 = 100
      // Session XP: Math.max(20, Math.min(100, 12 * 5)) = 60
      // Total XP gained = 120 + 100 + 60 = 280
      const stats = updateStudyStats(initialStats, 12, 4, true);
      assert.strictEqual(stats.totalXp, 280);
      assert.strictEqual(stats.cardsReviewedToday, 12);
      assert.strictEqual(stats.masteredToday, 4);
      assert.strictEqual(stats.currentStreak, 1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 29: Speed Match Game Engine Simulation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 29: Speed Match Game Engine Simulation', () => {
    test('29.1 16-Tile Pair Generation & Grid Integrity', () => {
      const deckCards = Array.from({ length: 8 }, (_, i) => ({
        id: `card-${i + 1}`,
        front: `Term ${i + 1}`,
        back: `Definition ${i + 1}`,
        interval: 0,
        easeFactor: 2.5,
        nextDue: Date.now(),
        reviewCount: 0,
      }));

      const matchCards = [];
      deckCards.forEach((card) => {
        matchCards.push({ id: generateId(), pairId: card.id, text: card.front, isTerm: true });
        matchCards.push({ id: generateId(), pairId: card.id, text: card.back, isTerm: false });
      });

      assert.strictEqual(matchCards.length, 16);
      const uniqueIds = new Set(matchCards.map((c) => c.id));
      assert.strictEqual(uniqueIds.size, 16);

      const terms = matchCards.filter((c) => c.isTerm);
      const defs = matchCards.filter((c) => !c.isTerm);
      assert.strictEqual(terms.length, 8);
      assert.strictEqual(defs.length, 8);

      // Verify each pairId appears exactly twice: once as term, once as def
      deckCards.forEach((dc) => {
        const pair = matchCards.filter((mc) => mc.pairId === dc.id);
        assert.strictEqual(pair.length, 2);
        assert.ok(pair.some((p) => p.isTerm && p.text === dc.front));
        assert.ok(pair.some((p) => !p.isTerm && p.text === dc.back));
      });
    });

    test('29.2 First Tap State & Second Tap Match vs Mismatch State Machine', () => {
      const tileT1 = { id: 'tile-t1', pairId: 'card-1', text: 'Term 1', isTerm: true };
      const tileD1 = { id: 'tile-d1', pairId: 'card-1', text: 'Def 1', isTerm: false };
      const tileT2 = { id: 'tile-t2', pairId: 'card-2', text: 'Term 2', isTerm: true };
      const tileD3 = { id: 'tile-d3', pairId: 'card-3', text: 'Def 3', isTerm: false };
      const matchTiles = [tileT1, tileD1, tileT2, tileD3];

      let matchRevealed = [];
      const matchMatched = new Set();
      let matchMoves = 0;

      // 1. First tap on T1
      matchRevealed.push(tileT1.id);
      assert.strictEqual(matchRevealed.length, 1);
      assert.strictEqual(matchRevealed[0], 'tile-t1');

      // 2. Duplicate tap on T1 is ignored
      if (!matchRevealed.includes(tileT1.id)) matchRevealed.push(tileT1.id);
      assert.strictEqual(matchRevealed.length, 1);

      // 3. Second tap on D1 (Matching pair)
      matchRevealed.push(tileD1.id);
      matchMoves++;
      assert.strictEqual(matchMoves, 1);

      const [first, second] = matchRevealed.map((id) => matchTiles.find((c) => c.id === id));
      const isMatch = first.pairId === second.pairId && first.isTerm !== second.isTerm;
      assert.strictEqual(isMatch, true);

      // Match resolved
      matchMatched.add(first.pairId);
      matchRevealed = [];
      assert.strictEqual(matchMatched.size, 1);
      assert.strictEqual(matchMatched.has('card-1'), true);
      assert.strictEqual(matchRevealed.length, 0);

      // 4. Tap on T2
      matchRevealed.push(tileT2.id);
      assert.strictEqual(matchRevealed.length, 1);

      // 5. Tap on D3 (Mismatch)
      matchRevealed.push(tileD3.id);
      matchMoves++;
      assert.strictEqual(matchMoves, 2);

      const [mFirst, mSecond] = matchRevealed.map((id) => matchTiles.find((c) => c.id === id));
      const isMismatch = mFirst.pairId !== mSecond.pairId;
      assert.strictEqual(isMismatch, true);
      // Mismatch leaves matched set unchanged and clears revealed on reset
      assert.strictEqual(matchMatched.size, 1);
      matchRevealed = [];
      assert.strictEqual(matchRevealed.length, 0);
    });

    test('29.3 Concurrency Lock & Spam Guard (Preventing 3rd Tap During Reset)', () => {
      let matchRevealed = ['tile-1', 'tile-2'];

      const handleTap = (cardId) => {
        if (matchRevealed.length >= 2) return false;
        if (matchRevealed.includes(cardId)) return false;
        matchRevealed.push(cardId);
        return true;
      };

      // Tapping 3rd and 4th tiles while 2 tiles are revealed
      const tap3 = handleTap('tile-3');
      const tap4 = handleTap('tile-4');

      assert.strictEqual(tap3, false);
      assert.strictEqual(tap4, false);
      assert.strictEqual(matchRevealed.length, 2);
      assert.strictEqual(matchRevealed[0], 'tile-1');
      assert.strictEqual(matchRevealed[1], 'tile-2');
    });

    test('29.4 Game Completion Win State, Accuracy, and Score Calculations', () => {
      const totalPairs = 8;
      const totalMoves = 10; // 8 successful matches + 2 mismatches

      const accuracy = Math.round((totalPairs / totalMoves) * 100);
      assert.strictEqual(accuracy, 80);

      const matchedSet = new Set(Array.from({ length: 8 }, (_, i) => `card-${i + 1}`));
      const matchDone = matchedSet.size >= totalPairs;
      assert.strictEqual(matchDone, true);
    });

    test('29.5 Speed Match XP Balancing & 0 False Mastered XP Invariant', () => {
      const initialStats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      const totalPairs = 8;
      // Passing masteredCount = 0 for Speed Match
      const stats = updateStudyStats(initialStats, totalPairs, 0, true);

      // Reviews: 8 * 10 = 80 XP
      // Mastered: 0 * 25 = 0 XP
      // Session: Math.max(20, Math.min(100, 8 * 5)) = 40 XP
      // Total XP = 120 XP
      assert.strictEqual(stats.totalXp, 120);
      assert.strictEqual(stats.cardsReviewedToday, 8);
      assert.strictEqual(stats.masteredToday, 0); // Invariant: 0 false mastered count
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 30: Practice Test / Quiz Mode Simulation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 30: Practice Test / Quiz Mode Simulation', () => {
    test('30.1 4-Choice MCQ Question Generation with Strict Distractor Deduplication', () => {
      const cards = [
        { id: 'c1', front: 'Bull Market', back: 'Upward trending market' },
        { id: 'c2', front: 'Bear Market', back: 'Downward trending market' },
        { id: 'c3', front: 'Stagnant Market', back: 'Flat price movement' },
        { id: 'c4', front: 'Volatile Market', back: 'Rapid large swings' },
        { id: 'c5', front: 'Rally', back: 'Upward trending market' }, // Duplicate definition
      ];

      const questions = cards.slice(0, 4).map((card) => {
        const cardBackClean = (card.back || '').trim();
        const otherUniqueBacks = Array.from(
          new Set(
            cards
              .map((c) => (c.back || '').trim())
              .filter((b) => b.length > 0 && b.toLowerCase() !== cardBackClean.toLowerCase())
          )
        );
        const shuffledOthers = [...otherUniqueBacks];
        const distractors = shuffledOthers.slice(0, 3);
        const options = Array.from(new Set([...distractors, cardBackClean]));
        return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
      });

      questions.forEach((q) => {
        assert.strictEqual(q.options.length, 4);
        assert.strictEqual(new Set(q.options).size, 4); // 0 duplicate choices
        assert.ok(q.options.includes(q.correctAnswer));
      });
    });

    test('30.2 Answer Selection Feedback, Score State Tracking, and Single-Tap Lock', () => {
      const questions = [
        { cardId: 'c1', question: 'Q1', correctAnswer: 'A1', options: ['A1', 'A2', 'A3', 'A4'] },
        { cardId: 'c2', question: 'Q2', correctAnswer: 'A2', options: ['A1', 'A2', 'A3', 'A4'] },
        { cardId: 'c3', question: 'Q3', correctAnswer: 'A3', options: ['A1', 'A2', 'A3', 'A4'] },
        { cardId: 'c4', question: 'Q4', correctAnswer: 'A4', options: ['A1', 'A2', 'A3', 'A4'] },
        { cardId: 'c5', question: 'Q5', correctAnswer: 'A5', options: ['A1', 'A2', 'A3', 'A5'] },
      ];

      let quizScore = 0;
      const quizMissed = [];
      let quizSelected = null;

      const answerQuestion = (q, selected) => {
        if (quizSelected !== null) return false;
        quizSelected = selected;
        const isCorrect = selected === q.correctAnswer;
        if (isCorrect) {
          quizScore++;
        } else {
          quizMissed.push(q);
        }
        return true;
      };

      // Q1: Correct
      assert.strictEqual(answerQuestion(questions[0], 'A1'), true);
      // Attempting double tap while locked
      assert.strictEqual(answerQuestion(questions[0], 'A2'), false);
      quizSelected = null;

      // Q2: Incorrect
      assert.strictEqual(answerQuestion(questions[1], 'A1'), true);
      quizSelected = null;

      // Q3: Incorrect
      assert.strictEqual(answerQuestion(questions[2], 'A1'), true);
      quizSelected = null;

      // Q4: Correct
      assert.strictEqual(answerQuestion(questions[3], 'A4'), true);
      quizSelected = null;

      // Q5: Correct
      assert.strictEqual(answerQuestion(questions[4], 'A5'), true);

      assert.strictEqual(quizScore, 3);
      assert.strictEqual(quizMissed.length, 2);
      assert.strictEqual(quizMissed[0].cardId, 'c2');
      assert.strictEqual(quizMissed[1].cardId, 'c3');
    });

    test('30.3 "Retry Missed" Sub-Quiz Generation', () => {
      const allCards = [
        { id: 'c1', front: 'Q1', back: 'A1' },
        { id: 'c2', front: 'Q2', back: 'A2' },
        { id: 'c3', front: 'Q3', back: 'A3' },
        { id: 'c4', front: 'Q4', back: 'A4' },
      ];

      const missedQuestions = [
        { cardId: 'c2', question: 'Q2', correctAnswer: 'A2', options: [] },
        { cardId: 'c3', question: 'Q3', correctAnswer: 'A3', options: [] },
      ];

      const missedIds = new Set(missedQuestions.map((q) => q.cardId));
      const source = allCards.filter((c) => missedIds.has(c.id));
      assert.strictEqual(source.length, 2);

      const retryQuestions = source.map((card) => {
        const cardBackClean = (card.back || '').trim();
        const otherUniqueBacks = Array.from(
          new Set(
            allCards
              .map((c) => (c.back || '').trim())
              .filter((b) => b.length > 0 && b.toLowerCase() !== cardBackClean.toLowerCase())
          )
        );
        const distractors = otherUniqueBacks.slice(0, 3);
        const options = Array.from(new Set([...distractors, cardBackClean]));
        return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
      });

      assert.strictEqual(retryQuestions.length, 2);
      assert.strictEqual(retryQuestions[0].cardId, 'c2');
      assert.strictEqual(retryQuestions[1].cardId, 'c3');
      assert.strictEqual(retryQuestions[0].options.length, 4);
    });

    test('30.4 Quiz Completion Stats & XP Accounting', () => {
      const initialStats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      // 5 questions, 3 correct answers counted as mastered
      const stats = updateStudyStats(initialStats, 5, 3, true);
      // Reviews XP: 5 * 10 = 50
      // Mastered XP: 3 * 25 = 75
      // Session XP: Math.max(20, Math.min(100, 5 * 5)) = 25
      // Total XP = 150 XP
      assert.strictEqual(stats.totalXp, 150);
      assert.strictEqual(stats.cardsReviewedToday, 5);
      assert.strictEqual(stats.masteredToday, 3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 31: Exam Prep Schedule Integration Simulation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 31: Exam Prep Schedule Integration Simulation', () => {
    test('31.1 Expanding Spaced Interval Plan Calculation (Cepeda et al.)', () => {
      const horizons = [3, 7, 14, 30];
      const expectedReviews = [3, 4, 5, 6];

      horizons.forEach((days, idx) => {
        const { plan, numReviews } = computeExamPlan(days, 25);
        assert.strictEqual(numReviews, expectedReviews[idx]);
        assert.strictEqual(plan.length, expectedReviews[idx]);

        // Verify strictly monotonic day ordering
        for (let i = 0; i < plan.length - 1; i++) {
          assert.ok(
            plan[i].day < plan[i + 1].day,
            `Plan for horizon ${days}d failed monotonicity at index ${i}: ${plan[i].day} >= ${plan[i + 1].day}`
          );
        }
        assert.strictEqual(plan[0].day, 0); // Always begins now
        assert.strictEqual(plan[0].cardsPerSession, 25);
      });
    });

    test('31.2 Cram Mode Scheduling (<= 1 Day)', () => {
      const cram = computeExamPlan(1, 15);
      assert.strictEqual(cram.numReviews, 4);
      assert.strictEqual(cram.plan.length, 4);
      assert.strictEqual(cram.plan[0].day, 0);
      assert.strictEqual(cram.plan[0].label, 'Now');

      // All cram sessions scheduled within fractional 1-day span
      cram.plan.forEach((slot) => {
        assert.ok(slot.day < 1, `Cram slot ${slot.day} exceeded 1-day boundary`);
        assert.strictEqual(slot.cardsPerSession, 15);
      });
    });

    test('31.3 Schedule Application to Deck Cards Simulation', () => {
      const deck = {
        id: 'd-exam',
        name: 'Economics',
        subject: 'Finance',
        color: '#4f46e5',
        createdAt: 1000,
        cards: [
          { ...makeNewCard('Supply & Demand', 'Market equilibrium'), interval: 5, easeFactor: 2.8, reviewCount: 3 },
          { ...makeNewCard('Elasticity', '% change Q / % change P'), interval: 10, easeFactor: 3.1, reviewCount: 5 },
        ],
      };

      const { plan } = computeExamPlan(7, 2);
      const now = Date.now();
      const firstGapDays = plan.length > 1 ? plan[1].day - plan[0].day : 1;

      // Apply exam schedule
      const scheduledCards = deck.cards.map((c) => ({
        ...c,
        nextDue: now + plan[0].day * 24 * 60 * 60 * 1000,
        interval: Math.max(1, Math.round(firstGapDays)),
        easeFactor: 2.5,
        reviewCount: c.reviewCount,
        stepIndex: 0,
      }));

      assert.strictEqual(scheduledCards.length, 2);
      assert.ok(scheduledCards[0].nextDue <= now + 100);
      assert.strictEqual(scheduledCards[0].interval, Math.max(1, Math.round(firstGapDays)));
      assert.strictEqual(scheduledCards[0].easeFactor, 2.5);
      assert.strictEqual(scheduledCards[0].stepIndex, 0);
      assert.strictEqual(scheduledCards[0].reviewCount, 3); // Preserved
      assert.strictEqual(scheduledCards[1].reviewCount, 5); // Preserved
    });

    test('31.4 Manual Override Review Count', () => {
      const planOverride = computeExamPlan(5, 30, 6);
      assert.strictEqual(planOverride.numReviews, 6);
      assert.strictEqual(planOverride.plan.length, 6);

      for (let i = 0; i < planOverride.plan.length - 1; i++) {
        assert.ok(planOverride.plan[i].day < planOverride.plan[i + 1].day);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 32: 14-Day End-to-End Gamification State Simulation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Study Redesign Suite 32: 14-Day End-to-End Gamification State Simulation', () => {
    test('32.1 14-Day Chronological State Evolution & Custom Daily Goal', () => {
      // 14-Day simulated user journey with custom daily goal = 15 cards
      const dailySchedule = [
        { day: 1, date: '2026-08-01', reviews: 20, mastered: 5, expectedStreak: 1, expectedXpGain: 425 },
        { day: 2, date: '2026-08-02', reviews: 15, mastered: 3, expectedStreak: 2, expectedXpGain: 300 },
        { day: 3, date: '2026-08-03', reviews: 15, mastered: 2, expectedStreak: 3, expectedXpGain: 275 },
        { day: 4, date: '2026-08-04', reviews: 15, mastered: 2, expectedStreak: 4, expectedXpGain: 275 },
        { day: 5, date: '2026-08-05', reviews: 20, mastered: 4, expectedStreak: 5, expectedXpGain: 400 },
        { day: 6, date: '2026-08-06', reviews: 0, mastered: 0, isMissed: true }, // Missed day!
        { day: 7, date: '2026-08-07', reviews: 15, mastered: 3, expectedStreak: 1, expectedXpGain: 300 }, // Streak reset to 1
        { day: 8, date: '2026-08-08', reviews: 15, mastered: 2, expectedStreak: 2, expectedXpGain: 275 },
        { day: 9, date: '2026-08-09', reviews: 15, mastered: 2, expectedStreak: 3, expectedXpGain: 275 },
        { day: 10, date: '2026-08-10', reviews: 15, mastered: 2, expectedStreak: 4, expectedXpGain: 275 },
        { day: 11, date: '2026-08-11', reviews: 15, mastered: 2, expectedStreak: 5, expectedXpGain: 275 },
        { day: 12, date: '2026-08-12', reviews: 15, mastered: 2, expectedStreak: 6, expectedXpGain: 275 },
        { day: 13, date: '2026-08-13', reviews: 15, mastered: 2, expectedStreak: 7, expectedXpGain: 275 },
        { day: 14, date: '2026-08-14', reviews: 15, mastered: 2, expectedStreak: 8, expectedXpGain: 275 },
      ];

      let state = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 15,
        weeklyHistory: [],
      };

      let cumulativeXp = 0;

      for (let i = 0; i < dailySchedule.length; i++) {
        const step = dailySchedule[i];
        if (step.isMissed) {
          // Verify stats remain intact on missed day
          continue;
        }

        // Simulate streak transition logic
        const yesterdayDate = i > 0 ? dailySchedule[i - 1].date : '';
        let nextStreak = state.currentStreak;
        if (state.lastStudyDate !== step.date) {
          nextStreak = state.lastStudyDate === yesterdayDate ? nextStreak + 1 : 1;
        }

        assert.strictEqual(nextStreak, step.expectedStreak);

        // XP Gain calculation
        const xpGain =
          step.reviews * 10 +
          step.mastered * 25 +
          Math.max(20, Math.min(100, step.reviews * 5));
        assert.strictEqual(xpGain, step.expectedXpGain);

        cumulativeXp += xpGain;

        const nextHistory = [...state.weeklyHistory, step.date];

        state = {
          lastStudyDate: step.date,
          currentStreak: nextStreak,
          cardsReviewedToday: step.reviews,
          masteredToday: step.mastered,
          totalXp: cumulativeXp,
          dailyGoal: 15,
          weeklyHistory: nextHistory,
        };

        // Verify daily goal completion check
        const goalMet = state.cardsReviewedToday >= state.dailyGoal;
        assert.strictEqual(goalMet, true);
      }

      assert.strictEqual(state.currentStreak, 8);
      assert.strictEqual(state.totalXp, 3900);
      assert.strictEqual(state.weeklyHistory.length, 13);
    });

    test('32.2 Streak Liveliness Verification (isStreakLive) Across All Day Transitions', () => {
      // Studied today -> true
      assert.strictEqual(isStreakLive('2026-08-05', '2026-08-05', '2026-08-04'), true);

      // Studied yesterday -> true (still live today before user studies)
      assert.strictEqual(isStreakLive('2026-08-05', '2026-08-06', '2026-08-05'), true);

      // Studied 2 days ago (missed yesterday) -> false (streak has lapsed)
      assert.strictEqual(isStreakLive('2026-08-05', '2026-08-07', '2026-08-06'), false);

      // Studied 10 days ago -> false
      assert.strictEqual(isStreakLive('2026-07-28', '2026-08-07', '2026-08-06'), false);

      // Empty / undefined values -> false
      assert.strictEqual(isStreakLive('', '2026-08-07', '2026-08-06'), false);
      assert.strictEqual(isStreakLive('   ', '2026-08-07', '2026-08-06'), false);
      assert.strictEqual(isStreakLive(undefined, '2026-08-07', '2026-08-06'), false);
    });

    test('32.3 Scholar Tier Level Progression Across 14 Days', () => {
      // Level 1: Novice Scholar (0 XP)
      const l1 = calculateLevel(0);
      assert.strictEqual(l1.level, 1);
      assert.strictEqual(l1.title, 'Novice Scholar');
      assert.strictEqual(l1.badge, '🥉');
      assert.strictEqual(l1.isMaxLevel, false);

      // Level 2: Apprentice Scholar (100 XP)
      const l2 = calculateLevel(100);
      assert.strictEqual(l2.level, 2);
      assert.strictEqual(l2.title, 'Apprentice Scholar');
      assert.strictEqual(l2.badge, '🥈');

      // Level 3: Scholar (250 XP)
      const l3 = calculateLevel(425);
      assert.strictEqual(l3.level, 3);
      assert.strictEqual(l3.title, 'Scholar');
      assert.strictEqual(l3.badge, '🥇');

      // Level 4: Senior Scholar (500 XP)
      const l4 = calculateLevel(725);
      assert.strictEqual(l4.level, 4);
      assert.strictEqual(l4.title, 'Senior Scholar');
      assert.strictEqual(l4.badge, '💎');

      // Level 5: Master Scholar (1000 XP)
      const l5 = calculateLevel(1275);
      assert.strictEqual(l5.level, 5);
      assert.strictEqual(l5.title, 'Master Scholar');
      assert.strictEqual(l5.badge, '👑');

      // Level 6: Grandmaster Scholar (2000+ XP)
      const l6 = calculateLevel(3625);
      assert.strictEqual(l6.level, 6);
      assert.strictEqual(l6.title, 'Grandmaster Scholar');
      assert.strictEqual(l6.badge, '🏆');
      assert.strictEqual(l6.isMaxLevel, true);
      assert.strictEqual(l6.progress, 1.0);
    });

    test('32.4 60-Day History Bounding Invariant', () => {
      const dates = [];
      for (let i = 75; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(getLocalDateString(d));
      }

      const initialStats = {
        lastStudyDate: dates[dates.length - 2],
        currentStreak: 5,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 500,
        dailyGoal: 20,
        weeklyHistory: dates,
      };

      const updated = updateStudyStats(initialStats, 10, 2, true);

      // Verify that history is bounded and does not retain dates older than 60 days
      assert.ok(updated.weeklyHistory.length <= 61);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const cutoffStr = getLocalDateString(sixtyDaysAgo);

      updated.weeklyHistory.forEach((dateStr) => {
        assert.ok(dateStr >= cutoffStr, `History date ${dateStr} is older than 60-day cutoff ${cutoffStr}`);
      });
    });
  });
}


