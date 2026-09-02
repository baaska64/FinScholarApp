import assert from 'node:assert';
import {
  suggestSchoolYear,
  toLedgerDateString,
  deriveOnboardingProgress,
  createTermInLedger,
} from '../utils/onboardingProgress.ts';

/** Deterministic ids so assertions do not depend on Math.random. */
function seqIdFactory(prefix = 'id') {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export function runOnboardingTests(describe, test) {
  describe('Onboarding Suite 1: School Year Suggestion', () => {
    test('O1.1 Months from June onward suggest the year starting this calendar year', () => {
      assert.strictEqual(suggestSchoolYear(new Date(2026, 5, 15)), '2026 - 2027');
      assert.strictEqual(suggestSchoolYear(new Date(2026, 8, 1)), '2026 - 2027');
      assert.strictEqual(suggestSchoolYear(new Date(2026, 11, 31)), '2026 - 2027');
    });

    test('O1.2 Months before June still belong to the previous school year', () => {
      assert.strictEqual(suggestSchoolYear(new Date(2026, 0, 5)), '2025 - 2026');
      assert.strictEqual(suggestSchoolYear(new Date(2026, 3, 30)), '2025 - 2026');
    });

    test('O1.3 May is the cut-over month and starts the new span', () => {
      assert.strictEqual(suggestSchoolYear(new Date(2026, 4, 1)), '2026 - 2027');
      assert.strictEqual(suggestSchoolYear(new Date(2026, 3, 30)), '2025 - 2026');
    });

    test('O1.4 toLedgerDateString pads month and day in local time', () => {
      assert.strictEqual(toLedgerDateString(new Date(2026, 0, 3)), '2026-01-03');
      assert.strictEqual(toLedgerDateString(new Date(2026, 11, 25)), '2026-12-25');
    });
  });

  describe('Onboarding Suite 2: Getting Started Progress Derivation', () => {
    const ledger = {
      years: [
        {
          id: 'y1',
          name: '2025 - 2026',
          semesters: [
            {
              id: 's1',
              name: '1st Semester',
              subjects: [
                { id: 'sub1', name: 'Math', requirements: [{ id: 'r1', name: 'Quiz 1' }] },
                { id: 'sub2', name: 'Physics', requirements: [] },
              ],
              classes: [{ id: 'c1', subjectId: 'sub1' }],
            },
            { id: 's2', name: '2nd Semester', subjects: [], classes: [] },
          ],
        },
      ],
    };

    test('O2.1 A fully set up semester reports every step done', () => {
      const p = deriveOnboardingProgress(ledger, 'y1', 's1');
      assert.deepStrictEqual(p, { hasTerm: true, hasSubjects: true, hasClasses: true, hasTasks: true });
    });

    test('O2.2 An empty semester still counts the term as created', () => {
      const p = deriveOnboardingProgress(ledger, 'y1', 's2');
      assert.deepStrictEqual(p, { hasTerm: true, hasSubjects: false, hasClasses: false, hasTasks: false });
    });

    test('O2.3 Subjects with only empty requirement arrays do not count as tasks', () => {
      const noTasks = {
        years: [
          {
            id: 'y1',
            semesters: [{ id: 's1', subjects: [{ id: 'sub1', requirements: [] }], classes: [] }],
          },
        ],
      };
      assert.strictEqual(deriveOnboardingProgress(noTasks, 'y1', 's1').hasTasks, false);
    });

    test('O2.4 Missing, null and malformed ledgers degrade to all-false without throwing', () => {
      const allFalse = { hasTerm: false, hasSubjects: false, hasClasses: false, hasTasks: false };
      assert.deepStrictEqual(deriveOnboardingProgress(null, 'y1', 's1'), allFalse);
      assert.deepStrictEqual(deriveOnboardingProgress(undefined, null, null), allFalse);
      assert.deepStrictEqual(deriveOnboardingProgress({}, 'y1', 's1'), allFalse);
      assert.deepStrictEqual(deriveOnboardingProgress({ years: 'nope' }, 'y1', 's1'), allFalse);
      assert.deepStrictEqual(deriveOnboardingProgress({ years: [] }, 'y1', 's1'), allFalse);
    });

    test('O2.5 An unknown active term reports no subjects but keeps hasTerm true', () => {
      const p = deriveOnboardingProgress(ledger, 'missing-year', 'missing-sem');
      assert.strictEqual(p.hasTerm, true);
      assert.strictEqual(p.hasSubjects, false);
      assert.strictEqual(p.hasClasses, false);
      assert.strictEqual(p.hasTasks, false);
    });
  });

  describe('Onboarding Suite 3: Quick Term Creation', () => {
    test('O3.1 Creates a year and semester with the empty collections the app expects', () => {
      const res = createTermInLedger({ settings: {}, years: [] }, '2025 - 2026', '1st Semester', {
        generateId: seqIdFactory(),
      });
      assert.strictEqual(res.createdYear, true);
      assert.strictEqual(res.createdSemester, true);
      assert.strictEqual(res.data.years.length, 1);

      const year = res.data.years[0];
      const sem = year.semesters[0];
      assert.strictEqual(year.name, '2025 - 2026');
      assert.strictEqual(sem.name, '1st Semester');
      assert.deepStrictEqual(sem.subjects, []);
      assert.deepStrictEqual(sem.classes, []);
      assert.deepStrictEqual(sem.milestones, []);
      assert.strictEqual(res.yearId, year.id);
      assert.strictEqual(res.semId, sem.id);
    });

    test('O3.2 Existing settings and years are preserved', () => {
      const existing = {
        settings: { taskThresholds: { high: 21, medium: 10, low: 5 } },
        years: [{ id: 'old', name: '2024 - 2025', semesters: [] }],
      };
      const res = createTermInLedger(existing, '2025 - 2026', 'Summer', { generateId: seqIdFactory() });
      assert.deepStrictEqual(res.data.settings, existing.settings);
      assert.strictEqual(res.data.years.length, 2);
      assert.strictEqual(res.data.years[0].id, 'old');
    });

    test('O3.3 Does not mutate the ledger it was given', () => {
      const original = { settings: {}, years: [] };
      createTermInLedger(original, '2025 - 2026', '1st Semester', { generateId: seqIdFactory() });
      assert.strictEqual(original.years.length, 0);
    });

    test('O3.4 Re-running setup reuses a matching year and semester instead of duplicating', () => {
      const first = createTermInLedger({ years: [] }, '2025 - 2026', '1st Semester', {
        generateId: seqIdFactory('a'),
      });
      const second = createTermInLedger(first.data, '  2025 - 2026 ', '1ST SEMESTER', {
        generateId: seqIdFactory('b'),
      });

      assert.strictEqual(second.createdYear, false);
      assert.strictEqual(second.createdSemester, false);
      assert.strictEqual(second.data.years.length, 1);
      assert.strictEqual(second.data.years[0].semesters.length, 1);
      assert.strictEqual(second.yearId, first.yearId);
      assert.strictEqual(second.semId, first.semId);
    });

    test('O3.5 A second semester lands inside the same year', () => {
      const first = createTermInLedger({ years: [] }, '2025 - 2026', '1st Semester', {
        generateId: seqIdFactory('a'),
      });
      const second = createTermInLedger(first.data, '2025 - 2026', '2nd Semester', {
        generateId: seqIdFactory('b'),
      });

      assert.strictEqual(second.data.years.length, 1);
      assert.strictEqual(second.data.years[0].semesters.length, 2);
      assert.strictEqual(second.createdYear, false);
      assert.strictEqual(second.createdSemester, true);
    });

    test('O3.6 Optional dates are only written when provided', () => {
      const withDates = createTermInLedger({ years: [] }, '2025 - 2026', '1st Semester', {
        startDate: '2025-08-11',
        endDate: '2025-12-19',
        generateId: seqIdFactory(),
      });
      const sem = withDates.data.years[0].semesters[0];
      assert.strictEqual(sem.startDate, '2025-08-11');
      assert.strictEqual(sem.endDate, '2025-12-19');

      const withoutDates = createTermInLedger({ years: [] }, '2025 - 2026', '1st Semester', {
        generateId: seqIdFactory(),
      });
      const bare = withoutDates.data.years[0].semesters[0];
      assert.strictEqual('startDate' in bare, false);
      assert.strictEqual('endDate' in bare, false);
    });

    test('O3.7 Blank names are rejected rather than silently creating junk terms', () => {
      assert.throws(() => createTermInLedger({ years: [] }, '   ', '1st Semester'), /required/);
      assert.throws(() => createTermInLedger({ years: [] }, '2025 - 2026', ''), /required/);
    });

    test('O3.8 A missing or malformed ledger is rebuilt rather than crashing', () => {
      const res = createTermInLedger(null, '2025 - 2026', '1st Semester', { generateId: seqIdFactory() });
      assert.strictEqual(res.data.years.length, 1);

      const res2 = createTermInLedger({ years: null }, '2025 - 2026', '1st Semester', {
        generateId: seqIdFactory(),
      });
      assert.strictEqual(res2.data.years.length, 1);
    });

    test('O3.9 A newly created term immediately satisfies the first checklist step', () => {
      const res = createTermInLedger({ years: [] }, '2025 - 2026', '1st Semester', {
        generateId: seqIdFactory(),
      });
      const progress = deriveOnboardingProgress(res.data, res.yearId, res.semId);
      assert.strictEqual(progress.hasTerm, true);
      assert.strictEqual(progress.hasSubjects, false);
    });
  });
}
