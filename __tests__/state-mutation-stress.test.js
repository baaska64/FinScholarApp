import assert from 'node:assert';
import { Calculator } from '../utils/calculator.js';
import {
  ensureSubjectExists,
  toggleGradeTracking,
  getSubjectsWithDefaults,
  getUnscheduledSubjects,
  getTrackedSubjects,
  refreshHasSchedule,
} from '../utils/subjectRegistry.ts';
import { Colors, getTheme, Typography, Radius, Shadows, Spacing } from '../constants/Theme.ts';

function deepCloneSubject(sub) {
  const generateId = () => Math.random().toString(36).substr(2, 9);
  const cloned = JSON.parse(JSON.stringify(sub));
  cloned.id = generateId();
  (cloned.periods || []).forEach((p) => {
    p.id = generateId();
    (p.components || []).forEach((c) => {
      c.id = generateId();
      (c.items || []).forEach((item) => {
        item.id = generateId();
        (item.subItems || []).forEach((si) => {
          si.id = generateId();
        });
      });
    });
  });
  return cloned;
}

export function runStateMutationStressTests(describe, test) {
  describe('Grade Ledger Suite 6: State Mutation Edge Cases & Theme Parity Stress Tests', () => {

    test('6.1 0 subjects and empty semester/year/cumulative bounds', () => {
      const systems = ['1_IS_BEST', '5_IS_BEST', '4_IS_BEST', 'PERCENT'];

      systems.forEach((sys) => {
        // Empty semester
        const emptySemRes = Calculator.calculateSemester({ id: 'sem_empty', subjects: [] }, sys);
        assert.strictEqual(emptySemRes.percent, 0, `Expected 0% for empty sem in ${sys}`);
        assert.strictEqual(emptySemRes.equivalent, 0, `Expected 0 eq for empty sem in ${sys}`);

        // Semester with subjects having 0 units
        const zeroUnitsSemRes = Calculator.calculateSemester({
          id: 'sem_zero',
          subjects: [{ id: 's1', units: 0, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 100, max: 100 }] }] }] }]
        }, sys);
        assert.strictEqual(zeroUnitsSemRes.percent, 0, `Expected 0% for zero units sem in ${sys}`);
        assert.strictEqual(zeroUnitsSemRes.equivalent, 0, `Expected 0 eq for zero units sem in ${sys}`);

        // Empty year
        const emptyYearRes = Calculator.calculateYear({ id: 'yr_empty', semesters: [] }, sys);
        assert.strictEqual(emptyYearRes.percent, 0);
        assert.strictEqual(emptyYearRes.equivalent, 0);

        // Empty cumulative
        const emptyCumRes = Calculator.calculateCumulative([], sys);
        assert.strictEqual(emptyCumRes.percent, 0);
        assert.strictEqual(emptyCumRes.equivalent, 0);
      });
    });

    test('6.2 Blank grades and missing scores handling across complex nested trees', () => {
      const subjectWithBlanks = {
        id: 'sub_blanks',
        name: 'Organic Chemistry',
        units: 4,
        passingPercent: 60,
        periods: [
          {
            id: 'p1',
            weight: '', // blank weight -> auto 50%
            components: [
              {
                id: 'c1',
                weight: null, // blank weight -> auto 50%
                items: [
                  { id: 'i1', score: '', max: 100 }, // blank score
                  { id: 'i2', score: null, max: 100 }, // null score
                  { id: 'i3', score: undefined, max: 100 }, // undefined score
                  { id: 'i4', score: 90, max: 100 } // valid score
                ]
              },
              {
                id: 'c2',
                weight: undefined, // blank weight -> auto 50%
                items: [
                  {
                    id: 'i5',
                    name: 'Project',
                    subItems: [
                      { id: 'si1', score: '', max: 50, weight: '' }, // blank subitem
                      { id: 'si2', score: 40, max: 50, weight: '' } // 80% subitem score
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: 'p2',
            weight: 50,
            components: [] // empty component list
          }
        ]
      };

      const res = Calculator.calculateSubject(subjectWithBlanks, '1_IS_BEST');
      assert.strictEqual(res.hasData, true, 'Should detect valid inputs in i4 and si2');
      assert(!isNaN(res.percent), 'Subject percentage must not be NaN');
      assert(!isNaN(res.equivalent), 'Subject equivalent grade must not be NaN');
      assert(res.emptyComponents.length > 0, 'Should identify empty components/items');
    });

    test('6.3 Tracking toggle mutations and all-untracked state resilience', () => {
      let mockState = {
        years: [
          {
            id: 'y1',
            semesters: [
              {
                id: 's1',
                subjects: [
                  { id: 'sub1', name: 'Math', units: 3, gradeTrackingEnabled: true, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 100, max: 100 }] }] }] },
                  { id: 'sub2', name: 'English', units: 3, gradeTrackingEnabled: true, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 80, max: 100 }] }] }] }
                ]
              }
            ]
          }
        ]
      };

      // 1. Initial GWA with both subjects tracked
      let sem = mockState.years[0].semesters[0];
      let calc1 = Calculator.calculateSemester(sem, '1_IS_BEST');
      assert.strictEqual(calc1.percent, 90); // (100 + 80) / 2 = 90%

      // 2. Toggle sub1 to untracked
      mockState = toggleGradeTracking(mockState, 'y1', 's1', 'sub1');
      sem = mockState.years[0].semesters[0];
      let trackedSubs = getTrackedSubjects(sem);
      assert.strictEqual(trackedSubs.length, 1);
      assert.strictEqual(trackedSubs[0].id, 'sub2');

      let calc2 = Calculator.calculateSemester(sem, '1_IS_BEST');
      assert.strictEqual(calc2.percent, 80); // Only sub2 included

      // 3. Toggle sub2 to untracked (ALL untracked)
      mockState = toggleGradeTracking(mockState, 'y1', 's1', 'sub2');
      sem = mockState.years[0].semesters[0];
      let trackedSubsAllOff = getTrackedSubjects(sem);
      assert.strictEqual(trackedSubsAllOff.length, 0);

      let calc3 = Calculator.calculateSemester(sem, '1_IS_BEST');
      assert.strictEqual(calc3.percent, 0);
      assert.strictEqual(calc3.equivalent, 0);

      // 4. Toggle sub1 back ON
      mockState = toggleGradeTracking(mockState, 'y1', 's1', 'sub1');
      sem = mockState.years[0].semesters[0];
      let calc4 = Calculator.calculateSemester(sem, '1_IS_BEST');
      assert.strictEqual(calc4.percent, 100);
    });

    test('6.4 Batch delete state mutation and selection set consistency', () => {
      const initialSem = {
        id: 's1',
        subjects: [
          { id: 'sub_a', name: 'Alpha' },
          { id: 'sub_b', name: 'Beta' },
          { id: 'sub_c', name: 'Gamma' },
          { id: 'sub_d', name: 'Delta' }
        ]
      };

      const mockData = {
        years: [{ id: 'y1', semesters: [initialSem] }]
      };

      // Scenario A: Single delete 'sub_b'
      let stateA = JSON.parse(JSON.stringify(mockData));
      let semA = stateA.years[0].semesters[0];
      semA.subjects = semA.subjects.filter((s) => s.id !== 'sub_b');
      assert.strictEqual(semA.subjects.length, 3);
      assert.strictEqual(semA.subjects.some((s) => s.id === 'sub_b'), false);

      // Scenario B: Batch delete selected set {'sub_a', 'sub_c'}
      let selectedSet = new Set(['sub_a', 'sub_c']);
      let stateB = JSON.parse(JSON.stringify(mockData));
      let semB = stateB.years[0].semesters[0];
      semB.subjects = semB.subjects.filter((s) => !selectedSet.has(s.id));
      assert.strictEqual(semB.subjects.length, 2);
      assert.deepStrictEqual(semB.subjects.map((s) => s.id), ['sub_b', 'sub_d']);

      // Clear selection set
      selectedSet = new Set();
      assert.strictEqual(selectedSet.size, 0);

      // Scenario C: Batch delete ALL subjects
      let allIdsSet = new Set(['sub_a', 'sub_b', 'sub_c', 'sub_d']);
      let stateC = JSON.parse(JSON.stringify(mockData));
      let semC = stateC.years[0].semesters[0];
      semC.subjects = semC.subjects.filter((s) => !allIdsSet.has(s.id));
      assert.strictEqual(semC.subjects.length, 0);
    });

    test('6.5 Deep clone duplication: complete tree uniqueness and zero key collisions', () => {
      const complexTree = {
        id: 'subject_root',
        name: 'Database Systems',
        units: 3,
        passingPercent: 60,
        periods: [
          {
            id: 'period_1',
            name: 'Midterm',
            weight: 50,
            components: [
              {
                id: 'comp_1',
                name: 'Quizzes',
                weight: 50,
                items: [
                  {
                    id: 'item_1',
                    name: 'Quiz 1',
                    score: 95,
                    max: 100,
                    subItems: [
                      { id: 'subitem_1', name: 'Q1.1', score: 48, max: 50 },
                      { id: 'subitem_2', name: 'Q1.2', score: 47, max: 50 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      // Perform 5 consecutive deep clones
      const clones = [];
      for (let i = 0; i < 5; i++) {
        clones.push(deepCloneSubject(complexTree));
      }

      // Collect all IDs from original and all clones
      const getAllIds = (sub) => {
        const ids = [sub.id];
        (sub.periods || []).forEach((p) => {
          ids.push(p.id);
          (p.components || []).forEach((c) => {
            ids.push(c.id);
            (c.items || []).forEach((item) => {
              ids.push(item.id);
              (item.subItems || []).forEach((si) => {
                ids.push(si.id);
              });
            });
          });
        });
        return ids;
      };

      const origIds = getAllIds(complexTree);
      assert.strictEqual(origIds.length, 6); // 1 sub + 1 period + 1 comp + 1 item + 2 subitems = 6

      const allCollectedIds = new Set(origIds);
      clones.forEach((clone, idx) => {
        const cloneIds = getAllIds(clone);
        assert.strictEqual(cloneIds.length, 6, `Clone ${idx} must have 6 IDs`);
        cloneIds.forEach((id) => {
          assert.strictEqual(allCollectedIds.has(id), false, `Collision detected for ID: ${id}`);
          allCollectedIds.add(id);
        });
      });

      // Total unique IDs across original + 5 clones = 6 * 6 = 36
      assert.strictEqual(allCollectedIds.size, 36);

      // Verify mutation of clone does not affect original
      clones[0].periods[0].components[0].items[0].subItems[0].score = 0;
      assert.strictEqual(complexTree.periods[0].components[0].items[0].subItems[0].score, 48);
    });

    test('6.6 Dark and Light theme token parity in Theme.ts', () => {
      const lightKeys = Object.keys(Colors.light).sort();
      const darkKeys = Object.keys(Colors.dark).sort();

      // 1. Key parity check
      assert.deepStrictEqual(lightKeys, darkKeys, 'Light and Dark mode color token keys must match exactly');

      // 2. Value non-emptiness check
      lightKeys.forEach((key) => {
        const lightVal = Colors.light[key];
        const darkVal = Colors.dark[key];

        assert(typeof lightVal === 'string' && lightVal.length > 0, `Colors.light.${key} must be non-empty string`);
        assert(typeof darkVal === 'string' && darkVal.length > 0, `Colors.dark.${key} must be non-empty string`);
      });

      // 3. Helper function check
      const lightTheme = getTheme(false);
      const darkTheme = getTheme(true);

      assert.strictEqual(lightTheme, Colors.light);
      assert.strictEqual(darkTheme, Colors.dark);

      // 4. Design tokens structural check (Typography, Radius, Shadows, Spacing)
      assert(Radius.sm > 0 && Radius.full === 9999);
      assert(Typography.title.fontSize === 22);
      assert(Spacing.lg === 16);
      assert(Shadows.sm !== undefined && Shadows.md !== undefined && Shadows.lg !== undefined);
    });

  });
}
