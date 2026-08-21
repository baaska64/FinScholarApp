import { register } from 'node:module';
import assert from 'node:assert';

register('../../scripts/test-loader.js', import.meta.url);

const {
  DEFAULT_SR_SETTINGS,
  DECK_COLORS,
  DECK_ICONS,
  STATUS_CONFIG,
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
} = await import('../../components/study/utils.ts');

console.log('================================================================');
console.log('   INDEPENDENT VICTORY AUDITOR (SENTINEL 6) VERIFICATION SUITE  ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function check(title, fn) {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${title}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${title}: ${err.message}`);
  }
}

// 1. SM-2 Spaced Repetition Logic Deep Invariants
check('SM-2: Initial Card Creation & Defaults', () => {
  const card = makeNewCard('Front Term', 'Back Definition');
  assert.strictEqual(card.front, 'Front Term');
  assert.strictEqual(card.back, 'Back Definition');
  assert.strictEqual(card.interval, 0);
  assert.strictEqual(card.easeFactor, 2.5);
  assert.strictEqual(card.reviewCount, 0);
  assert.strictEqual(card.stepIndex, 0);
  assert.ok(card.id && typeof card.id === 'string');
});

check('SM-2: Multi-step learning transitions and graduation', () => {
  const card = makeNewCard('Q', 'A');
  const sr = { ...DEFAULT_SR_SETTINGS, learningSteps: '1 10 30', graduatingInterval: 2, easyInterval: 5 };
  
  // Step 0 -> Step 1 (Rating 3 Good)
  const step1 = applyRating(card, 3, sr);
  assert.strictEqual(step1.interval, 0);
  assert.strictEqual(step1.stepIndex, 1);
  assert.strictEqual(step1.reviewCount, 1);
  assert.strictEqual(step1.easeFactor, 2.5);

  // Step 1 -> Step 2 (Rating 3 Good)
  const step2 = applyRating(step1, 3, sr);
  assert.strictEqual(step2.interval, 0);
  assert.strictEqual(step2.stepIndex, 2);
  assert.strictEqual(step2.reviewCount, 2);

  // Step 2 -> Graduation (Rating 3 Good)
  const grad = applyRating(step2, 3, sr);
  assert.strictEqual(grad.interval, 2);
  assert.strictEqual(grad.reviewCount, 3);

  // Graduated -> Review (Rating 3 Good): Interval * EaseFactor (2 * 2.5 = 5)
  const rev1 = applyRating(grad, 3, sr);
  assert.strictEqual(rev1.interval, 5);
  assert.strictEqual(rev1.reviewCount, 4);

  // Relapse with Rating 1 (Again) -> Relapses to interval 0, stepIndex 0, easeFactor reduced by 0.2
  const relapsed = applyRating(rev1, 1, sr);
  assert.strictEqual(relapsed.interval, 0);
  assert.strictEqual(relapsed.stepIndex, 0);
  assert.strictEqual(relapsed.easeFactor, 2.3);
  assert.strictEqual(relapsed.reviewCount, 5);
});

check('SM-2: Ease factor boundary clamping [1.3, 4.0]', () => {
  let card = makeNewCard('Q', 'A');
  card.interval = 10;
  card.easeFactor = 1.35;
  card = applyRating(card, 1, DEFAULT_SR_SETTINGS);
  assert.strictEqual(card.easeFactor, 1.3);

  card.easeFactor = 3.98;
  card = applyRating(card, 4, DEFAULT_SR_SETTINGS);
  assert.strictEqual(card.easeFactor, 4.0);
});

check('SM-2: Corrupt / Non-finite values recovery', () => {
  const corrupt = {
    id: 'bad',
    front: 'Bad',
    back: 'Card',
    interval: NaN,
    easeFactor: -50,
    nextDue: 'invalid',
    reviewCount: undefined,
    stepIndex: 99999,
  };
  const fixed = applyRating(corrupt, 3, DEFAULT_SR_SETTINGS);
  assert.ok(Number.isFinite(fixed.interval));
  assert.ok(Number.isFinite(fixed.easeFactor));
  assert.ok(fixed.easeFactor >= 1.3 && fixed.easeFactor <= 4.0);
  assert.ok(Number.isFinite(fixed.nextDue));
  assert.ok(Number.isFinite(fixed.reviewCount));
  assert.strictEqual(fixed.reviewCount, 1);
});

// 2. Tree Hierarchy & Recursive Statistics
check('Tree: Multi-level hierarchy nesting, deduplication and fallback names', () => {
  const decks = [
    { id: 'd1', name: 'Mendelian Genetics', subject: 'Biology::Genetics', color: '#3b82f6', createdAt: 1, cards: [makeNewCard('a', 'b'), makeNewCard('c', 'd')] },
    { id: 'd2', name: 'Molecular Genetics', subject: 'Biology::Genetics', color: '#3b82f6', createdAt: 2, cards: [makeNewCard('e', 'f')] },
    { id: 'd3', name: 'Ecosystems', subject: 'Biology::Ecology', color: '#10b981', createdAt: 3, cards: [makeNewCard('g', 'h')] },
    { id: 'd4', name: '', subject: 'Physics::Mechanics', color: '#f97316', createdAt: 4, cards: [makeNewCard('i', 'j')] },
    { id: 'd5', name: '   ', subject: '', color: '#ec4899', createdAt: 5, cards: [] },
  ];

  const tree = buildDeckTree(decks);
  assert.strictEqual(tree.length, 3); // Biology, Physics, Untitled Deck

  const bioNode = tree.find((n) => n.name === 'Biology');
  assert.ok(bioNode);
  assert.strictEqual(bioNode.children.size, 2); // Ecology, Genetics

  const genetics = bioNode.children.get('Genetics');
  assert.ok(genetics);
  assert.strictEqual(genetics.children.size, 2); // Mendelian Genetics, Molecular Genetics

  const bioStats = getNodeStats(bioNode);
  assert.strictEqual(bioStats.total, 4);
  assert.strictEqual(bioStats.new, 4);

  const physicsNode = tree.find((n) => n.name === 'Physics');
  assert.ok(physicsNode);
  const mech = physicsNode.children.get('Mechanics');
  assert.ok(mech);
  assert.strictEqual(mech.deck?.id, 'd4');

  const untitled = tree.find((n) => n.name === 'Untitled Deck');
  assert.ok(untitled);
  assert.strictEqual(untitled.deck?.id, 'd5');
});

// 3. Gamification, Level Tiers & 60-day Bound
check('Gamification: 6 tiers mapping and progress', () => {
  assert.strictEqual(calculateLevel(0).title, 'Novice Scholar');
  assert.strictEqual(calculateLevel(99).title, 'Novice Scholar');
  assert.strictEqual(calculateLevel(100).title, 'Apprentice Scholar');
  assert.strictEqual(calculateLevel(250).title, 'Scholar');
  assert.strictEqual(calculateLevel(500).title, 'Senior Scholar');
  assert.strictEqual(calculateLevel(1000).title, 'Master Scholar');
  assert.strictEqual(calculateLevel(2000).title, 'Grandmaster Scholar');
  assert.strictEqual(calculateLevel(5000).isMaxLevel, true);
});

check('Gamification: Streak calculation, same day and missed days', () => {
  const today = getLocalDateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateString(yesterdayDate);

  const twoDaysAgoDate = new Date();
  twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2);
  const twoDaysAgo = getLocalDateString(twoDaysAgoDate);

  // Empty initial -> streak 1
  const s1 = updateStudyStats(null, 2, 1, false);
  assert.strictEqual(s1.currentStreak, 1);
  assert.strictEqual(s1.cardsReviewedToday, 2);
  assert.strictEqual(s1.masteredToday, 1);

  // Consecutive continuation from yesterday
  const prevYesterday = { lastStudyDate: yesterday, currentStreak: 5, masteredToday: 0, totalXp: 100 };
  const s2 = updateStudyStats(prevYesterday, 10, 2, true);
  assert.strictEqual(s2.currentStreak, 6);
  assert.strictEqual(s2.cardsReviewedToday, 10);
  assert.strictEqual(s2.masteredToday, 2);
  assert.strictEqual(s2.totalXp, 100 + (10 * 10) + (2 * 25) + 50); // 100 + 100 + 50 + 50 = 300

  // Break streak after 2 missed days
  const prevBroken = { lastStudyDate: twoDaysAgo, currentStreak: 10, masteredToday: 0, totalXp: 500 };
  const s3 = updateStudyStats(prevBroken, 1, 0, false);
  assert.strictEqual(s3.currentStreak, 1);
});

check('Gamification: 60-day historical history bounding', () => {
  const oldDate = '2020-01-01';
  const recentDate = getLocalDateString(new Date());
  const stats = {
    lastStudyDate: oldDate,
    currentStreak: 1,
    masteredToday: 0,
    weeklyHistory: [oldDate, '2021-05-10', recentDate],
  };
  const updated = updateStudyStats(stats, 1, 0, false);
  assert.ok(!updated.weeklyHistory.includes(oldDate));
  assert.ok(!updated.weeklyHistory.includes('2021-05-10'));
  assert.ok(updated.weeklyHistory.includes(recentDate));
});

// 4. Parser Verification (RFC-4180 quotes, semicolons, tabs, pipes, CRLF)
check('Parser: RFC-4180 escaped double quotes and mixed delimiters', () => {
  const csv = '"Column ""A"" with quotes","Column ""B"" with comma, and quotes"\r\n"Normal Q","Normal A"';
  const parsed = parseImport(csv, 'comma');
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].front, 'Column "A" with quotes');
  assert.strictEqual(parsed[0].back, 'Column "B" with comma, and quotes');
  assert.strictEqual(parsed[1].front, 'Normal Q');
  assert.strictEqual(parsed[1].back, 'Normal A');
});

check('Parser: Semicolon vs Comma auto precedence', () => {
  const semicolonWithComma = 'Front term; Back definition, with sub-clause\nSecond term; Second def';
  const parsed = parseImport(semicolonWithComma, 'auto');
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].front, 'Front term');
  assert.strictEqual(parsed[0].back, 'Back definition, with sub-clause');
});

// 5. Exam Prep Spacing Algorithm Monotonicity
check('Exam Prep: Strict monotonicity across intervals', () => {
  const { plan: cramPlan } = computeExamPlan(1, 40);
  assert.strictEqual(cramPlan.length, 4);

  const { plan: weekPlan } = computeExamPlan(7, 100);
  assert.strictEqual(weekPlan.length, 4);
  for (let i = 1; i < weekPlan.length; i++) {
    assert.ok(weekPlan[i].day > weekPlan[i - 1].day);
  }

  const { plan: monthPlan } = computeExamPlan(30, 200, 7);
  assert.strictEqual(monthPlan.length, 7);
  for (let i = 1; i < monthPlan.length; i++) {
    assert.ok(monthPlan[i].day > monthPlan[i - 1].day);
  }
});

// 6. Visual Colors & Theme Tokens
check('Colors: Hex parsing (3, 4, 6, 8 digit) and alpha clamping', () => {
  assert.strictEqual(getColorWithAlpha('#fff', 0.5), 'rgba(255, 255, 255, 0.5)');
  assert.strictEqual(getColorWithAlpha('#00ff', 0.8), 'rgba(0, 0, 255, 0.8)');
  assert.strictEqual(getColorWithAlpha('#4f46e5', 0.25), 'rgba(79, 70, 229, 0.25)');
  assert.strictEqual(getColorWithAlpha('#4f46e5ff', 0.5), 'rgba(79, 70, 229, 0.5)');
  assert.strictEqual(getColorWithAlpha('#4f46e5', 10.0), 'rgba(79, 70, 229, 1)');
  assert.strictEqual(getColorWithAlpha('#4f46e5', -5.0), 'rgba(79, 70, 229, 0)');
});

check('Next Due Text Formatters', () => {
  const now = Date.now();
  const makeNodeWithDue = (dueOffsetMs) => ({
    name: 'test',
    fullPath: 'test',
    deck: { cards: [{ id: '1', front: '', back: '', interval: 1, easeFactor: 2.5, nextDue: now + dueOffsetMs, reviewCount: 1 }] },
    children: new Map(),
  });

  assert.strictEqual(getNextDueText(makeNodeWithDue(30 * 1000)), '30s');
  assert.strictEqual(getNextDueText(makeNodeWithDue(15 * 60 * 1000)), '15m');
  assert.strictEqual(getNextDueText(makeNodeWithDue(4 * 3600 * 1000)), '4h');
  assert.strictEqual(getNextDueText(makeNodeWithDue(3 * 86400 * 1000)), '3d');
  assert.strictEqual(getNextDueText(null), '');
});

console.log('\n================================================================');
console.log(`   AUDIT VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED `);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
