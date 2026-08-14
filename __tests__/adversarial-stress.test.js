import assert from 'node:assert';
import { Calculator } from '../utils/calculator.js';
import {
  calculateSemesterProgress,
  calculateAttendanceStats,
  calculateSubjectTaskProgress,
  calculatePendingTaskCount,
  calculateDashboardHeroStats
} from './helpers/dashboardCalculations.js';

export function runAdversarialTests(describe, test) {
  describe('Tier 5: Adversarial Stress & Edge Case Harness', () => {

    test('5.1 Rapid term switching - Multi-year/sem state recalculations', () => {
      const mockData = {
        settings: { gradingSystem: '1_IS_BEST' },
        years: [
          {
            id: 'yr_2025',
            name: 'Academic Year 2025-2026',
            semesters: [
              {
                id: 'sem_2025_1',
                name: 'Fall 2025',
                startDate: '2025-08-01',
                endDate: '2025-12-15',
                subjects: [
                  {
                    id: 'sub_m1',
                    name: 'Calculus I',
                    units: 3,
                    passingPercent: 60,
                    periods: [{ id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ id: 'i1', score: 95, max: 100 }] }] }],
                    requirements: [
                      { id: 'r1', title: 'Problem Set 1', status: 'submitted' },
                      { id: 'r2', title: 'Midterm Exam', status: 'pending' }
                    ]
                  },
                  {
                    id: 'sub_s1',
                    name: 'Physics I',
                    units: 3,
                    passingPercent: 60,
                    periods: [{ id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ id: 'i1', score: 85, max: 100 }] }] }],
                    requirements: [
                      { id: 'r3', title: 'Lab Report 1', status: 'pending' }
                    ]
                  }
                ],
                classes: [
                  { id: 'cls_1', name: 'Calculus I', day: 0 },
                  { id: 'cls_2', name: 'Physics I', day: 2 }
                ],
                attendanceLog: {
                  '2025-08-04_cls_1': { status: 'present' },
                  '2025-08-06_cls_2': { status: 'absent' }
                }
              },
              {
                id: 'sem_2025_2',
                name: 'Spring 2026',
                startDate: '2026-01-15',
                endDate: '2026-05-30',
                subjects: [
                  {
                    id: 'sub_m2',
                    name: 'Calculus II',
                    units: 4,
                    passingPercent: 60,
                    periods: [{ id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ id: 'i1', score: 70, max: 100 }] }] }],
                    requirements: [
                      { id: 'r4', title: 'Quiz 1', status: 'submitted' }
                    ]
                  }
                ],
                classes: [
                  { id: 'cls_3', name: 'Calculus II', day: 1 }
                ],
                attendanceLog: {
                  '2026-01-20_cls_3': { status: 'present' },
                  '2026-01-27_cls_3': { status: 'present' }
                }
              }
            ]
          },
          {
            id: 'yr_2026',
            name: 'Academic Year 2026-2027',
            semesters: [
              {
                id: 'sem_2026_1',
                name: 'Fall 2026',
                startDate: '2026-08-01',
                endDate: '2026-12-20',
                subjects: [
                  {
                    id: 'sub_h1',
                    name: 'World History',
                    units: 3,
                    passingPercent: 60,
                    periods: [{ id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ id: 'i1', score: 60, max: 100 }] }] }],
                    requirements: [
                      { id: 'r5', title: 'Essay 1', status: 'pending' },
                      { id: 'r6', title: 'Essay 2', status: 'pending' }
                    ]
                  }
                ],
                classes: [],
                attendanceLog: {}
              }
            ]
          }
        ]
      };

      const refDate = new Date('2025-09-01T12:00:00');

      // 1. Initial calculate for Year 2025 / Sem 1
      const statsY1S1 = calculateDashboardHeroStats(mockData, 'yr_2025', 'sem_2025_1', refDate);
      assert.strictEqual(statsY1S1.semGWA.percent, 90);
      assert.strictEqual(statsY1S1.pendingTasks.pendingCount, 2);
      assert.strictEqual(statsY1S1.attendance.presentCount, 1);
      assert.strictEqual(statsY1S1.attendance.absentCount, 1);

      // 2. Switch to Year 2025 / Sem 2
      const refDate2 = new Date('2026-02-01T12:00:00');
      const statsY1S2 = calculateDashboardHeroStats(mockData, 'yr_2025', 'sem_2025_2', refDate2);
      assert.strictEqual(statsY1S2.semGWA.percent, 70);
      assert.strictEqual(statsY1S2.pendingTasks.pendingCount, 0);
      assert.strictEqual(statsY1S2.attendance.presentCount, 2);
      assert.strictEqual(statsY1S2.attendance.absentCount, 0);

      // Year 1 GWA should combine sem 1 (90% * 6 units) + sem 2 (70% * 4 units) = (540 + 280) / 10 = 82%
      assert.strictEqual(statsY1S2.yearGWA.percent, 82);

      // 3. Switch to Year 2026 / Sem 1
      const refDate3 = new Date('2026-09-01T12:00:00');
      const statsY2S1 = calculateDashboardHeroStats(mockData, 'yr_2026', 'sem_2026_1', refDate3);
      assert.strictEqual(statsY2S1.semGWA.percent, 60);
      assert.strictEqual(statsY2S1.yearGWA.percent, 60);
      assert.strictEqual(statsY2S1.pendingTasks.pendingCount, 2);

      // 4. Rapid back-and-forth switching (10 iterations)
      for (let i = 0; i < 10; i++) {
        const check1 = calculateDashboardHeroStats(mockData, 'yr_2025', 'sem_2025_1', refDate);
        assert.strictEqual(check1.semGWA.percent, 90);
        assert.strictEqual(check1.pendingTasks.pendingCount, 2);

        const check2 = calculateDashboardHeroStats(mockData, 'yr_2025', 'sem_2025_2', refDate2);
        assert.strictEqual(check2.semGWA.percent, 70);
        assert.strictEqual(check2.yearGWA.percent, 82);

        const check3 = calculateDashboardHeroStats(mockData, 'yr_2026', 'sem_2026_1', refDate3);
        assert.strictEqual(check3.semGWA.percent, 60);
      }
    });

    test('5.2 Extreme boundary dates (1-day, 365-day, leap year, negative spans, identical dates)', () => {
      // Case 1: Identical start/end dates ('2026-08-10' to '2026-08-10')
      // Note: calculateSemesterProgress sets start at 00:00:00 and end at 23:59:59.
      const sameDayStart = '2026-08-10';
      const sameDayEnd = '2026-08-10';
      const noonSameDay = new Date('2026-08-10T12:00:00');
      const resSameDay = calculateSemesterProgress(sameDayStart, sameDayEnd, noonSameDay);
      assert.strictEqual(resSameDay.isValid, true);
      assert.strictEqual(resSameDay.status, 'active');
      assert(resSameDay.percent > 49 && resSameDay.percent < 51, `Expected ~50%, got ${resSameDay.percent}%`);

      // Case 2: Inverted date range (start '2026-12-31', end '2026-01-01')
      // Testing current date before start date ('2026-06-01' < '2026-12-31')
      const invRes1 = calculateSemesterProgress('2026-12-31', '2026-01-01', new Date('2026-06-01'));
      assert.strictEqual(invRes1.status, 'not_started');
      assert.strictEqual(invRes1.percent, 0);

      // Testing current date after end date ('2027-01-01' > '2026-01-01')
      const invRes2 = calculateSemesterProgress('2026-12-31', '2026-01-01', new Date('2027-01-01'));
      assert.strictEqual(invRes2.status, 'ended');
      assert.strictEqual(invRes2.percent, 100);

      // Case 3: 365-day semester
      const start365 = '2026-01-01';
      const end365 = '2026-12-31';
      const mid365 = new Date('2026-07-02T12:00:00');
      const res365 = calculateSemesterProgress(start365, end365, mid365);
      assert.strictEqual(res365.isValid, true);
      assert(res365.percent > 49 && res365.percent < 51, `Expected ~50%, got ${res365.percent}%`);

      // Case 4: Leap year (Feb 2028 has 29 days)
      const startLeap = '2028-02-01';
      const endLeap = '2028-02-29';
      const midLeap = new Date('2028-02-15T12:00:00');
      const resLeap = calculateSemesterProgress(startLeap, endLeap, midLeap);
      assert.strictEqual(resLeap.isValid, true);
      assert(resLeap.percent > 49 && resLeap.percent < 51, `Expected ~50%, got ${resLeap.percent}%`);

      // Case 5: Far past and far future
      const pastRes = calculateSemesterProgress('2026-01-01', '2026-05-31', new Date('2020-01-01'));
      assert.strictEqual(pastRes.status, 'not_started');
      assert.strictEqual(pastRes.percent, 0);

      const futureRes = calculateSemesterProgress('2026-01-01', '2026-05-31', new Date('2030-01-01'));
      assert.strictEqual(futureRes.status, 'ended');
      assert.strictEqual(futureRes.percent, 100);
    });

    test('5.3 Concurrent class attendance toggling (P -> A -> NC -> pending)', () => {
      const startDate = '2026-08-03'; // Monday
      const endDate = '2026-08-31';   // Monday
      const currentDate = new Date('2026-08-31T23:59:59');

      const classes = [
        { id: 'c1', name: 'Math', day: 0 },   // Mon
        { id: 'c2', name: 'Sci', day: 2 },    // Wed
        { id: 'c3', name: 'Eng', day: 4 }     // Fri
      ];

      const log = {};

      // Phase 1: All sessions marked present (13 total MWF sessions in Aug 2026: Aug 3,5,7,10,12,14,17,19,21,24,26,28,31)
      const dates = [
        '2026-08-03_c1', '2026-08-05_c2', '2026-08-07_c3',
        '2026-08-10_c1', '2026-08-12_c2', '2026-08-14_c3',
        '2026-08-17_c1', '2026-08-19_c2', '2026-08-21_c3',
        '2026-08-24_c1', '2026-08-26_c2', '2026-08-28_c3',
        '2026-08-31_c1'
      ];

      dates.forEach(key => { log[key] = { status: 'present' }; });

      let stats = calculateAttendanceStats(classes, log, startDate, endDate, currentDate);
      assert.strictEqual(stats.totalLogged, 13);
      assert.strictEqual(stats.presentCount, 13);
      assert.strictEqual(stats.absentCount, 0);
      assert.strictEqual(stats.percentage, 100);

      // Phase 2: Toggle 3 to 'absent', 2 to 'cancelled'
      log['2026-08-03_c1'] = { status: 'absent' };
      log['2026-08-05_c2'] = { status: 'absent' };
      log['2026-08-07_c3'] = { status: 'absent' };
      log['2026-08-10_c1'] = { status: 'cancelled' };
      log['2026-08-12_c2'] = { status: 'cancelled' };

      stats = calculateAttendanceStats(classes, log, startDate, endDate, currentDate);
      assert.strictEqual(stats.presentCount, 8);
      assert.strictEqual(stats.absentCount, 3);
      assert.strictEqual(stats.cancelledCount, 2);
      assert.strictEqual(stats.totalLogged, 11); // 8 present + 3 absent
      assert.strictEqual(stats.percentage, (8 / 11) * 100);

      // Phase 3: Toggle 3 absent back to present, remove 2 cancelled entries (making them pending/unlogged)
      log['2026-08-03_c1'] = { status: 'present' };
      log['2026-08-05_c2'] = { status: 'present' };
      log['2026-08-07_c3'] = { status: 'present' };
      delete log['2026-08-10_c1'];
      delete log['2026-08-12_c2'];

      stats = calculateAttendanceStats(classes, log, startDate, endDate, currentDate);
      assert.strictEqual(stats.presentCount, 11);
      assert.strictEqual(stats.absentCount, 0);
      assert.strictEqual(stats.cancelledCount, 0);
      assert.strictEqual(stats.totalLogged, 11);
      assert.strictEqual(stats.percentage, 100);

      // Phase 4: 100-cycle randomized toggling stress test
      const statuses = ['present', 'absent', 'cancelled', null];
      for (let i = 0; i < 100; i++) {
        const randomKey = dates[Math.floor(Math.random() * dates.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        if (randomStatus === null) {
          delete log[randomKey];
        } else {
          log[randomKey] = { status: randomStatus };
        }

        const runStats = calculateAttendanceStats(classes, log, startDate, endDate, currentDate);
        assert.strictEqual(runStats.totalLogged, runStats.presentCount + runStats.absentCount);
        assert(!isNaN(runStats.percentage), 'Attendance percentage must not be NaN');
        assert(runStats.percentage >= 0 && runStats.percentage <= 100, `Percentage out of bounds: ${runStats.percentage}`);
      }
    });

    test('5.4 Large requirement sets (100+ requirements, non-NaN validation)', () => {
      // 1. Subject with 150 requirements
      const requirements = [];
      for (let i = 1; i <= 150; i++) {
        requirements.push({
          id: `req_${i}`,
          title: `Assignment ${i}`,
          status: i <= 100 ? 'submitted' : 'pending'
        });
      }

      const largeSubject = {
        id: 'sub_large',
        name: 'Massive Data Processing',
        requirements
      };

      const taskProgress = calculateSubjectTaskProgress(largeSubject);
      assert.strictEqual(taskProgress.totalTasks, 150);
      assert.strictEqual(taskProgress.completedTasks, 100);
      assert.strictEqual(taskProgress.percentage, (100 / 150) * 100);
      assert(!isNaN(taskProgress.percentage));

      // 2. Large Calculator structure (10 periods * 5 comps * 20 items = 1000 items)
      const periods = [];
      for (let p = 1; p <= 10; p++) {
        const components = [];
        for (let c = 1; c <= 5; c++) {
          const items = [];
          for (let i = 1; i <= 20; i++) {
            items.push({
              id: `item_${p}_${c}_${i}`,
              name: `Item ${p}-${c}-${i}`,
              score: 80 + ((p + c + i) % 21),
              max: 100
            });
          }
          components.push({ id: `comp_${p}_${c}`, name: `Comp ${p}-${c}`, items });
        }
        periods.push({ id: `per_${p}`, name: `Period ${p}`, components });
      }

      const giantSubject = {
        id: 'sub_giant',
        name: 'Giant Subject',
        units: 5,
        passingPercent: 60,
        periods
      };

      const calcStart = Date.now();
      const calcResult = Calculator.calculateSubject(giantSubject, '1_IS_BEST');
      const calcDuration = Date.now() - calcStart;

      assert(!isNaN(calcResult.percent), 'Giant subject percent must not be NaN');
      assert(!isNaN(calcResult.equivalent), 'Giant subject equivalent grade must not be NaN');
      assert(calcDuration < 500, `Calculation took too long: ${calcDuration}ms`);
    });

    test('5.5 Empty state resilience (null/undefined inputs, 0 units, missing dates)', () => {
      // Hero stats with null data
      const nullHero = calculateDashboardHeroStats(null, null, null);
      assert.strictEqual(nullHero.semProgress.isValid, false);
      assert.strictEqual(nullHero.semGWA.percent, 0);
      assert.strictEqual(nullHero.yearGWA.percent, 0);
      assert.strictEqual(nullHero.attendance.totalLogged, 0);
      assert.strictEqual(nullHero.pendingTasks.pendingCount, 0);

      // Semester progress with null/undefined dates
      assert.strictEqual(calculateSemesterProgress(null, '2026-08-31').isValid, false);
      assert.strictEqual(calculateSemesterProgress('2026-08-01', undefined).isValid, false);
      assert.strictEqual(calculateSemesterProgress('invalid-date', '2026-08-31').isValid, false);

      // Attendance stats with null/undefined inputs
      const emptyAttendance = calculateAttendanceStats(null, null, null, null);
      assert.strictEqual(emptyAttendance.totalLogged, 0);
      assert.strictEqual(emptyAttendance.percentage, 0);

      // Subject progress with empty/null requirements
      assert.strictEqual(calculateSubjectTaskProgress(null).percentage, 0);
      assert.strictEqual(calculateSubjectTaskProgress({ requirements: [] }).percentage, 0);
      assert.strictEqual(calculateSubjectTaskProgress({ requirements: null }).percentage, 0);

      // Pending tasks with null/empty semester
      assert.strictEqual(calculatePendingTaskCount(null).pendingCount, 0);
      assert.strictEqual(calculatePendingTaskCount({ subjects: [] }).pendingCount, 0);
      assert.strictEqual(calculatePendingTaskCount({ subjects: null }).pendingCount, 0);

      // Calculator with 0 units
      const zeroUnitsSem = {
        id: 'sem_0',
        subjects: [
          { id: 'sub_1', units: 0, periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 100, max: 100 }] }] }] }
        ]
      };
      const semCalcRes = Calculator.calculateSemester(zeroUnitsSem, '1_IS_BEST');
      assert.strictEqual(semCalcRes.percent, 0);
      assert.strictEqual(semCalcRes.equivalent, 0);

      // Calculator cumulative with empty array
      const cumRes = Calculator.calculateCumulative([], '1_IS_BEST');
      assert.strictEqual(cumRes.percent, 0);
      assert.strictEqual(cumRes.equivalent, 0);
    });

  });
}
