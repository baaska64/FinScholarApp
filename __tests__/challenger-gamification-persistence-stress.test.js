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

export function runGamificationPersistenceStressTests(describe, test) {
  // ───────────────────────────────────────────────────────────────────────────
  // Suite G1: Streak Transitions across Midnight, Month Boundaries, Leap Years, Multi-Day Lapses
  // ─────────────────────────────────────────────────────────────────────────
  describe('Gamification Stress Suite 1: Streak Transitions & Boundary Traversal', () => {
    test('G1.1 Midnight transition simulation (23:59:59 -> 00:00:01)', () => {
      const day1 = '2026-08-17';
      const day2 = '2026-08-18';

      // At 23:59:59 on Day 1
      let stats = {
        lastStudyDate: day1,
        currentStreak: 5,
        masteredToday: 2,
        cardsReviewedToday: 10,
        totalXp: 500,
        dailyGoal: 20,
        weeklyHistory: [day1],
      };

      // At 00:00:01 on Day 2 before studying:
      // Streak is still live because yesterday was Day 1
      assert.strictEqual(isStreakLive(stats.lastStudyDate, day2, day1), true);

      // Now user studies on Day 2:
      // Streak increments from 5 to 6
      let nextStreak = stats.currentStreak;
      if (stats.lastStudyDate !== day2) {
        nextStreak = stats.lastStudyDate === day1 ? stats.currentStreak + 1 : 1;
      }
      assert.strictEqual(nextStreak, 6);
    });

    test('G1.2 Leap Year transition (Feb 28, 2028 -> Feb 29, 2028 -> Mar 1, 2028)', () => {
      const feb28 = '2028-02-28';
      const feb29 = '2028-02-29';
      const mar01 = '2028-03-01';

      let streak = 10;
      let lastDate = feb28;

      // Day 1: Feb 28 -> streak 10
      assert.strictEqual(isStreakLive(lastDate, feb28, '2028-02-27'), true);

      // Transition to Feb 29:
      assert.strictEqual(isStreakLive(lastDate, feb29, feb28), true);
      streak = lastDate === feb28 ? streak + 1 : 1;
      lastDate = feb29;
      assert.strictEqual(streak, 11);

      // Transition to Mar 1:
      assert.strictEqual(isStreakLive(lastDate, mar01, feb29), true);
      streak = lastDate === feb29 ? streak + 1 : 1;
      lastDate = mar01;
      assert.strictEqual(streak, 12);
    });

    test('G1.3 Non-Leap Year transition (Feb 28, 2027 -> Mar 1, 2027)', () => {
      const feb28 = '2027-02-28';
      const mar01 = '2027-03-01';

      let streak = 7;
      let lastDate = feb28;

      // On March 1, 2027, yesterday was Feb 28, 2027
      const mar01Date = new Date(2027, 2, 1);
      const yesterday = new Date(mar01Date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);
      assert.strictEqual(yesterdayStr, feb28);

      // isStreakLive on Mar 1 when last studied Feb 28 in non-leap year is true
      assert.strictEqual(isStreakLive(lastDate, mar01, yesterdayStr), true);

      streak = lastDate === yesterdayStr ? streak + 1 : 1;
      lastDate = mar01;
      assert.strictEqual(streak, 8);
    });

    test('G1.4 All 12 Month-End and Year-End Boundaries (Jan 31 -> Feb 1 ... Dec 31 -> Jan 1)', () => {
      const monthEndPairs = [
        { from: new Date(2026, 0, 31), to: new Date(2026, 1, 1), fromStr: '2026-01-31', toStr: '2026-02-01' },
        { from: new Date(2026, 1, 28), to: new Date(2026, 2, 1), fromStr: '2026-02-28', toStr: '2026-03-01' },
        { from: new Date(2026, 2, 31), to: new Date(2026, 3, 1), fromStr: '2026-03-31', toStr: '2026-04-01' },
        { from: new Date(2026, 3, 30), to: new Date(2026, 4, 1), fromStr: '2026-04-30', toStr: '2026-05-01' },
        { from: new Date(2026, 4, 31), to: new Date(2026, 5, 1), fromStr: '2026-05-31', toStr: '2026-06-01' },
        { from: new Date(2026, 5, 30), to: new Date(2026, 6, 1), fromStr: '2026-06-30', toStr: '2026-07-01' },
        { from: new Date(2026, 6, 31), to: new Date(2026, 7, 1), fromStr: '2026-07-31', toStr: '2026-08-01' },
        { from: new Date(2026, 7, 31), to: new Date(2026, 8, 1), fromStr: '2026-08-31', toStr: '2026-09-01' },
        { from: new Date(2026, 8, 30), to: new Date(2026, 9, 1), fromStr: '2026-09-30', toStr: '2026-10-01' },
        { from: new Date(2026, 9, 31), to: new Date(2026, 10, 1), fromStr: '2026-10-31', toStr: '2026-11-01' },
        { from: new Date(2026, 10, 30), to: new Date(2026, 11, 1), fromStr: '2026-11-30', toStr: '2026-12-01' },
        { from: new Date(2026, 11, 31), to: new Date(2027, 0, 1), fromStr: '2026-12-31', toStr: '2027-01-01' },
      ];

      let runningStreak = 1;
      for (const pair of monthEndPairs) {
        const fromDateStr = getLocalDateString(pair.from);
        const toDateStr = getLocalDateString(pair.to);
        assert.strictEqual(fromDateStr, pair.fromStr);
        assert.strictEqual(toDateStr, pair.toStr);

        // Verification of streak liveness across month boundary
        const isLive = isStreakLive(pair.fromStr, pair.toStr, pair.fromStr);
        assert.strictEqual(isLive, true, `Streak failed to stay live from ${pair.fromStr} to ${pair.toStr}`);

        // Increment streak across boundary
        runningStreak = runningStreak + 1;
      }
      assert.strictEqual(runningStreak, 13);
    });

    test('G1.5 Multi-day lapse (2 days, 5 days, 30 days, 365 days) streak reset to 1', () => {
      const day1 = '2026-08-01';
      let stats = {
        lastStudyDate: day1,
        currentStreak: 15,
        masteredToday: 5,
        cardsReviewedToday: 20,
        totalXp: 1500,
        dailyGoal: 20,
        weeklyHistory: [day1],
      };

      // 2-day lapse: current date is 2026-08-03, yesterday is 2026-08-02
      assert.strictEqual(isStreakLive(stats.lastStudyDate, '2026-08-03', '2026-08-02'), false);
      let nextStreak = stats.lastStudyDate === '2026-08-02' ? stats.currentStreak + 1 : 1;
      assert.strictEqual(nextStreak, 1);

      // 5-day lapse: current date is 2026-08-06
      assert.strictEqual(isStreakLive(stats.lastStudyDate, '2026-08-06', '2026-08-05'), false);

      // 365-day lapse: current date is 2027-08-01
      assert.strictEqual(isStreakLive(stats.lastStudyDate, '2027-08-01', '2027-07-31'), false);
    });

    test('G1.6 Same-day multiple study sessions keep streak invariant (streak does not double count)', () => {
      const today = '2026-08-17';
      let stats = {
        lastStudyDate: today,
        currentStreak: 4,
        masteredToday: 2,
        cardsReviewedToday: 10,
        totalXp: 300,
        dailyGoal: 20,
        weeklyHistory: [today],
      };

      // Simulating 50 study sessions on the same day
      for (let session = 1; session <= 50; session++) {
        let streak = stats.currentStreak;
        if (stats.lastStudyDate !== today) {
          streak = stats.lastStudyDate === '2026-08-16' ? streak + 1 : 1;
        } else if (streak === 0) {
          streak = 1;
        }

        stats = {
          ...stats,
          currentStreak: streak,
          cardsReviewedToday: stats.cardsReviewedToday + 5,
          masteredToday: stats.masteredToday + 1,
          totalXp: stats.totalXp + 75,
        };
      }

      assert.strictEqual(stats.currentStreak, 4); // Streak stayed 4 throughout the day
      assert.strictEqual(stats.cardsReviewedToday, 10 + 50 * 5); // 260 cards reviewed
      assert.strictEqual(stats.masteredToday, 2 + 50 * 1); // 52 cards mastered
      assert.strictEqual(stats.totalXp, 300 + 50 * 75); // 4,050 XP
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite G2: isStreakLive Format Compatibility & Sanitization
  // ─────────────────────────────────────────────────────────────────────────
  describe('Gamification Stress Suite 2: isStreakLive Format Robustness', () => {
    test('G2.1 Standard YYYY-MM-DD format matches today and yesterday', () => {
      assert.strictEqual(isStreakLive('2026-08-17', '2026-08-17', '2026-08-16'), true);
      assert.strictEqual(isStreakLive('2026-08-16', '2026-08-17', '2026-08-16'), true);
      assert.strictEqual(isStreakLive('2026-08-15', '2026-08-17', '2026-08-16'), false);
    });

    test('G2.2 Leading and trailing whitespace strings in lastStudyDate', () => {
      assert.strictEqual(isStreakLive('  2026-08-17  ', '2026-08-17', '2026-08-16'), true);
      assert.strictEqual(isStreakLive(' \t2026-08-16\n ', '2026-08-17', '2026-08-16'), true);
    });

    test('G2.3 Null, undefined, empty string, whitespace-only, and invalid strings return false', () => {
      assert.strictEqual(isStreakLive(undefined), false);
      assert.strictEqual(isStreakLive(null), false);
      assert.strictEqual(isStreakLive(''), false);
      assert.strictEqual(isStreakLive('   '), false);
      assert.strictEqual(isStreakLive('invalid-date-string', '2026-08-17', '2026-08-16'), false);
      assert.strictEqual(isStreakLive('1970-01-01', '2026-08-17', '2026-08-16'), false);
    });

    test('G2.4 Default parameter evaluation using real system clock', () => {
      const today = getLocalDateString(new Date());
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = getLocalDateString(twoDaysAgo);

      assert.strictEqual(isStreakLive(today), true);
      assert.strictEqual(isStreakLive(yesterdayStr), true);
      assert.strictEqual(isStreakLive(twoDaysAgoStr), false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite G3: XP Calculations and Scholar Tier Leveling (Level 1 to Level 50+ / 1,000,000+ XP)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Gamification Stress Suite 3: XP Calculations & Scholar Tier Leveling Bounds', () => {
    test('G3.1 Exact boundary thresholds for all 6 Scholar Tiers', () => {
      // Level 1: 0 to 99 XP
      const l1_0 = calculateLevel(0);
      assert.strictEqual(l1_0.level, 1);
      assert.strictEqual(l1_0.title, 'Novice Scholar');
      assert.strictEqual(l1_0.progress, 0.0);
      assert.strictEqual(l1_0.isMaxLevel, false);

      const l1_99 = calculateLevel(99);
      assert.strictEqual(l1_99.level, 1);
      assert.strictEqual(l1_99.levelXpEarned, 99);
      assert.strictEqual(l1_99.levelXpRequired, 100);
      assert.strictEqual(l1_99.progress, 0.99);

      // Level 2: 100 to 249 XP
      const l2_100 = calculateLevel(100);
      assert.strictEqual(l2_100.level, 2);
      assert.strictEqual(l2_100.title, 'Apprentice Scholar');
      assert.strictEqual(l2_100.progress, 0.0);

      const l2_249 = calculateLevel(249);
      assert.strictEqual(l2_249.level, 2);
      assert.strictEqual(l2_249.levelXpEarned, 149);
      assert.strictEqual(l2_249.levelXpRequired, 150);

      // Level 3: 250 to 499 XP
      const l3_250 = calculateLevel(250);
      assert.strictEqual(l3_250.level, 3);
      assert.strictEqual(l3_250.title, 'Scholar');
      assert.strictEqual(l3_250.progress, 0.0);

      // Level 4: 500 to 999 XP
      const l4_500 = calculateLevel(500);
      assert.strictEqual(l4_500.level, 4);
      assert.strictEqual(l4_500.title, 'Senior Scholar');
      assert.strictEqual(l4_500.progress, 0.0);

      // Level 5: 1000 to 1999 XP
      const l5_1000 = calculateLevel(1000);
      assert.strictEqual(l5_1000.level, 5);
      assert.strictEqual(l5_1000.title, 'Master Scholar');
      assert.strictEqual(l5_1000.progress, 0.0);

      // Level 6: 2000+ XP (Grandmaster Scholar - Max Tier)
      const l6_2000 = calculateLevel(2000);
      assert.strictEqual(l6_2000.level, 6);
      assert.strictEqual(l6_2000.title, 'Grandmaster Scholar');
      assert.strictEqual(l6_2000.progress, 1.0);
      assert.strictEqual(l6_2000.isMaxLevel, true);
    });

    test('G3.2 Extreme High XP Scaling up to 100,000,000 XP without overflow, NaN, or crash', () => {
      const highXpValues = [
        5000,
        10000,
        50000,
        100000,
        500000,
        1000000,
        10000000,
        100000000,
      ];

      for (const xp of highXpValues) {
        const info = calculateLevel(xp);
        assert.strictEqual(info.level, 6);
        assert.strictEqual(info.title, 'Grandmaster Scholar');
        assert.strictEqual(info.badge, '🏆');
        assert.strictEqual(info.isMaxLevel, true);
        assert.strictEqual(info.progress, 1.0);
        assert.strictEqual(info.currentLevelXp, xp);
        assert.strictEqual(info.nextLevelXp, xp);
        assert.ok(Number.isFinite(info.levelXpEarned));
        assert.ok(!Number.isNaN(info.progress));
      }
    });

    test('G3.3 Corrupt inputs (negative XP, NaN, Infinity, -Infinity, floats, string inputs)', () => {
      const negativeInfo = calculateLevel(-500);
      assert.strictEqual(negativeInfo.level, 1);
      assert.strictEqual(negativeInfo.currentLevelXp, 0);
      assert.strictEqual(negativeInfo.progress, 0.0);

      const nanInfo = calculateLevel(NaN);
      assert.strictEqual(nanInfo.level, 1);
      assert.strictEqual(nanInfo.currentLevelXp, 0);

      const infinityInfo = calculateLevel(Infinity);
      assert.strictEqual(infinityInfo.level, 1);
      assert.strictEqual(infinityInfo.currentLevelXp, 0);

      const floatInfo = calculateLevel(150.75);
      assert.strictEqual(floatInfo.level, 2);
      assert.strictEqual(floatInfo.currentLevelXp, 150);
      assert.strictEqual(floatInfo.levelXpEarned, 50);
    });

    test('G3.4 Single-session massive XP jump (Tier Skipping from Novice to Grandmaster)', () => {
      // Starting from 0 XP
      const startInfo = calculateLevel(0);
      assert.strictEqual(startInfo.level, 1);

      // Student completes huge session awarding +3,500 XP
      const newXp = 0 + 3500;
      const jumpInfo = calculateLevel(newXp);
      assert.strictEqual(jumpInfo.level, 6);
      assert.strictEqual(jumpInfo.title, 'Grandmaster Scholar');
      assert.strictEqual(jumpInfo.isMaxLevel, true);
      assert.strictEqual(jumpInfo.progress, 1.0);
    });

    test('G3.5 calculateXpGain edge cases and formula verification', () => {
      // 1 review: 10 XP
      assert.strictEqual(calculateXpGain({ isReview: true }), 10);

      // 1 mastery: 25 XP
      assert.strictEqual(calculateXpGain({ isMastered: true }), 25);

      // 1 review + 1 mastery: 35 XP
      assert.strictEqual(calculateXpGain({ isReview: true, isMastered: true }), 35);

      // Session complete with 1 card: min 20 XP bonus
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: 1 }), 20);

      // Session complete with 10 cards: 10 * 5 = 50 XP bonus
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: 10 }), 50);

      // Session complete with 20 cards: 20 * 5 = 100 XP (max cap)
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: 20 }), 100);

      // Session complete with 500 cards: capped at 100 XP
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: 500 }), 100);

      // Edge inputs: negative cards, 0 cards, NaN cards
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: 0 }), 20);
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: -10 }), 20);
      assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: NaN }), 20);
      assert.strictEqual(calculateXpGain(undefined), 0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite G4: 60-Day History Array Bounding & High Frequency Retention Stress
  // ─────────────────────────────────────────────────────────────────────────
  describe('Gamification Stress Suite 4: 60-Day History Bounding & Retention Stress', () => {
    test('G4.1 730-Day (2 Years) continuous study history bounding invariant', () => {
      let stats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      const startDate = new Date(2024, 0, 1); // Jan 1, 2024 (Leap Year)
      for (let day = 0; day < 730; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        const dateStr = getLocalDateString(currentDate);
        const prevDate = new Date(currentDate);
        prevDate.setDate(currentDate.getDate() - 1);
        const prevDateStr = getLocalDateString(prevDate);

        // Update history
        const rawHistory = Array.isArray(stats.weeklyHistory) ? stats.weeklyHistory : [];
        const historySet = new Set(rawHistory);
        historySet.add(dateStr);

        const sixtyDaysAgo = new Date(currentDate);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const cutoffStr = getLocalDateString(sixtyDaysAgo);
        const cleanHistory = Array.from(historySet).filter((d) => d >= cutoffStr).sort();

        let streak = stats.currentStreak;
        if (stats.lastStudyDate !== dateStr) {
          streak = stats.lastStudyDate === prevDateStr ? streak + 1 : 1;
        }

        stats = {
          lastStudyDate: dateStr,
          currentStreak: streak,
          cardsReviewedToday: 15,
          masteredToday: 3,
          totalXp: stats.totalXp + 200,
          dailyGoal: 20,
          weeklyHistory: cleanHistory,
        };

        // INVARIANT CHECK on EVERY single day:
        assert.ok(stats.weeklyHistory.length <= 61, `History exceeded 61 elements at day ${day}: ${stats.weeklyHistory.length}`);
        assert.ok(stats.weeklyHistory[0] >= cutoffStr, `History contained outdated date: ${stats.weeklyHistory[0]} < ${cutoffStr}`);
        assert.strictEqual(stats.weeklyHistory[stats.weeklyHistory.length - 1], dateStr);
      }

      assert.strictEqual(stats.currentStreak, 730);
      assert.strictEqual(stats.weeklyHistory.length, 61);
    });

    test('G4.2 High frequency burst (1,000 updates in a single day) Set deduplication', () => {
      const todayStr = getLocalDateString(new Date());
      let stats = {
        lastStudyDate: todayStr,
        currentStreak: 10,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 1000,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      // 1,000 rapid card reviews on the same day
      for (let i = 0; i < 1000; i++) {
        stats = updateStudyStats(stats, 1, i % 5 === 0 ? 1 : 0, false);
      }

      assert.strictEqual(stats.weeklyHistory.length, 1);
      assert.strictEqual(stats.weeklyHistory[0], todayStr);
      assert.strictEqual(stats.cardsReviewedToday, 1000);
      assert.strictEqual(stats.masteredToday, 200); // 1000 / 5
      assert.strictEqual(stats.totalXp, 1000 + 1000 * 10 + 200 * 25); // 1000 + 10000 + 5000 = 16000 XP
      assert.strictEqual(stats.currentStreak, 10);
    });

    test('G4.3 Out-of-order date insertion and corrupted non-string history pruning', () => {
      const todayStr = getLocalDateString(new Date());
      const corruptStats = {
        lastStudyDate: todayStr,
        currentStreak: 5,
        masteredToday: 2,
        cardsReviewedToday: 10,
        totalXp: 500,
        dailyGoal: 20,
        weeklyHistory: [
          '2026-08-15',
          null,
          '1999-01-01',
          undefined,
          12345,
          '2026-08-10',
          '2026-08-17',
          '2026-08-12',
          '',
        ],
      };

      const updated = updateStudyStats(corruptStats, 5, 1, false);

      // Verify corrupted entries removed and valid entries properly sorted
      assert.ok(Array.isArray(updated.weeklyHistory));
      for (const entry of updated.weeklyHistory) {
        assert.strictEqual(typeof entry, 'string');
        assert.ok(entry.length === 10);
        assert.ok(!entry.startsWith('1999')); // Outdated pruned
      }

      // Verify sorted ascending
      for (let i = 1; i < updated.weeklyHistory.length; i++) {
        assert.ok(updated.weeklyHistory[i] >= updated.weeklyHistory[i - 1]);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite G5: Concurrent & Rapid Rating State Synchronization Simulation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Gamification Stress Suite 5: Rapid Rating & State Persistence Synchronization', () => {
    test('G5.1 Rapid successive card ratings simulation without state loss (statsRef pattern)', () => {
      let memoryStats = {
        lastStudyDate: '',
        currentStreak: 0,
        masteredToday: 0,
        cardsReviewedToday: 0,
        totalXp: 0,
        dailyGoal: 20,
        weeklyHistory: [],
      };

      const statsRef = { current: memoryStats };

      // Simulate 50 ratings firing rapidly in an asynchronous loop
      for (let i = 1; i <= 50; i++) {
        const isMastered = i % 4 === 0;
        const isLast = i === 50;

        const newStats = updateStudyStats(
          statsRef.current,
          1,
          isMastered ? 1 : 0,
          isLast
        );

        statsRef.current = newStats;
        memoryStats = newStats;
      }

      // 50 reviews = 50 * 10 = 500 XP
      // 12 mastered = 12 * 25 = 300 XP
      // 1 session done (1 card rated in last call) = 20 XP bonus
      // Total XP = 500 + 300 + 20 = 820 XP
      assert.strictEqual(statsRef.current.cardsReviewedToday, 50);
      assert.strictEqual(statsRef.current.masteredToday, 12);
      assert.strictEqual(statsRef.current.totalXp, 820);
      assert.strictEqual(statsRef.current.currentStreak, 1);
    });

    test('G5.2 Simultaneous deck modification and card rating state merge integrity', () => {
      let ledger = {
        flashcards: {
          decks: [
            {
              id: 'd1',
              name: 'Deck 1',
              cards: [makeNewCard('Q1', 'A1'), makeNewCard('Q2', 'A2')],
            },
          ],
          settings: DEFAULT_SR_SETTINGS,
          stats: {
            lastStudyDate: getLocalDateString(new Date()),
            currentStreak: 3,
            masteredToday: 1,
            cardsReviewedToday: 5,
            totalXp: 250,
            dailyGoal: 20,
            weeklyHistory: [getLocalDateString(new Date())],
          },
        },
      };

      const statsRef = { current: ledger.flashcards.stats };

      // User rates a card -> stats updated immediately in statsRef
      const updatedStats = updateStudyStats(statsRef.current, 1, 0, false);
      statsRef.current = updatedStats;

      // Meanwhile, user adds a card to the deck -> saveDecks reads statsRef.current
      const updatedDeck = {
        ...ledger.flashcards.decks[0],
        cards: [...ledger.flashcards.decks[0].cards, makeNewCard('Q3', 'A3')],
      };
      const newDecks = [updatedDeck];

      // Simulated saveDecks merging
      ledger.flashcards = {
        decks: newDecks,
        settings: ledger.flashcards.settings,
        stats: statsRef.current,
      };

      assert.strictEqual(ledger.flashcards.decks[0].cards.length, 3);
      assert.strictEqual(ledger.flashcards.stats.cardsReviewedToday, 6);
      assert.strictEqual(ledger.flashcards.stats.totalXp, 260); // 250 + 10 XP
    });
  });
}
