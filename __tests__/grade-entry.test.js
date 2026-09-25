import assert from 'node:assert';
import {
  weightSummary,
  effectiveWeight,
  formatWeight,
  formatGrade,
  getItemAt,
  updateItemAt,
  removeItemAt,
  addItem,
  addPeriod,
  updatePeriod,
  removePeriod,
  addComponent,
  updateComponent,
  removeComponent,
  suggestItemName,
  scorePercent,
  scoreProblem,
  weightProblem,
  countScores,
  subjectOutlook,
  MAX_ITEM_DEPTH,
  locateItem,
  readUngradedMode,
  ungradedShort,
} from '../utils/gradeEntry.ts';
import { Calculator } from '../utils/calculator.js';

const subjectWith = (items, extra = {}) => ({
  id: 's1',
  name: 'MATH101',
  units: 3,
  passingPercent: 60,
  ...extra,
  periods: [{ id: 'p1', name: 'Prelim', weight: '', components: [{ id: 'c1', name: 'Quizzes', weight: '', items }] }],
});

export function runGradeEntryTests(describe, test) {
  describe('Grade Entry Suite 1: Weights', () => {
    test('GE1.1 Blank weights split the remainder evenly, matching Calculator', () => {
      const s = weightSummary([40, '', '']);
      assert.strictEqual(s.explicit, 40);
      assert.strictEqual(s.blank, 2);
      assert.strictEqual(s.auto, 30);
      assert.strictEqual(s.warning, null);
      assert.strictEqual(effectiveWeight('', s), 30);
      assert.strictEqual(effectiveWeight('40', s), 40);
    });

    test('GE1.2 Typed weights that miss 100 warn; over 100 says so', () => {
      assert.match(weightSummary([30, 30]).warning, /60%, not 100%/);
      assert.match(weightSummary([80, 40]).warning, /over 100%/);
      assert.strictEqual(weightSummary([50, 50]).warning, null);
    });

    test('GE1.3 A blank sibling with nothing left to take is flagged', () => {
      assert.match(weightSummary([100, '']).warning, /Nothing is left/);
    });

    test('GE1.4 A zero weight is flagged, an empty list is not', () => {
      assert.match(weightSummary([0, 100]).warning, /0%/);
      assert.strictEqual(weightSummary([]).warning, null);
    });

    test('GE1.5 formatWeight drops a trailing .0 and keeps one decimal', () => {
      assert.strictEqual(formatWeight(25), '25');
      assert.strictEqual(formatWeight(100 / 3), '33.3');
    });
  });

  describe('Grade Entry Suite 2: Walking and editing the tree', () => {
    test('GE2.1 getItemAt reaches items and nested parts', () => {
      const sub = subjectWith([{ id: 'i1', score: 8, max: 10 }, { id: 'i2', subItems: [{ id: 'a' }, { id: 'b' }] }]);
      assert.strictEqual(getItemAt(sub, { period: 0, component: 0, items: [0] }).id, 'i1');
      assert.strictEqual(getItemAt(sub, { period: 0, component: 0, items: [1, 1] }).id, 'b');
      assert.strictEqual(getItemAt(sub, { period: 0, component: 0, items: [5] }), null);
      assert.strictEqual(getItemAt(sub, { period: 3, component: 0, items: [0] }), null);
    });

    test('GE2.2 updateItemAt returns a new subject and leaves the input untouched', () => {
      const sub = subjectWith([{ id: 'i1', score: 8, max: 10 }]);
      const next = updateItemAt(sub, { period: 0, component: 0, items: [0] }, { score: '9', name: 'Quiz 1' });
      assert.notStrictEqual(next, sub);
      assert.strictEqual(sub.periods[0].components[0].items[0].score, 8);
      assert.strictEqual(next.periods[0].components[0].items[0].score, '9');
      assert.strictEqual(next.periods[0].components[0].items[0].name, 'Quiz 1');
    });

    test('GE2.3 addItem appends to the component and reports where it landed', () => {
      const sub = subjectWith([{ id: 'i1', score: 8, max: 10 }]);
      const out = addItem(sub, 0, 0, { name: 'Quiz 2', score: '15', max: '20' });
      assert.deepStrictEqual(out.path, { period: 0, component: 0, items: [1] });
      const added = getItemAt(out.subject, out.path);
      assert.strictEqual(added.name, 'Quiz 2');
      assert.strictEqual(added.max, '20');
      assert.ok(added.id);
      assert.strictEqual(sub.periods[0].components[0].items.length, 1);
    });

    test('GE2.4 addItem under a parent turns it into a part and expands the parent', () => {
      const sub = subjectWith([{ id: 'i1', score: 8, max: 10, isCollapsed: true }]);
      const out = addItem(sub, 0, 0, { name: 'Part A' }, [0]);
      assert.deepStrictEqual(out.path.items, [0, 0]);
      const parent = getItemAt(out.subject, { period: 0, component: 0, items: [0] });
      assert.strictEqual(parent.subItems.length, 1);
      assert.strictEqual(parent.isCollapsed, false);
    });

    test('GE2.5 addItem refuses to nest deeper than the editor allows', () => {
      let sub = subjectWith([{ id: 'i1' }]);
      let parent = [0];
      for (let d = 0; d < MAX_ITEM_DEPTH; d++) {
        const out = addItem(sub, 0, 0, {}, parent);
        assert.ok(out, `depth ${d + 1} should be allowed`);
        sub = out.subject;
        parent = out.path.items;
      }
      assert.strictEqual(addItem(sub, 0, 0, {}, parent), null);
    });

    test('GE2.6 removeItemAt deletes only the addressed node', () => {
      const sub = subjectWith([{ id: 'i1' }, { id: 'i2', subItems: [{ id: 'a' }, { id: 'b' }] }]);
      const next = removeItemAt(sub, { period: 0, component: 0, items: [1, 0] });
      assert.deepStrictEqual(next.periods[0].components[0].items[1].subItems.map((x) => x.id), ['b']);
      assert.strictEqual(next.periods[0].components[0].items.length, 2);
    });

    test('GE2.7 Period and component CRUD are pure and index-addressed', () => {
      let sub = subjectWith([]);
      const p = addPeriod(sub, { name: 'Midterm', weight: '40' });
      assert.strictEqual(p.index, 1);
      sub = updatePeriod(p.subject, 1, { name: 'Midterms' });
      assert.strictEqual(sub.periods[1].name, 'Midterms');
      sub = addComponent(sub, 1, { name: 'Exams', weight: '60' });
      sub = updateComponent(sub, 1, 0, { weight: '70' });
      assert.strictEqual(sub.periods[1].components[0].weight, '70');
      sub = removeComponent(sub, 1, 0);
      assert.strictEqual(sub.periods[1].components.length, 0);
      sub = removePeriod(sub, 0);
      assert.deepStrictEqual(sub.periods.map((x) => x.name), ['Midterms']);
    });

    test('GE2.8 Edits through the helpers compute the same grade as a hand-built subject', () => {
      let sub = subjectWith([]);
      sub = addItem(sub, 0, 0, { score: '18', max: '20' }).subject;
      sub = addItem(sub, 0, 0, { score: '7', max: '10' }).subject;
      assert.strictEqual(Calculator.calculateSubject(sub, 'PERCENT').percent, 80);
    });
  });

  describe('Grade Entry Suite 3: Scores and names', () => {
    test('GE3.1 scorePercent needs a score and a positive max', () => {
      assert.strictEqual(scorePercent('18', '20'), 90);
      assert.strictEqual(scorePercent('', '20'), null);
      assert.strictEqual(scorePercent('5', '0'), null);
      assert.strictEqual(scorePercent('x', '10'), null);
    });

    test('GE3.2 scoreProblem blocks bad input but only warns above the max', () => {
      assert.strictEqual(scoreProblem('', '20'), null);
      assert.strictEqual(scoreProblem('20', '20'), null);
      assert.deepStrictEqual(scoreProblem('21', '20'), { message: 'Above the maximum. Fine for extra credit.', blocking: false });
      assert.strictEqual(scoreProblem('-1', '20').blocking, true);
      assert.strictEqual(scoreProblem('x', '20').blocking, true);
      assert.strictEqual(scoreProblem('5', '0').blocking, true);
      assert.strictEqual(scoreProblem('', '').blocking, true, 'a blank max is never valid');
    });

    test('GE3.2b weightProblem allows blank and 0-100 only', () => {
      assert.strictEqual(weightProblem(''), null);
      assert.strictEqual(weightProblem('40'), null);
      assert.match(weightProblem('140'), /between 0 and 100/);
      assert.match(weightProblem('abc'), /number/);
    });

    test('GE3.3 countScores counts leaves through parts', () => {
      assert.deepStrictEqual(countScores({ score: 5 }), { filled: 1, total: 1 });
      assert.deepStrictEqual(countScores({ subItems: [{ score: 1 }, { score: '' }, { subItems: [{ score: 2 }] }] }), { filled: 2, total: 3 });
    });

    test('GE3.4 suggestItemName singularises common component names', () => {
      assert.strictEqual(suggestItemName('Quizzes', 2), 'Quiz 3');
      assert.strictEqual(suggestItemName('Exams', 0), 'Exam 1');
      assert.strictEqual(suggestItemName('Activities', 0), 'Activity 1');
      assert.strictEqual(suggestItemName('Classes', 0), 'Class 1');
      assert.strictEqual(suggestItemName('Recitation', 1), 'Recitation 2');
      assert.strictEqual(suggestItemName('New Component', 0), 'Item 1');
      assert.strictEqual(suggestItemName('', 4), 'Item 5');
    });

    test('GE3.5 formatGrade uses the student system', () => {
      assert.strictEqual(formatGrade(80, 60, 'PERCENT'), '80.0%');
      assert.strictEqual(formatGrade(100, 60, '1_IS_BEST'), '1.00');
      assert.strictEqual(formatGrade(60, 60, '1_IS_BEST'), '3.00');
    });
  });

  describe('Grade Entry Suite 3b: Locating a score', () => {
    test('GE3.6 locateItem returns the path, names and the parts trail', () => {
      const sub = subjectWith([{ id: 'i1', name: 'Quiz 1' }, { id: 'i2', name: 'Lab', subItems: [{ id: 'a', name: '' }, { id: 'b', name: 'Demo' }] }]);
      const top = locateItem(sub, 'i1');
      assert.deepStrictEqual(top.path, { period: 0, component: 0, items: [0] });
      assert.strictEqual(top.componentName, 'Quizzes');
      assert.strictEqual(top.periodName, 'Prelim');
      const part = locateItem(sub, 'a');
      assert.deepStrictEqual(part.path.items, [1, 0]);
      assert.strictEqual(part.name, 'Part 1', 'an unnamed part falls back to its position');
      assert.deepStrictEqual(part.parents, ['Lab']);
      assert.strictEqual(locateItem(sub, 'nope'), null);
    });

    test('GE3.7 Every ungraded score in the outlook can be located', () => {
      const sub = subjectWith([{ id: 'i1', score: 10, max: 20 }, { id: 'i2', name: 'Lab', subItems: [{ id: 'a', score: '', max: 50 }, { id: 'b', score: 30, max: 50 }] }], { targetValue: 70 });
      const o = subjectOutlook(sub, 'PERCENT');
      assert.ok(o.remaining.length > 0);
      for (const r of o.remaining) assert.ok(locateItem(sub, r.id), `could not locate ${r.id}`);
    });
  });

  describe('Grade Entry Suite 4: Outlook', () => {
    test('GE4.1 A met target reads as reached', () => {
      const o = subjectOutlook(subjectWith([{ id: 'i1', score: 90, max: 100 }], { targetValue: 75 }), 'PERCENT');
      assert.strictEqual(o.kind, 'reached');
      assert.strictEqual(o.requiredAverage, null);
    });

    test('GE4.2 On course gives the average needed on what is left', () => {
      // Two equal items: 60/100 earned on the first, the second blank.
      // 30 points earned, 50 still open; 75 needs 45 of 50 = 90%.
      const o = subjectOutlook(subjectWith([{ id: 'i1', score: 60, max: 100 }, { id: 'i2', score: '', max: 50 }], { targetValue: 75 }), 'PERCENT');
      assert.strictEqual(o.kind, 'on-course');
      assert.strictEqual(o.requiredFor, 'target');
      assert.ok(Math.abs(o.requiredAverage - 90) < 1e-9);
      assert.strictEqual(o.remaining.length, 1);
      assert.ok(Math.abs(o.remaining[0].needed - 45) < 1e-9, 'needed is scaled to the item max');
    });

    test('GE4.3 Out-of-reach target falls back to what passing needs', () => {
      // 10 of 50 earned, 50 left: 95 is impossible, 60 needs 50 of 50 = 100%.
      const o = subjectOutlook(subjectWith([{ id: 'i1', score: 20, max: 100 }, { id: 'i2', score: '', max: 100 }], { targetValue: 95 }), 'PERCENT');
      assert.strictEqual(o.kind, 'pass-only');
      assert.strictEqual(o.requiredFor, 'pass');
      assert.ok(Math.abs(o.requiredAverage - 100) < 1e-9);
    });

    test('GE4.4 Passed already, target gone', () => {
      // 63.3 earned (passed), 33.3 open, 99 needs 35.7: out of reach.
      const o = subjectOutlook(subjectWith([{ id: 'i1', score: 100, max: 100 }, { id: 'i2', score: 90, max: 100 }, { id: 'i3', score: '', max: 100 }], { targetValue: 99 }), 'PERCENT');
      assert.strictEqual(o.kind, 'passed-only');
    });

    test('GE4.5 Passing impossible reads as lost', () => {
      const o = subjectOutlook(subjectWith([{ id: 'i1', score: 0, max: 100 }, { id: 'i2', score: 0, max: 100 }, { id: 'i3', score: '', max: 100 }]), 'PERCENT');
      assert.strictEqual(o.kind, 'lost');
    });

    test('GE4.6 Every score in and short of target reads as no-room', () => {
      const o = subjectOutlook(subjectWith([{ id: 'i1', score: 70, max: 100 }], { targetValue: 90 }), 'PERCENT');
      assert.strictEqual(o.kind, 'no-room');
      assert.match(o.message, /You passed/);
    });

    test('GE4.7 With no target set, the passing mark is the target', () => {
      const o = subjectOutlook(subjectWith([{ id: 'i1', score: '', max: 100 }], { passingPercent: 75 }), 'PERCENT');
      assert.strictEqual(o.target, 75);
      assert.strictEqual(o.kind, 'on-course');
      assert.ok(Math.abs(o.requiredAverage - 75) < 1e-9);
    });
  });

  describe('Grade Entry Suite 5: Scores not entered yet', () => {
    // Two equal items: 60/100 graded, one blank. 30 banked, 50 open, pace 60%.
    const sub = () => subjectWith([{ id: 'i1', score: 60, max: 100 }, { id: 'i2', score: '', max: 100 }]);

    test('GE5.1 Each mode picks floor, ceiling or graded average', () => {
      const z = Calculator.calculateSubject(sub(), 'PERCENT');
      const p = Calculator.calculateSubject(sub(), 'PERCENT', null, 'perfect');
      const g = Calculator.calculateSubject(sub(), 'PERCENT', null, 'ignore');
      assert.strictEqual(z.percent, 30, 'zero is the default and matches the old behaviour');
      assert.strictEqual(p.percent, 80);
      assert.strictEqual(g.percent, 60);
    });

    test('GE5.2 Floor, ceiling, pace and projection come back in every mode', () => {
      for (const mode of ['zero', 'perfect', 'ignore']) {
        const r = Calculator.calculateSubject(sub(), 'PERCENT', null, mode);
        assert.strictEqual(r.floor, 30);
        assert.strictEqual(r.ceiling, 80);
        assert.strictEqual(r.pace, 60);
        assert.strictEqual(r.projected, 60, '30 banked + 50 open at a 60% pace');
      }
    });

    test('GE5.3 Projection sits between floor and ceiling', () => {
      const r = Calculator.calculateSubject(subjectWith([{ id: 'a', score: 9, max: 10 }, { id: 'b', score: '', max: 10 }, { id: 'c', score: '', max: 10 }]), 'PERCENT');
      assert.ok(r.floor <= r.projected && r.projected <= r.ceiling);
    });

    test('GE5.4 With nothing graded there is no pace, and graded-only reads 0 without data', () => {
      const r = Calculator.calculateSubject(subjectWith([{ id: 'a', score: '', max: 10 }]), 'PERCENT', null, 'ignore');
      assert.strictEqual(r.pace, null);
      assert.strictEqual(r.projected, null);
      assert.strictEqual(r.percent, 0);
      assert.strictEqual(r.hasData, false);
    });

    test('GE5.5 Outside zero mode, a subject with no scores stays out of the semester', () => {
      const sem = { subjects: [
        { ...sub(), id: 'x', units: 3 },
        { ...subjectWith([{ id: 'n', score: '', max: 100 }]), id: 'y', units: 3 },
      ] };
      assert.strictEqual(Calculator.calculateSemester(sem, 'PERCENT').percent, 15, 'zero: the empty subject drags it to (30+0)/2');
      assert.strictEqual(Calculator.calculateSemester(sem, 'PERCENT', 'perfect').percent, 80, 'perfect: the empty subject is not a free 100');
      assert.strictEqual(Calculator.calculateSemester(sem, 'PERCENT', 'ignore').percent, 60);
      const years = [{ semesters: [sem] }];
      assert.strictEqual(Calculator.calculateYear(years[0], 'PERCENT', 'perfect').percent, 80);
      assert.strictEqual(Calculator.calculateCumulative(years, 'PERCENT', 'ignore').percent, 60);
    });

    test('GE5.6 The saved mode falls back to zero for old or unknown values', () => {
      assert.strictEqual(readUngradedMode(undefined), 'zero');
      assert.strictEqual(readUngradedMode({ ungradedScores: 'perfect' }), 'perfect');
      assert.strictEqual(readUngradedMode({ ungradedScores: 'bogus' }), 'zero');
      assert.strictEqual(ungradedShort('perfect'), 'if you ace the rest');
    });
  });
}
