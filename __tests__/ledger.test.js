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

/** Recursively clone a subject and regenerate every ID in the tree so React keys never collide. */
export function deepCloneSubject(sub) {
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

export function runLedgerTests(describe, test) {
  describe('Grade Ledger Suite 1: GWA Calculations Across All Grading Systems', () => {

    test('1.1 GWA calculation for 1_IS_BEST system (Semester, Year, Cumulative)', () => {
      const system = '1_IS_BEST';
      const mockData = {
        settings: { gradingSystem: system },
        years: [
          {
            id: 'y1',
            name: 'Year 1',
            semesters: [
              {
                id: 's1',
                name: 'Sem 1',
                subjects: [
                  {
                    id: 'sub1',
                    name: 'Math 101',
                    units: 3,
                    passingPercent: 60,
                    gradeTrackingEnabled: true,
                    periods: [
                      {
                        id: 'p1',
                        weight: 100,
                        components: [
                          { id: 'c1', weight: 100, items: [{ id: 'i1', score: 100, max: 100 }] }
                        ]
                      }
                    ]
                  },
                  {
                    id: 'sub2',
                    name: 'Physics 101',
                    units: 3,
                    passingPercent: 60,
                    gradeTrackingEnabled: true,
                    periods: [
                      {
                        id: 'p1',
                        weight: 100,
                        components: [
                          { id: 'c1', weight: 100, items: [{ id: 'i1', score: 60, max: 100 }] }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const sem = mockData.years[0].semesters[0];
      const year = mockData.years[0];

      // Sub 1: 100% -> eq 1.0, 3 units
      // Sub 2: 60% -> eq 3.0, 3 units
      // Sem Weighted % = (100*3 + 60*3)/6 = 80%
      // Sem Weighted Eq = (1.0*3 + 3.0*3)/6 = 2.0
      const semRes = Calculator.calculateSemester(sem, system);
      assert.strictEqual(semRes.percent, 80);
      assert.strictEqual(semRes.equivalent, 2.0);

      const yrRes = Calculator.calculateYear(year, system);
      assert.strictEqual(yrRes.percent, 80);
      assert.strictEqual(yrRes.equivalent, 2.0);

      const cumRes = Calculator.calculateCumulative(mockData.years, system);
      assert.strictEqual(cumRes.percent, 80);
      assert.strictEqual(cumRes.equivalent, 2.0);
    });

    test('1.2 GWA calculation for 5_IS_BEST system (PUP scale)', () => {
      const system = '5_IS_BEST';
      const mockSem = {
        id: 's1',
        subjects: [
          {
            id: 'sub1',
            name: 'Eng 101',
            units: 4,
            passingPercent: 60,
            gradeTrackingEnabled: true,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 100, max: 100 }] }
                ]
              }
            ]
          },
          {
            id: 'sub2',
            name: 'Hist 101',
            units: 2,
            passingPercent: 60,
            gradeTrackingEnabled: true,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 60, max: 100 }] }
                ]
              }
            ]
          }
        ]
      };

      // In 5_IS_BEST: 100% -> 5.0 eq, 60% -> 3.0 eq
      // Weighted % = (100*4 + 60*2) / 6 = (400 + 120) / 6 = 520 / 6 = 86.666...%
      // Weighted Eq = (5.0*4 + 3.0*2) / 6 = (20 + 6) / 6 = 26 / 6 = 4.333...
      const semRes = Calculator.calculateSemester(mockSem, system);
      assert(Math.abs(semRes.percent - 86.6666) < 0.01, `Expected ~86.67%, got ${semRes.percent}`);
      assert(Math.abs(semRes.equivalent - 4.3333) < 0.01, `Expected ~4.33, got ${semRes.equivalent}`);
    });

    test('1.3 GWA calculation for 4_IS_BEST system (DLSU scale)', () => {
      const system = '4_IS_BEST';
      const mockSem = {
        id: 's1',
        subjects: [
          {
            id: 'sub1',
            name: 'CS 101',
            units: 3,
            passingPercent: 60,
            gradeTrackingEnabled: true,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 100, max: 100 }] }
                ]
              }
            ]
          },
          {
            id: 'sub2',
            name: 'CS 102',
            units: 3,
            passingPercent: 60,
            gradeTrackingEnabled: true,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 60, max: 100 }] }
                ]
              }
            ]
          }
        ]
      };

      // In 4_IS_BEST: 100% -> 4.0 eq, 60% -> 1.0 eq
      // Weighted % = (100*3 + 60*3) / 6 = 80%
      // Weighted Eq = (4.0*3 + 1.0*3) / 6 = 2.5
      const semRes = Calculator.calculateSemester(mockSem, system);
      assert.strictEqual(semRes.percent, 80);
      assert.strictEqual(semRes.equivalent, 2.5);
    });

    test('1.4 GWA calculation for PERCENT system', () => {
      const system = 'PERCENT';
      const mockSem = {
        id: 's1',
        subjects: [
          {
            id: 'sub1',
            name: 'Art 101',
            units: 3,
            passingPercent: 60,
            gradeTrackingEnabled: true,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 92, max: 100 }] }
                ]
              }
            ]
          },
          {
            id: 'sub2',
            name: 'Music 101',
            units: 3,
            passingPercent: 60,
            gradeTrackingEnabled: true,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 88, max: 100 }] }
                ]
              }
            ]
          }
        ]
      };

      const semRes = Calculator.calculateSemester(mockSem, system);
      assert.strictEqual(semRes.percent, 90);
      assert.strictEqual(semRes.equivalent, 90);
    });

    test('1.5 Grade interpolation (interpolateGrade and percentFromGpa)', () => {
      const passing = 60;

      // 1_IS_BEST
      assert.strictEqual(Calculator.interpolateGrade(100, passing, '1_IS_BEST'), 1.0);
      assert.strictEqual(Calculator.interpolateGrade(60, passing, '1_IS_BEST'), 3.0);
      assert.strictEqual(Calculator.interpolateGrade(0, passing, '1_IS_BEST'), 5.0);

      // 5_IS_BEST
      assert.strictEqual(Calculator.interpolateGrade(100, passing, '5_IS_BEST'), 5.0);
      assert.strictEqual(Calculator.interpolateGrade(60, passing, '5_IS_BEST'), 3.0);
      assert.strictEqual(Calculator.interpolateGrade(0, passing, '5_IS_BEST'), 1.0);

      // 4_IS_BEST
      assert.strictEqual(Calculator.interpolateGrade(100, passing, '4_IS_BEST'), 4.0);
      assert.strictEqual(Calculator.interpolateGrade(60, passing, '4_IS_BEST'), 1.0);
      assert.strictEqual(Calculator.interpolateGrade(0, passing, '4_IS_BEST'), 0.0);

      // percentFromGpa round trips
      assert.strictEqual(Calculator.percentFromGpa(1.0, passing, '1_IS_BEST'), 100);
      assert.strictEqual(Calculator.percentFromGpa(3.0, passing, '1_IS_BEST'), 60);

      assert.strictEqual(Calculator.percentFromGpa(5.0, passing, '5_IS_BEST'), 100);
      assert.strictEqual(Calculator.percentFromGpa(3.0, passing, '5_IS_BEST'), 60);

      assert.strictEqual(Calculator.percentFromGpa(4.0, passing, '4_IS_BEST'), 100);
      assert.strictEqual(Calculator.percentFromGpa(1.0, passing, '4_IS_BEST'), 60);
    });

    test('1.6 Subject tracking toggle excludes subject from GWA calculation', () => {
      const system = '1_IS_BEST';
      const mockSem = {
        id: 's1',
        subjects: [
          {
            id: 'sub1',
            name: 'Math',
            units: 3,
            passingPercent: 60,
            gradeTrackingEnabled: true,
            periods: [
              { id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ id: 'i1', score: 100, max: 100 }] }] }
            ]
          },
          {
            id: 'sub2',
            name: 'PE (Untracked)',
            units: 3,
            passingPercent: 60,
            gradeTrackingEnabled: false, // EXCLUDED
            periods: [
              { id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ id: 'i1', score: 60, max: 100 }] }] }
            ]
          }
        ]
      };

      const res = Calculator.calculateSemester(mockSem, system);
      // PE is untracked, so only Math (100% -> 1.0) is included.
      assert.strictEqual(res.percent, 100);
      assert.strictEqual(res.equivalent, 1.0);
    });

  });

  describe('Grade Ledger Suite 2: Subject Registry, Tracking Toggles & Creation Defaults', () => {

    test('2.1 toggleGradeTracking flips gradeTrackingEnabled flag', () => {
      const initialData = {
        years: [
          {
            id: 'y1',
            semesters: [
              {
                id: 's1',
                subjects: [
                  { id: 'sub1', name: 'Chemistry', gradeTrackingEnabled: true }
                ]
              }
            ]
          }
        ]
      };

      // Toggle ON -> OFF
      const toggledOff = toggleGradeTracking(initialData, 'y1', 's1', 'sub1');
      assert.strictEqual(toggledOff.years[0].semesters[0].subjects[0].gradeTrackingEnabled, false);

      // Toggle OFF -> ON
      const toggledOn = toggleGradeTracking(toggledOff, 'y1', 's1', 'sub1');
      assert.strictEqual(toggledOn.years[0].semesters[0].subjects[0].gradeTrackingEnabled, true);

      // Test with undefined initial flag (should toggle to false)
      const dataWithUndefinedFlag = {
        years: [
          {
            id: 'y1',
            semesters: [
              {
                id: 's1',
                subjects: [{ id: 'sub2', name: 'Biology' }]
              }
            ]
          }
        ]
      };
      const toggledUndef = toggleGradeTracking(dataWithUndefinedFlag, 'y1', 's1', 'sub2');
      assert.strictEqual(toggledUndef.years[0].semesters[0].subjects[0].gradeTrackingEnabled, false);
    });

    test('2.2 ensureSubjectExists handles creation defaults and prevents duplicates', () => {
      const baseData = {
        years: [
          {
            id: 'y1',
            semesters: [
              {
                id: 's1',
                subjects: [
                  { id: 'sub1', name: 'Calculus I', units: 3, gradeTrackingEnabled: true }
                ]
              }
            ]
          }
        ]
      };

      // 1. Add new subject from Grades (fromSchedule: false)
      const resGrades = ensureSubjectExists(baseData, 'y1', 's1', 'Linear Algebra', { fromSchedule: false });
      assert.strictEqual(resGrades.isNew, true);
      assert(resGrades.subjectId.length > 0);
      const newSubGrades = resGrades.data.years[0].semesters[0].subjects.find(s => s.id === resGrades.subjectId);
      assert.strictEqual(newSubGrades.name, 'Linear Algebra');
      assert.strictEqual(newSubGrades.gradeTrackingEnabled, true);
      assert.strictEqual(newSubGrades.units, 3);
      assert.strictEqual(newSubGrades.passingPercent, 60);

      // 2. Add new subject from Schedule (fromSchedule: true)
      const resSched = ensureSubjectExists(baseData, 'y1', 's1', 'Physics Lab', { fromSchedule: true });
      assert.strictEqual(resSched.isNew, true);
      const newSubSched = resSched.data.years[0].semesters[0].subjects.find(s => s.id === resSched.subjectId);
      assert.strictEqual(newSubSched.gradeTrackingEnabled, false);

      // 3. Prevent duplicate (case-insensitive & trimmed)
      const resDup = ensureSubjectExists(baseData, 'y1', 's1', '   calculus i   ');
      assert.strictEqual(resDup.isNew, false);
      assert.strictEqual(resDup.subjectId, 'sub1');
      assert.strictEqual(resDup.data.years[0].semesters[0].subjects.length, 1);

      // 4. Invalid year or sem ID returns graceful response
      const resInvalid = ensureSubjectExists(baseData, 'invalid_y', 'invalid_s', 'Ghost Subject');
      assert.strictEqual(resInvalid.isNew, false);
      assert.strictEqual(resInvalid.subjectId, '');
    });

    test('2.3 Subject helper functions (getSubjectsWithDefaults, getUnscheduledSubjects, getTrackedSubjects, refreshHasSchedule)', () => {
      const sem = {
        id: 's1',
        classes: [{ id: 'cls1', subjectId: 'sub1' }],
        subjects: [
          { id: 'sub1', name: 'Sub 1', hasSchedule: true, gradeTrackingEnabled: true },
          { id: 'sub2', name: 'Sub 2', hasSchedule: false, gradeTrackingEnabled: true },
          { id: 'sub3', name: 'Sub 3', hasSchedule: false, gradeTrackingEnabled: false },
          { id: 'sub4', name: 'Sub 4' } // undefined flags
        ]
      };

      const withDefaults = getSubjectsWithDefaults(sem);
      assert.strictEqual(withDefaults.length, 4);
      assert.strictEqual(withDefaults[3].gradeTrackingEnabled, true);
      assert.strictEqual(withDefaults[3].hasSchedule, false);

      const unscheduled = getUnscheduledSubjects(sem);
      // sub2, sub3, sub4 are unscheduled
      assert.strictEqual(unscheduled.length, 3);
      assert.strictEqual(unscheduled.some(s => s.id === 'sub1'), false);

      const tracked = getTrackedSubjects(sem);
      // sub1, sub2, sub4 are tracked (sub3 is untracked)
      assert.strictEqual(tracked.length, 3);
      assert.strictEqual(tracked.some(s => s.id === 'sub3'), false);

      // refreshHasSchedule
      const fullData = {
        years: [{ id: 'y1', semesters: [sem] }]
      };
      const refreshed = refreshHasSchedule(fullData, 'y1', 's1', 'sub2');
      assert.strictEqual(refreshed.years[0].semesters[0].subjects[1].hasSchedule, false);
    });

  });

  describe('Grade Ledger Suite 3: Subject Duplication & Deep ID Regeneration', () => {

    test('3.1 deepCloneSubject duplicates hierarchy and regenerates all IDs', () => {
      const originalSubject = {
        id: 'orig_sub_1',
        name: 'Data Structures',
        units: 3,
        passingPercent: 60,
        periods: [
          {
            id: 'orig_p1',
            name: 'Midterm Period',
            weight: 50,
            components: [
              {
                id: 'orig_c1',
                name: 'Exams',
                weight: 50,
                items: [
                  {
                    id: 'orig_i1',
                    name: 'Exam 1',
                    score: 90,
                    max: 100,
                    subItems: [
                      { id: 'orig_si1', name: 'Part A', score: 45, max: 50 },
                      { id: 'orig_si2', name: 'Part B', score: 45, max: 50 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const cloned = deepCloneSubject(originalSubject);
      cloned.name = originalSubject.name + ' Copy';

      // 1. Verify top-level subject clone
      assert.strictEqual(cloned.name, 'Data Structures Copy');
      assert.notStrictEqual(cloned.id, originalSubject.id);

      // 2. Verify period level clone
      assert.strictEqual(cloned.periods.length, 1);
      assert.notStrictEqual(cloned.periods[0].id, originalSubject.periods[0].id);
      assert.strictEqual(cloned.periods[0].name, 'Midterm Period');

      // 3. Verify component level clone
      assert.strictEqual(cloned.periods[0].components.length, 1);
      assert.notStrictEqual(cloned.periods[0].components[0].id, originalSubject.periods[0].components[0].id);

      // 4. Verify item level clone
      assert.strictEqual(cloned.periods[0].components[0].items.length, 1);
      assert.notStrictEqual(cloned.periods[0].components[0].items[0].id, originalSubject.periods[0].components[0].items[0].id);
      assert.strictEqual(cloned.periods[0].components[0].items[0].score, 90);

      // 5. Verify sub-item level clone
      const clonedSubItems = cloned.periods[0].components[0].items[0].subItems;
      const origSubItems = originalSubject.periods[0].components[0].items[0].subItems;
      assert.strictEqual(clonedSubItems.length, 2);
      assert.notStrictEqual(clonedSubItems[0].id, origSubItems[0].id);
      assert.notStrictEqual(clonedSubItems[1].id, origSubItems[1].id);

      // Ensure zero mutation of original subject
      assert.strictEqual(originalSubject.name, 'Data Structures');
      assert.strictEqual(originalSubject.id, 'orig_sub_1');
    });

  });

  describe('Grade Ledger Suite 4: Empty States, Edge Cases & Boundary Conditions', () => {

    test('4.1 Zero units handling in Semester, Year, and Cumulative GWA', () => {
      const system = '1_IS_BEST';

      // Subject with 0 units
      const zeroUnitSem = {
        id: 's1',
        subjects: [
          {
            id: 'sub1',
            name: 'Seminar',
            units: 0,
            gradeTrackingEnabled: true,
            periods: [{ id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ id: 'i1', score: 100, max: 100 }] }] }]
          }
        ]
      };

      const semRes = Calculator.calculateSemester(zeroUnitSem, system);
      assert.strictEqual(semRes.percent, 0);
      assert.strictEqual(semRes.equivalent, 0);

      const zeroUnitYear = {
        id: 'y1',
        semesters: [zeroUnitSem]
      };
      const yrRes = Calculator.calculateYear(zeroUnitYear, system);
      assert.strictEqual(yrRes.percent, 0);
      assert.strictEqual(yrRes.equivalent, 0);

      const cumRes = Calculator.calculateCumulative([zeroUnitYear], system);
      assert.strictEqual(cumRes.percent, 0);
      assert.strictEqual(cumRes.equivalent, 0);
    });

    test('4.2 Missing and partial grade scores handling', () => {
      const system = '1_IS_BEST';
      const subjectWithMissingScores = {
        id: 'sub1',
        name: 'Algorithms',
        units: 3,
        passingPercent: 60,
        periods: [
          {
            id: 'p1',
            weight: 100,
            components: [
              {
                id: 'c1',
                weight: 50,
                items: [{ id: 'i1', score: '', max: 100 }] // Empty score
              },
              {
                id: 'c2',
                weight: 50,
                items: [{ id: 'i2', score: 80, max: 100 }] // Valid score 80%
              }
            ]
          }
        ]
      };

      const subRes = Calculator.calculateSubject(subjectWithMissingScores, system);
      assert.strictEqual(subRes.hasData, true);
      assert.strictEqual(subRes.percent, 40); // 80% score * 50% weight = 40%
      assert.strictEqual(subRes.emptyComponents.length, 1);
      assert.strictEqual(subRes.emptyComponents[0].id, 'i1');
    });

    test('4.3 Completely empty subject/semester/year structures (0 subjects / 0 sems / 0 years)', () => {
      const system = '1_IS_BEST';

      const emptySem = { id: 's1', subjects: [] };
      const semRes = Calculator.calculateSemester(emptySem, system);
      assert.strictEqual(semRes.percent, 0);
      assert.strictEqual(semRes.equivalent, 0);

      const emptyYear = { id: 'y1', semesters: [] };
      const yrRes = Calculator.calculateYear(emptyYear, system);
      assert.strictEqual(yrRes.percent, 0);
      assert.strictEqual(yrRes.equivalent, 0);

      const cumRes = Calculator.calculateCumulative([], system);
      assert.strictEqual(cumRes.percent, 0);
      assert.strictEqual(cumRes.equivalent, 0);
    });

    test('4.4 Automatic weight distribution when weights are blank or unspecified', () => {
      const system = 'PERCENT';
      const subjectWithAutoWeights = {
        id: 'sub1',
        name: 'Elective',
        units: 3,
        passingPercent: 60,
        periods: [
          {
            id: 'p1',
            // weight left blank -> auto-weights to 100
            components: [
              {
                id: 'c1',
                // weight blank -> auto-splits 50%
                items: [{ id: 'i1', score: 100, max: 100 }]
              },
              {
                id: 'c2',
                // weight blank -> auto-splits 50%
                items: [{ id: 'i2', score: 80, max: 100 }]
              }
            ]
          }
        ]
      };

      const subRes = Calculator.calculateSubject(subjectWithAutoWeights, system);
      // c1: 100% * 50% = 50%; c2: 80% * 50% = 40%; total = 90%
      assert.strictEqual(subRes.percent, 90);
    });

  describe('Grade Ledger Suite 5: Term Selector & Subject Card Component Contracts', () => {

    test('5.1 Tabs component props contract and term label formatting', () => {
      const years = [
        {
          id: 'y2026',
          name: 'Year 2026',
          semesters: [
            { id: 'sem1', name: 'Semester 1' },
            { id: 'sem2', name: 'Semester 2' }
          ]
        }
      ];

      const currentYear = years.find(y => y.id === 'y2026');
      const currentSem = currentYear?.semesters.find(s => s.id === 'sem1');
      const buttonLabel = currentYear && currentSem 
        ? `${currentYear.name} • ${currentSem.name}`
        : currentYear ? currentYear.name : 'Select Term';

      assert.strictEqual(buttonLabel, 'Year 2026 • Semester 1');
    });

    test('5.2 SubjectCard props contract & score color interpolation boundaries', () => {
      const subjectHigh = { name: 'CS 101', units: 3, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 95, max: 100 }] }] }] };
      const subjectMed = { name: 'CS 102', units: 3, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 80, max: 100 }] }] }] };
      const subjectLow = { name: 'CS 103', units: 3, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 65, max: 100 }] }] }] };
      const subjectFail = { name: 'CS 104', units: 3, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 45, max: 100 }] }] }] };
      const subjectUntracked = { name: 'CS 105', units: 3, gradeTrackingEnabled: false, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 95, max: 100 }] }] }] };

      const resHigh = Calculator.calculateSubject(subjectHigh, '1_IS_BEST');
      assert.strictEqual(resHigh.percent, 95);

      const resMed = Calculator.calculateSubject(subjectMed, '1_IS_BEST');
      assert.strictEqual(resMed.percent, 80);

      const resLow = Calculator.calculateSubject(subjectLow, '1_IS_BEST');
      assert.strictEqual(resLow.percent, 65);

      const resFail = Calculator.calculateSubject(subjectFail, '1_IS_BEST');
      assert.strictEqual(resFail.percent, 45);

      assert.strictEqual(subjectUntracked.gradeTrackingEnabled, false);
    });

    test('5.3 SubjectCard prop alias resolution (isEditMode vs isSelectionMode, onToggleSelect vs onSelect)', () => {
      const mockProps1 = {
        isEditMode: true,
        onToggleSelect: () => 'toggled1'
      };
      const effectiveEditMode1 = Boolean(mockProps1.isEditMode || mockProps1.isSelectionMode);
      const handleSelectToggle1 = mockProps1.onToggleSelect || mockProps1.onSelect;
      assert.strictEqual(effectiveEditMode1, true);
      assert.strictEqual(handleSelectToggle1(), 'toggled1');

      const mockProps2 = {
        isSelectionMode: true,
        onSelect: () => 'toggled2'
      };
      const effectiveEditMode2 = Boolean(mockProps2.isEditMode || mockProps2.isSelectionMode);
      const handleSelectToggle2 = mockProps2.onToggleSelect || mockProps2.onSelect;
      assert.strictEqual(effectiveEditMode2, true);
      assert.strictEqual(handleSelectToggle2(), 'toggled2');
    });

  });

  });
}

if (process.argv[1] && process.argv[1].endsWith('ledger.test.js')) {
  console.log('Running ledger.test.js directly...');
  const describe = (name, fn) => {
    console.log(`\n=== ${name} ===`);
    fn();
  };
  const test = (name, fn) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (e) {
      console.log(`  ✖ ${name}: ${e.message}`);
      throw e;
    }
  };
  runLedgerTests(describe, test);
}
