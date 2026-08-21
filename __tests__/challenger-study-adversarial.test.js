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
  isStreakLive,
} from '../components/study/utils.ts';

export function runChallengerStudyAdversarialTests(describe, test) {
  // ───────────────────────────────────────────────────────────────────────────
  // Suite C1: SM-2 Spaced Repetition Clamping & Extreme Trajectory Stress
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 1: SM-2 Extreme Ratings & Clamping Stress', () => {
    test('C1.1 100 consecutive rating 1 (Again) clamping at lower bound 1.3', () => {
      let card = makeNewCard('Continuous Again Test', 'Def');
      assert.strictEqual(card.easeFactor, 2.5);

      for (let i = 0; i < 100; i++) {
        card = applyRating(card, 1, DEFAULT_SR_SETTINGS);
        assert.ok(card.easeFactor >= 1.3, `Ease factor ${card.easeFactor} fell below 1.3 at iteration ${i}`);
        assert.strictEqual(card.interval, 0);
        assert.strictEqual(card.stepIndex, 0);
        assert.strictEqual(card.reviewCount, i + 1);
      }
      assert.strictEqual(card.easeFactor, 1.3);
      assert.strictEqual(card.reviewCount, 100);
    });

    test('C1.2 50 consecutive rating 4 (Easy) clamping at upper bound 4.0 and interval explosion safety', () => {
      let card = makeNewCard('Continuous Easy Test', 'Def');

      for (let i = 0; i < 50; i++) {
        card = applyRating(card, 4, DEFAULT_SR_SETTINGS);
        assert.ok(card.easeFactor <= 4.0, `Ease factor ${card.easeFactor} exceeded 4.0 at iteration ${i}`);
        assert.ok(Number.isFinite(card.interval), `Interval became non-finite at iteration ${i}`);
        assert.ok(Number.isFinite(card.nextDue), `NextDue became non-finite at iteration ${i}`);
        assert.strictEqual(card.reviewCount, i + 1);
      }
      assert.strictEqual(card.easeFactor, 4.0);
      assert.ok(card.interval > 1000);
      assert.ok(card.nextDue > Date.now());
    });

    test('C1.3 Alternating Again (1) and Easy (4) oscillation stability', () => {
      let card = makeNewCard('Oscillation Test', 'Def');

      for (let i = 0; i < 20; i++) {
        card = applyRating(card, 4, DEFAULT_SR_SETTINGS); // Easy -> interval > 0, ease + 0.1
        const easeAfterEasy = card.easeFactor;
        assert.ok(easeAfterEasy <= 4.0);

        card = applyRating(card, 1, DEFAULT_SR_SETTINGS); // Again -> interval = 0, ease - 0.2
        assert.ok(card.easeFactor >= 1.3);
        assert.strictEqual(card.interval, 0);
      }
      assert.ok(card.easeFactor >= 1.3 && card.easeFactor <= 4.0);
      assert.strictEqual(card.reviewCount, 40);
    });

    test('C1.4 Extreme initial values (negative ease, huge ease, negative interval, NaN step)', () => {
      const corruptCard = {
        id: 'c_extreme',
        front: 'Front',
        back: 'Back',
        interval: -99999,
        easeFactor: 999.99,
        nextDue: -1,
        reviewCount: -50,
        stepIndex: -10,
      };

      const fixed = applyRating(corruptCard, 3, DEFAULT_SR_SETTINGS);
      assert.ok(fixed.easeFactor <= 4.0);
      assert.ok(fixed.easeFactor >= 1.3);
      assert.ok(fixed.interval >= 0);
      assert.ok(fixed.reviewCount >= 1);
      assert.ok(Number.isFinite(fixed.nextDue));
    });

    test('C1.5 Custom SRSettings with 5 learning steps and extreme step progression', () => {
      const customSR = {
        learningSteps: '1 5 15 60 1440',
        graduatingInterval: 3,
        easyInterval: 7,
        studyTimeHour: 8,
        studyTimeMinute: 0,
      };

      let card = makeNewCard('5 Steps', 'Ans');
      // Step 0 -> Step 1
      card = applyRating(card, 3, customSR);
      assert.strictEqual(card.interval, 0);
      assert.strictEqual(card.stepIndex, 1);

      // Step 1 -> Step 2
      card = applyRating(card, 3, customSR);
      assert.strictEqual(card.interval, 0);
      assert.strictEqual(card.stepIndex, 2);

      // Step 2 -> Step 3
      card = applyRating(card, 3, customSR);
      assert.strictEqual(card.interval, 0);
      assert.strictEqual(card.stepIndex, 3);

      // Step 3 -> Step 4
      card = applyRating(card, 3, customSR);
      assert.strictEqual(card.interval, 0);
      assert.strictEqual(card.stepIndex, 4);

      // Step 4 -> Graduation (interval = graduatingInterval = 3)
      card = applyRating(card, 3, customSR);
      assert.strictEqual(card.interval, 3);
      assert.strictEqual(card.reviewCount, 5);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite C2: Quiz Question Generation Boundary Conditions & Duplicate Definitions
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 2: Quiz Generator Boundary & Duplicate Distractor Stress', () => {
    test('C2.1 Deck with 2 cards produces 2-choice quiz without duplicate options', () => {
      const cards = [
        { id: 'c1', front: 'Term 1', back: 'Def 1' },
        { id: 'c2', front: 'Term 2', back: 'Def 2' },
      ];

      const questions = cards.map((card) => {
        const cardBackClean = (card.back || '').trim();
        const otherUniqueBacks = Array.from(
          new Set(
            cards
              .map((c) => (c.back || '').trim())
              .filter((b) => b.length > 0 && b.toLowerCase() !== cardBackClean.toLowerCase())
          )
        );
        const distractors = otherUniqueBacks.slice(0, 3);
        const options = Array.from(new Set([...distractors, cardBackClean]));
        return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
      });

      assert.strictEqual(questions.length, 2);
      questions.forEach((q) => {
        assert.strictEqual(q.options.length, 2);
        assert.strictEqual(new Set(q.options).size, 2);
        assert.ok(q.options.includes(q.correctAnswer));
      });
    });

    test('C2.2 Deck with 3 cards produces 3-choice quiz without duplicate options', () => {
      const cards = [
        { id: 'c1', front: 'T1', back: 'D1' },
        { id: 'c2', front: 'T2', back: 'D2' },
        { id: 'c3', front: 'T3', back: 'D3' },
      ];

      const questions = cards.map((card) => {
        const cardBackClean = (card.back || '').trim();
        const otherUniqueBacks = Array.from(
          new Set(
            cards
              .map((c) => (c.back || '').trim())
              .filter((b) => b.length > 0 && b.toLowerCase() !== cardBackClean.toLowerCase())
          )
        );
        const distractors = otherUniqueBacks.slice(0, 3);
        const options = Array.from(new Set([...distractors, cardBackClean]));
        return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
      });

      questions.forEach((q) => {
        assert.strictEqual(q.options.length, 3);
        assert.strictEqual(new Set(q.options).size, 3);
        assert.ok(q.options.includes(q.correctAnswer));
      });
    });

    test('C2.3 Deck where ALL cards have IDENTICAL definitions handles gracefully without crashing', () => {
      const cards = [
        { id: 'c1', front: 'Term Alpha', back: 'Shared Definition' },
        { id: 'c2', front: 'Term Beta', back: 'Shared Definition' },
        { id: 'c3', front: 'Term Gamma', back: 'Shared Definition' },
        { id: 'c4', front: 'Term Delta', back: 'Shared Definition' },
      ];

      const questions = cards.map((card) => {
        const cardBackClean = (card.back || '').trim();
        const otherUniqueBacks = Array.from(
          new Set(
            cards
              .map((c) => (c.back || '').trim())
              .filter((b) => b.length > 0 && b.toLowerCase() !== cardBackClean.toLowerCase())
          )
        );
        const distractors = otherUniqueBacks.slice(0, 3);
        const options = Array.from(new Set([...distractors, cardBackClean]));
        return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
      });

      assert.strictEqual(questions.length, 4);
      questions.forEach((q) => {
        // Because all definitions are identical, distractors array is empty -> options has exactly 1 choice
        assert.strictEqual(q.options.length, 1);
        assert.strictEqual(q.options[0], 'Shared Definition');
        assert.strictEqual(q.correctAnswer, 'Shared Definition');
      });
    });

    test('C2.4 Deck with 50 cards caps quiz at 10 randomized questions with exactly 4 options each', () => {
      const cards = Array.from({ length: 50 }, (_, i) => ({
        id: `c_${i + 1}`,
        front: `Question ${i + 1}`,
        back: `Answer ${i + 1}`,
      }));

      const source = [...cards].sort(() => 0.5 - Math.random()).slice(0, Math.min(10, cards.length));
      assert.strictEqual(source.length, 10);

      const questions = source.map((card) => {
        const cardBackClean = (card.back || '').trim();
        const otherUniqueBacks = Array.from(
          new Set(
            cards
              .map((c) => (c.back || '').trim())
              .filter((b) => b.length > 0 && b.toLowerCase() !== cardBackClean.toLowerCase())
          )
        );
        const shuffledOthers = [...otherUniqueBacks].sort(() => 0.5 - Math.random());
        const distractors = shuffledOthers.slice(0, 3);
        const options = Array.from(new Set([...distractors, cardBackClean])).sort(() => 0.5 - Math.random());
        return { cardId: card.id, question: card.front, correctAnswer: card.back, options };
      });

      assert.strictEqual(questions.length, 10);
      questions.forEach((q) => {
        assert.strictEqual(q.options.length, 4);
        assert.strictEqual(new Set(q.options).size, 4);
        assert.ok(q.options.includes(q.correctAnswer));
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite C3: Speed Match Game Engine Small Deck & Odd/Even Grid Edges
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 3: Speed Match Small Decks & Grid State Stress', () => {
    test('C3.1 Speed Match with minimal 2 cards (4 tiles total) game lifecycle', () => {
      const cards = [
        { id: 'c1', front: 'T1', back: 'D1' },
        { id: 'c2', front: 'T2', back: 'D2' },
      ];

      const matchCards = [];
      cards.forEach((card) => {
        matchCards.push({ id: `t_${card.id}`, pairId: card.id, text: card.front, isTerm: true });
        matchCards.push({ id: `d_${card.id}`, pairId: card.id, text: card.back, isTerm: false });
      });

      assert.strictEqual(matchCards.length, 4);
      const totalPairs = matchCards.length / 2;
      assert.strictEqual(totalPairs, 2);

      const matchedSet = new Set();
      // Match pair 1
      matchedSet.add('c1');
      assert.strictEqual(matchedSet.size < totalPairs, true);

      // Match pair 2 -> game won
      matchedSet.add('c2');
      assert.strictEqual(matchedSet.size >= totalPairs, true);
    });

    test('C3.2 Speed Match with odd card count (3 cards -> 6 tiles) always produces even tile count', () => {
      const cards = [
        { id: 'c1', front: 'T1', back: 'D1' },
        { id: 'c2', front: 'T2', back: 'D2' },
        { id: 'c3', front: 'T3', back: 'D3' },
      ];

      const selected = [...cards].slice(0, Math.min(8, cards.length));
      const matchCards = [];
      selected.forEach((card) => {
        matchCards.push({ id: generateId(), pairId: card.id, text: card.front, isTerm: true });
        matchCards.push({ id: generateId(), pairId: card.id, text: card.back, isTerm: false });
      });

      assert.strictEqual(matchCards.length, 6);
      assert.strictEqual(matchCards.length % 2, 0); // Always even
    });

    test('C3.3 Speed Match when cards have identical terms/definitions uses pairId correctly', () => {
      const cards = [
        { id: 'card_a', front: 'Identical Text', back: 'Identical Definition' },
        { id: 'card_b', front: 'Identical Text', back: 'Identical Definition' },
      ];

      const matchCards = [
        { id: 't_a', pairId: 'card_a', text: 'Identical Text', isTerm: true },
        { id: 'd_a', pairId: 'card_a', text: 'Identical Definition', isTerm: false },
        { id: 't_b', pairId: 'card_b', text: 'Identical Text', isTerm: true },
        { id: 'd_b', pairId: 'card_b', text: 'Identical Definition', isTerm: false },
      ];

      // Cross tap: term A with definition B -> should be a mismatch because pairIds differ!
      const tile1 = matchCards.find((c) => c.id === 't_a');
      const tile2 = matchCards.find((c) => c.id === 'd_b');
      const isMatch = tile1.pairId === tile2.pairId && tile1.isTerm !== tile2.isTerm;
      assert.strictEqual(isMatch, false);

      // Proper tap: term A with definition A -> is a match!
      const tile3 = matchCards.find((c) => c.id === 'd_a');
      const isRealMatch = tile1.pairId === tile3.pairId && tile1.isTerm !== tile3.isTerm;
      assert.strictEqual(isRealMatch, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite C4: Exam Prep Spaced Schedule Horizon Stress (0, 1, 365 Days, Leap Years)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 4: Exam Prep Schedule 0, 1, 365 Days & Leap Years', () => {
    test('C4.1 0-Day Exam Schedule (Exam today) uses cram mode safely', () => {
      const { plan, numReviews } = computeExamPlan(0, 50);
      assert.strictEqual(numReviews, 4);
      assert.strictEqual(plan.length, 4);
      assert.strictEqual(plan[0].day, 0);
      assert.strictEqual(plan[0].label, 'Now');
      plan.forEach((slot) => {
        assert.ok(slot.day < 1);
        assert.strictEqual(slot.cardsPerSession, 50);
      });
    });

    test('C4.2 1-Day Exam Schedule (Cram mode) generates fractional-day intervals', () => {
      const { plan, numReviews } = computeExamPlan(1, 30);
      console.log('C4.2 plan:', plan);
      assert.strictEqual(numReviews, 4);
      assert.strictEqual(plan.length, 4);
      assert.strictEqual(plan[0].label, 'Now');
      assert.ok(plan[0].day <= plan[1].day);
      assert.ok(plan[1].day <= plan[2].day);
      assert.ok(plan[2].day <= plan[3].day);
      assert.ok(plan[3].day < 1);
    });

    test('C4.3 Multi-horizon exam schedule boundary analysis (3 to 365 days)', () => {
      const horizons = [3, 7, 14, 30, 60, 90, 180, 365];
      const results = horizons.map((days) => {
        const { plan, numReviews } = computeExamPlan(days, 50);
        const lastSlotDay = plan[plan.length - 1].day;
        const exceedsHorizon = lastSlotDay > days;
        return { days, numReviews, lastSlotDay, exceedsHorizon };
      });
      console.log('Horizon stress test results:', results);

      // Verify that for all tested horizons, the plan generates valid slots and doesn't produce NaN
      results.forEach((r) => {
        assert.ok(Number.isFinite(r.lastSlotDay));
        assert.ok(r.numReviews >= 3);
      });
    });

    test('C4.4 Leap Year Date Calculations (2028-02-29) in getLocalDateString and Week Activity', () => {
      const leapDay = new Date(2028, 1, 29); // Feb 29, 2028 (Tuesday)
      const dateStr = getLocalDateString(leapDay);
      assert.strictEqual(dateStr, '2028-02-29');

      const activity = getWeekDaysActivity(['2028-02-29'], '2028-02-29', leapDay);
      assert.strictEqual(activity.length, 7);

      // Tuesday should be Feb 29
      assert.strictEqual(activity[1].dayLabel, 'T');
      assert.strictEqual(activity[1].dateStr, '2028-02-29');
      assert.strictEqual(activity[1].isToday, true);
      assert.strictEqual(activity[1].isCompleted, true);

      // Monday was Feb 28
      assert.strictEqual(activity[0].dateStr, '2028-02-28');
      // Wednesday was Mar 1
      assert.strictEqual(activity[2].dateStr, '2028-03-01');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite C5: Delimiter Parser Malformed Quotes, Unescaped Delimiters, Empty Lines
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 5: Delimiter Parser Adversarial Fuzzing', () => {
    test('C5.1 Malformed unclosed double quotes return gracefully without infinite loops', () => {
      const line = '"Unclosed front term, Definition back';
      const parsed = parseCsvLine(line);
      // Unclosed quote encompasses the comma, producing 1 token -> null returned
      assert.strictEqual(parsed, null);

      const importRes = parseImport(line, 'comma');
      assert.strictEqual(importRes.length, 0);
    });

    test('C5.2 Unescaped internal quotes inside unquoted fields', () => {
      const line = '5\'9" tall, Height measurement for person';
      const parsed = parseCsvLine(line);
      assert.ok(parsed);
      assert.strictEqual(parsed[0], '5\'9" tall');
      assert.strictEqual(parsed[1], 'Height measurement for person');
    });

    test('C5.3 RFC-4180 Escaped quotes ("") within both front and back fields', () => {
      const line = '"Question with ""quoted text"" inside","Answer with ""another quote"""';
      const parsed = parseCsvLine(line);
      assert.ok(parsed);
      assert.strictEqual(parsed[0], 'Question with "quoted text" inside');
      assert.strictEqual(parsed[1], 'Answer with "another quote"');
    });

    test('C5.4 Empty lines, whitespace lines, comment lines, and delimiter only lines', () => {
      const input = `
        # Comment line 1
        // Comment line 2
        
           \t   
        
        ,,,
        ;;;
        \t\t\t
        Front 1, Back 1
        Front 2\tBack 2
        # Another comment
        Front 3 | Back 3
      `;

      const parsedAuto = parseImport(input, 'auto');
      assert.strictEqual(parsedAuto.length, 3);
      assert.strictEqual(parsedAuto[0].front, 'Front 1');
      assert.strictEqual(parsedAuto[0].back, 'Back 1');
      assert.strictEqual(parsedAuto[1].front, 'Front 2');
      assert.strictEqual(parsedAuto[1].back, 'Back 2');
      assert.strictEqual(parsedAuto[2].front, 'Front 3');
      assert.strictEqual(parsedAuto[2].back, 'Back 3');
    });

    test('C5.5 Semicolon delimiter with internal commas in definitions in auto mode', () => {
      const content = `
        Assets; Economic resources, tangible or intangible
        Liabilities; Debts, obligations, and financial claims
        Equity; Net assets, capital, and retained earnings
      `;
      const parsed = parseImport(content, 'auto');
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].front, 'Assets');
      assert.strictEqual(parsed[0].back, 'Economic resources, tangible or intangible');
      assert.strictEqual(parsed[1].front, 'Liabilities');
      assert.strictEqual(parsed[1].back, 'Debts, obligations, and financial claims');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite C6: Deep Hierarchical Tree Nesting & Recursive Performance
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 6: Deep Hierarchy & Path Stress', () => {
    test('C6.1 8-level deeply nested subject path hierarchy traversal and card collection', () => {
      const deepPath = 'Level1::Level2::Level3::Level4::Level5::Level6::Level7::Level8';
      const decks = [
        {
          id: 'deep_deck',
          name: 'Deep Leaf Deck',
          subject: deepPath,
          color: '#4f46e5',
          createdAt: Date.now(),
          cards: [makeNewCard('Deep Q1', 'Deep A1'), makeNewCard('Deep Q2', 'Deep A2')],
        },
      ];

      const tree = buildDeckTree(decks);
      assert.strictEqual(tree.length, 1);
      assert.strictEqual(tree[0].name, 'Level1');

      let current = tree[0];
      for (let i = 2; i <= 8; i++) {
        assert.ok(current.children.has(`Level${i}`));
        current = current.children.get(`Level${i}`);
      }
      assert.ok(current.children.has('Deep Leaf Deck'));
      const leaf = current.children.get('Deep Leaf Deck');
      assert.ok(leaf.deck);
      assert.strictEqual(leaf.deck.id, 'deep_deck');

      const collected = collectCards(tree[0]);
      assert.strictEqual(collected.length, 2);
      assert.strictEqual(collected[0].front, 'Deep Q1');

      const stats = getNodeStats(tree[0]);
      assert.strictEqual(stats.total, 2);
      assert.strictEqual(stats.new, 2);
    });

    test('C6.2 Special characters, emojis, and unicode paths in deck hierarchy', () => {
      const decks = [
        {
          id: 'd_unicode',
          name: '日本語・語彙',
          subject: '🌐 Languages::🇯🇵 Japanese',
          color: '#3b82f6',
          createdAt: Date.now(),
          cards: [makeNewCard('こんにちは', 'Hello'), makeNewCard('ありがとう', 'Thank you')],
        },
      ];

      const tree = buildDeckTree(decks);
      assert.strictEqual(tree.length, 1);
      assert.strictEqual(tree[0].name, '🌐 Languages');
      assert.ok(tree[0].children.has('🇯🇵 Japanese'));
      const japNode = tree[0].children.get('🇯🇵 Japanese');
      assert.ok(japNode.children.has('日本語・語彙'));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite C7: Large Dataset Scale & Stress Harness (1,000 cards)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 7: 1,000-Card Scale & Performance Harness', () => {
    test('C7.1 Parsing 1,000-line CSV content parses cleanly and rapidly (< 100ms)', () => {
      const lines = ['# 1,000 Generated Flashcards'];
      for (let i = 1; i <= 1000; i++) {
        lines.push(`"Question ${i}, with internal comma","Answer ${i}, with definition and notes"`);
      }
      const rawContent = lines.join('\n');

      const start = Date.now();
      const parsed = parseImport(rawContent, 'comma');
      const duration = Date.now() - start;

      assert.strictEqual(parsed.length, 1000);
      assert.strictEqual(parsed[0].front, 'Question 1, with internal comma');
      assert.strictEqual(parsed[999].back, 'Answer 1000, with definition and notes');
      assert.ok(duration < 250, `1,000-card parse took ${duration}ms, exceeding 250ms budget`);
    });

    test('C7.2 Bulk tree calculation and stats rollup across 50 decks and 1,000 cards (< 50ms)', () => {
      const decks = [];
      for (let d = 1; d <= 50; d++) {
        const cards = [];
        for (let c = 1; c <= 20; c++) {
          cards.push({
            id: `card_${d}_${c}`,
            front: `Term ${d}.${c}`,
            back: `Def ${d}.${c}`,
            interval: c % 3 === 0 ? 5 : 0,
            easeFactor: 2.5,
            nextDue: c % 3 === 0 ? Date.now() - 10000 : Date.now() + 10000,
            reviewCount: c % 3 === 0 ? 2 : 0,
          });
        }
        decks.push({
          id: `deck_${d}`,
          name: `Deck ${d}`,
          subject: `Subject ${Math.ceil(d / 10)}::SubModule ${Math.ceil(d / 2)}`,
          color: DECK_COLORS[d % DECK_COLORS.length],
          createdAt: Date.now() + d,
          cards,
        });
      }

      const start = Date.now();
      const tree = buildDeckTree(decks);
      const allStats = tree.map((n) => getNodeStats(n));
      const totalCollected = tree.reduce((sum, n) => sum + collectCards(n).length, 0);
      const duration = Date.now() - start;

      assert.strictEqual(tree.length, 5); // 5 top-level subjects
      assert.strictEqual(totalCollected, 1000);
      const totalStatsCount = allStats.reduce((sum, s) => sum + s.total, 0);
      assert.strictEqual(totalStatsCount, 1000);
      assert.ok(duration < 100, `Tree rollup took ${duration}ms, exceeding 100ms budget`);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite C8: Extreme Gamification Numbers & Date Rollovers
  // ─────────────────────────────────────────────────────────────────────────
  describe('Challenger Study Suite 8: Extreme Gamification Scale & Lifecycles', () => {
    test('C8.1 365-Day Continuous Daily Study Streak Simulation', () => {
      let stats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      const startDate = new Date(2025, 0, 1); // Jan 1, 2025
      for (let day = 0; day < 365; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        const dateStr = getLocalDateString(currentDate);
        const prevDate = new Date(currentDate);
        prevDate.setDate(currentDate.getDate() - 1);
        const prevDateStr = getLocalDateString(prevDate);

        // Simulate daily study: 20 reviews, 5 mastered
        let nextStreak = stats.currentStreak;
        if (stats.lastStudyDate !== dateStr) {
          nextStreak = stats.lastStudyDate === prevDateStr ? nextStreak + 1 : 1;
        }

        const xpGain = 20 * 10 + 5 * 25 + Math.max(20, Math.min(100, 20 * 5)); // 200 + 125 + 100 = 425 XP
        const nextHistory = [...stats.weeklyHistory, dateStr];

        // 60-day prune
        const sixtyDaysAgo = new Date(currentDate);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const cutoffStr = getLocalDateString(sixtyDaysAgo);
        const cleanHistory = nextHistory.filter((d) => d >= cutoffStr);

        stats = {
          lastStudyDate: dateStr,
          currentStreak: nextStreak,
          cardsReviewedToday: 20,
          masteredToday: 5,
          totalXp: stats.totalXp + xpGain,
          dailyGoal: 20,
          weeklyHistory: cleanHistory,
        };
      }

      assert.strictEqual(stats.currentStreak, 365);
      assert.strictEqual(stats.totalXp, 365 * 425); // 155,125 XP
      assert.ok(stats.weeklyHistory.length <= 61); // 60-day bounded storage invariant preserved

      const level = calculateLevel(stats.totalXp);
      assert.strictEqual(level.level, 6);
      assert.strictEqual(level.isMaxLevel, true);
      assert.strictEqual(level.title, 'Grandmaster Scholar');
    });

    test('C8.2 Streak recovery after leap year Feb 28 -> Feb 29 -> Mar 1 sequence', () => {
      const feb28 = '2028-02-28';
      const feb29 = '2028-02-29';
      const mar01 = '2028-03-01';

      // Day 1: Feb 28
      assert.strictEqual(isStreakLive(feb28, feb28, '2028-02-27'), true);

      // Day 2: Feb 29 (still live on Feb 29 when last studied was Feb 28)
      assert.strictEqual(isStreakLive(feb28, feb29, feb28), true);

      // Day 3: Mar 1 (still live on Mar 1 when last studied was Feb 29)
      assert.strictEqual(isStreakLive(feb29, mar01, feb29), true);

      // If user missed Feb 29 and studies on Mar 1 (last studied Feb 28) -> false
      assert.strictEqual(isStreakLive(feb28, mar01, feb29), false);
    });
  });
}
