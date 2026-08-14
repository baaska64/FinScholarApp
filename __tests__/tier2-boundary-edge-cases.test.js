import assert from 'node:assert';
import { Calculator } from '../utils/calculator.js';
import {
  calculateSemesterProgress,
  calculateAttendanceStats,
  calculateSubjectTaskProgress,
  calculatePendingTaskCount,
  calculateDashboardHeroStats
} from './helpers/dashboardCalculations.js';

export function runTier2Tests(describe, test) {
  describe('Tier 2: Boundary & Edge Cases', () => {

    test('2.1 Zero (0) subjects in semester', () => {
      const emptySem = {
        id: 'sem_empty',
        name: 'Empty Semester',
        subjects: []
      };

      const semRes = Calculator.calculateSemester(emptySem, '1_IS_BEST');
      assert.strictEqual(semRes.percent, 0);
      assert.strictEqual(semRes.equivalent, 0);
      assert.strictEqual(Number.isNaN(semRes.percent), false);
      assert.strictEqual(Number.isNaN(semRes.equivalent), false);

      const pending = calculatePendingTaskCount(emptySem);
      assert.strictEqual(pending.pendingCount, 0);
    });

    test('2.2 Zero (0) units in subjects / semester', () => {
      const zeroUnitsSem = {
        id: 'sem_zero_units',
        name: 'Zero Units Semester',
        subjects: [
          {
            id: 'sub_audit1',
            name: 'Audit Course 1',
            units: 0,
            passingPercent: 60,
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
            id: 'sub_audit2',
            name: 'Audit Course 2',
            units: 0,
            passingPercent: 60,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 90, max: 100 }] }
                ]
              }
            ]
          }
        ]
      };

      const res = Calculator.calculateSemester(zeroUnitsSem, '1_IS_BEST');
      assert.strictEqual(res.percent, 0, 'Zero units semester percent should be 0 without NaN');
      assert.strictEqual(res.equivalent, 0, 'Zero units semester equivalent should be 0 without NaN');
      assert.strictEqual(Number.isNaN(res.percent), false);
      assert.strictEqual(Number.isNaN(res.equivalent), false);

      const yrData = {
        id: 'yr_1',
        semesters: [zeroUnitsSem]
      };
      const yrRes = Calculator.calculateYear(yrData, '1_IS_BEST');
      assert.strictEqual(yrRes.percent, 0);
      assert.strictEqual(yrRes.equivalent, 0);
    });

    test('2.3 Missing start or end dates for semester progress', () => {
      const res1 = calculateSemesterProgress(undefined, '2026-12-15');
      assert.strictEqual(res1.percent, 0);
      assert.strictEqual(res1.isValid, false);
      assert.strictEqual(res1.status, 'missing_dates');

      const res2 = calculateSemesterProgress('2026-08-01', null);
      assert.strictEqual(res2.percent, 0);
      assert.strictEqual(res2.isValid, false);
      assert.strictEqual(res2.status, 'missing_dates');

      const res3 = calculateSemesterProgress('', '');
      assert.strictEqual(res3.percent, 0);
      assert.strictEqual(res3.isValid, false);
    });

    test('2.4 Current date before semester start date (0% progress)', () => {
      const startDate = '2026-09-01';
      const endDate = '2026-12-15';
      const beforeStart = new Date('2026-08-15T00:00:00');

      const res = calculateSemesterProgress(startDate, endDate, beforeStart);

      assert.strictEqual(res.percent, 0);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.status, 'not_started');
      assert(res.daysUntil > 0, `Expected positive daysUntil, got ${res.daysUntil}`);
    });

    test('2.5 Current date after semester end date (100% progress)', () => {
      const startDate = '2026-01-15';
      const endDate = '2026-05-30';
      const afterEnd = new Date('2026-06-15T00:00:00');

      const res = calculateSemesterProgress(startDate, endDate, afterEnd);

      assert.strictEqual(res.percent, 100);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.status, 'ended');
    });

    test('2.6 Zero out of zero (0/0) subject requirements', () => {
      const subjectNoReqs = {
        id: 'sub_noreqs',
        name: 'Independent Study',
        requirements: []
      };

      const result = calculateSubjectTaskProgress(subjectNoReqs);

      assert.strictEqual(result.totalTasks, 0);
      assert.strictEqual(result.completedTasks, 0);
      assert.strictEqual(result.percentage, 0);
      assert.strictEqual(Number.isNaN(result.percentage), false, 'Subject task percentage should not be NaN when requirements count is 0');
    });

    test('2.7 Zero logged attendance sessions (0/0 logged classes)', () => {
      const classes = [{ id: 'c1', name: 'CS 101', day: 0 }];
      const emptyAttendanceLog = {};
      const startDate = '2026-08-01';
      const endDate = '2026-12-15';
      const currentDate = new Date('2026-08-01T00:00:00');

      const stats = calculateAttendanceStats(classes, emptyAttendanceLog, startDate, endDate, currentDate);

      assert.strictEqual(stats.totalLogged, 0);
      assert.strictEqual(stats.presentCount, 0);
      assert.strictEqual(stats.absentCount, 0);
      assert.strictEqual(stats.percentage, 0);
      assert.strictEqual(Number.isNaN(stats.percentage), false, 'Attendance percentage should not be NaN when zero classes are logged');
    });

  });
}
