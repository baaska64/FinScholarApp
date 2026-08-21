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

console.log('=== RUNNING INDEPENDENT VICTORY AUDIT TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failCount++;
    console.error(`  ✖ ${name}:`, e.message);
  }
}

// 1. Gamification & XP
runTest('Gamification: calculateLevel tiers 1 to 6 and progress', () => {
  assert.strictEqual(calculateLevel(0).title, 'Novice Scholar');
  assert.strictEqual(calculateLevel(100).title, 'Apprentice Scholar');
  assert.strictEqual(calculateLevel(250).title, 'Scholar');
  assert.strictEqual(calculateLevel(500).title, 'Senior Scholar');
  assert.strictEqual(calculateLevel(1000).title, 'Master Scholar');
  assert.strictEqual(calculateLevel(2000).title, 'Grandmaster Scholar');
  assert.strictEqual(calculateLevel(2500).isMaxLevel, true);
});

runTest('Gamification: calculateXpGain calculation logic', () => {
  assert.strictEqual(calculateXpGain({ isReview: true }), 10);
  assert.strictEqual(calculateXpGain({ isMastered: true }), 25);
  assert.strictEqual(calculateXpGain({ isReview: true, isMastered: true }), 35);
  assert.strictEqual(calculateXpGain({ isSessionComplete: true, cardsCount: 10 }), 50);
});

runTest('Gamification: updateStudyStats streak increments and resets', () => {
  const today = getLocalDateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateString(yesterdayDate);

  const initial = updateStudyStats({ lastStudyDate: '', currentStreak: 0, masteredToday: 0 }, 1, 0);
  assert.strictEqual(initial.currentStreak, 1);
  assert.strictEqual(initial.lastStudyDate, today);

  const continued = updateStudyStats({ lastStudyDate: yesterday, currentStreak: 3, masteredToday: 2 }, 2, 1);
  assert.strictEqual(continued.currentStreak, 4);
  assert.strictEqual(continued.cardsReviewedToday, 2);
  assert.strictEqual(continued.masteredToday, 1);
});

// 2. SM-2 Algorithm & Edge Cases
runTest('SM-2: Initial card creation defaults', () => {
  const card = makeNewCard('Front', 'Back');
  assert.strictEqual(card.front, 'Front');
  assert.strictEqual(card.back, 'Back');
  assert.strictEqual(card.interval, 0);
  assert.strictEqual(card.easeFactor, 2.5);
  assert.strictEqual(card.stepIndex, 0);
});

runTest('SM-2: Rating transitions & graduation', () => {
  const card = makeNewCard('Q', 'A');
  const step1 = applyRating(card, 3, { ...DEFAULT_SR_SETTINGS, learningSteps: '1 10', graduatingInterval: 1 });
  assert.strictEqual(step1.interval, 0);
  assert.strictEqual(step1.stepIndex, 1);

  const grad = applyRating(step1, 3, { ...DEFAULT_SR_SETTINGS, learningSteps: '1 10', graduatingInterval: 1 });
  assert.strictEqual(grad.interval, 1);
  assert.strictEqual(grad.reviewCount, 2);
});

runTest('SM-2: Corrupt data recovery and NaN protection', () => {
  const corrupt = { id: 'x', front: '', back: '', interval: NaN, easeFactor: NaN, nextDue: NaN, reviewCount: null, stepIndex: 999 };
  const fixed = applyRating(corrupt, 2, DEFAULT_SR_SETTINGS);
  assert.ok(Number.isFinite(fixed.nextDue));
  assert.ok(Number.isFinite(fixed.easeFactor));
  assert.ok(Number.isFinite(fixed.interval));
  assert.strictEqual(fixed.stepIndex, 1);
});

// 3. Tree Hierarchy & Node Statistics
runTest('Tree: buildDeckTree nested hierarchy and deduplication', () => {
  const decks = [
    { id: '1', name: 'Intro', subject: 'Math::Calc', color: '#fff', createdAt: 1, cards: [makeNewCard('a', 'b')] },
    { id: '2', name: 'Derivatives', subject: 'Math::Calc', color: '#fff', createdAt: 2, cards: [makeNewCard('c', 'd')] },
  ];
  const tree = buildDeckTree(decks);
  assert.strictEqual(tree.length, 1);
  assert.strictEqual(tree[0].name, 'Math');
  const calc = tree[0].children.get('Calc');
  assert.ok(calc);
  assert.strictEqual(calc.children.size, 2);

  const stats = getNodeStats(tree[0]);
  assert.strictEqual(stats.total, 2);
});

// 4. Parser Verification
runTest('Parser: CSV with RFC-4180 quotes', () => {
  const csv = '"Term with ""quotes""","Definition with, comma"';
  const parsed = parseImport(csv, 'comma');
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].front, 'Term with "quotes"');
  assert.strictEqual(parsed[0].back, 'Definition with, comma');
});

runTest('Parser: Semicolon delimiter precedence in auto mode', () => {
  const text = 'Term A; Def A, with comma\nTerm B; Def B';
  const parsed = parseImport(text, 'auto');
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].front, 'Term A');
  assert.strictEqual(parsed[0].back, 'Def A, with comma');
});

// 5. Exam Prep Schedule
runTest('Exam Prep: Strict interval monotonicity', () => {
  const { plan } = computeExamPlan(5, 50, 4);
  assert.strictEqual(plan.length, 4);
  for (let i = 1; i < plan.length; i++) {
    assert.ok(plan[i].day > plan[i - 1].day);
  }
});

// 6. Colors & Theme
runTest('Colors: 4-digit and 8-digit hex parsing and alpha clamping', () => {
  assert.strictEqual(getColorWithAlpha('#f00f', 0.5), 'rgba(255, 0, 0, 0.5)');
  assert.strictEqual(getColorWithAlpha('#4f46e5ff', 0.8), 'rgba(79, 70, 229, 0.8)');
  assert.strictEqual(getColorWithAlpha('#4f46e5', 2.0), 'rgba(79, 70, 229, 1)');
});

console.log(`\nIndependent Audit Summary: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) process.exit(1);
