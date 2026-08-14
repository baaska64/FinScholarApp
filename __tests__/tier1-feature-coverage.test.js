import assert from 'node:assert';
import { Calculator } from '../utils/calculator.js';
import {
  calculateSemesterProgress,
  calculateAttendanceStats,
  calculateSubjectTaskProgress,
  calculatePendingTaskCount
} from './helpers/dashboardCalculations.js';

export function runTier1Tests(describe, test) {
  describe('Tier 1: Feature Coverage (Core Dashboard Calculations)', () => {

    test('1.1 Semester Progress Bar calculation (mid-semester)', () => {
      const startDate = '2026-08-01';
      const endDate = '2026-08-31';
      // Aug 1 to Aug 31 is 30 full days elapsed out of 30 days total
      // Aug 16 at noon is exactly 50% elapsed
      const currentDate = new Date('2026-08-16T12:00:00');

      const result = calculateSemesterProgress(startDate, endDate, currentDate);

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.status, 'active');
      assert(result.percent > 48 && result.percent < 52, `Expected ~50%, got ${result.percent}%`);
    });

    test('1.2 Year GWA calculation across multiple semesters', () => {
      const system = '1_IS_BEST';
      const yearData = {
        id: 'yr_1',
        name: 'First Year',
        semesters: [
          {
            id: 'sem_1',
            subjects: [
              {
                id: 'sub_1',
                name: 'Math',
                units: 3,
                passingPercent: 60,
                periods: [
                  {
                    id: 'p1',
                    weight: 100,
                    components: [
                      {
                        id: 'c1',
                        weight: 100,
                        items: [{ id: 'i1', score: 90, max: 100 }]
                      }
                    ]
                  }
                ]
              },
              {
                id: 'sub_2',
                name: 'English',
                units: 3,
                passingPercent: 60,
                periods: [
                  {
                    id: 'p1',
                    weight: 100,
                    components: [
                      {
                        id: 'c1',
                        weight: 100,
                        items: [{ id: 'i1', score: 80, max: 100 }]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: 'sem_2',
            subjects: [
              {
                id: 'sub_3',
                name: 'Science',
                units: 4,
                passingPercent: 60,
                periods: [
                  {
                    id: 'p1',
                    weight: 100,
                    components: [
                      {
                        id: 'c1',
                        weight: 100,
                        items: [{ id: 'i1', score: 100, max: 100 }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = Calculator.calculateYear(yearData, system);

      // Total units: 3 + 3 + 4 = 10 units.
      // Math (3 units, 90% = 1.5 eq), English (3 units, 80% = 2.0 eq), Science (4 units, 100% = 1.0 eq)
      // Total percent = (90*3 + 80*3 + 100*4) / 10 = (270 + 240 + 400) / 10 = 91%
      assert.strictEqual(result.percent, 91);
      assert(result.equivalent > 1.0 && result.equivalent < 2.0, `Expected GWA equivalent between 1.0 and 2.0, got ${result.equivalent}`);
    });

    test('1.3 Sem GWA calculation across subjects in a semester', () => {
      const system = '1_IS_BEST';
      const semData = {
        id: 'sem_1',
        name: 'First Semester',
        subjects: [
          {
            id: 'sub_1',
            name: 'Programming 1',
            units: 4,
            passingPercent: 60,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 95, max: 100 }] }
                ]
              }
            ]
          },
          {
            id: 'sub_2',
            name: 'Data Structures',
            units: 3,
            passingPercent: 60,
            periods: [
              {
                id: 'p1',
                weight: 100,
                components: [
                  { id: 'c1', weight: 100, items: [{ id: 'i1', score: 85, max: 100 }] }
                ]
              }
            ]
          }
        ]
      };

      const result = Calculator.calculateSemester(semData, system);

      // Weighted percent: (95*4 + 85*3) / 7 = (380 + 255) / 7 = 635 / 7 = 90.714%
      assert(Math.abs(result.percent - 90.714) < 0.01, `Expected ~90.71%, got ${result.percent}%`);
      assert(result.equivalent > 1.0 && result.equivalent < 2.0, `Expected valid equivalent grade, got ${result.equivalent}`);
    });

    test('1.4 Attendance % calculation (Present vs Absent)', () => {
      const startDate = '2026-08-03'; // Monday
      const endDate = '2026-08-07';   // Friday
      const currentDate = new Date('2026-08-07T23:59:59');

      const classes = [
        { id: 'cls_1', name: 'CS 101', day: 0 }, // Monday
        { id: 'cls_2', name: 'Math 101', day: 1 }, // Tuesday
        { id: 'cls_3', name: 'CS 101', day: 2 }, // Wednesday
        { id: 'cls_4', name: 'Math 101', day: 3 }, // Thursday
        { id: 'cls_5', name: 'Lab 101', day: 4 } // Friday
      ];

      // 5 total sessions. 4 Present, 1 Absent.
      const attendanceLog = {
        '2026-08-03_cls_1': { status: 'present' },
        '2026-08-04_cls_2': { status: 'present' },
        '2026-08-05_cls_3': { status: 'absent' },
        '2026-08-06_cls_4': { status: 'present' },
        '2026-08-07_cls_5': { status: 'present' }
      };

      const stats = calculateAttendanceStats(classes, attendanceLog, startDate, endDate, currentDate);

      assert.strictEqual(stats.totalLogged, 5);
      assert.strictEqual(stats.presentCount, 4);
      assert.strictEqual(stats.absentCount, 1);
      assert.strictEqual(stats.percentage, 80); // (4/5)*100 = 80%
    });

    test('1.5 Subject task completion % calculation', () => {
      const subject = {
        id: 'sub_1',
        name: 'Database Systems',
        requirements: [
          { id: 'r1', title: 'ERD Assignment', status: 'submitted' },
          { id: 'r2', title: 'SQL Quiz', status: 'graded' },
          { id: 'r3', title: 'Normalization Lab', completed: true },
          { id: 'r4', title: 'Final Project', status: 'pending' }
        ]
      };

      const result = calculateSubjectTaskProgress(subject);

      assert.strictEqual(result.totalTasks, 4);
      assert.strictEqual(result.completedTasks, 3);
      assert.strictEqual(result.percentage, 75); // (3/4)*100 = 75%
    });

    test('1.6 Pending task count calculation across semester', () => {
      const semester = {
        id: 'sem_1',
        subjects: [
          {
            id: 'sub_1',
            name: 'Physics',
            requirements: [
              { id: 'r1', title: 'Lab Report 1', status: 'submitted' },
              { id: 'r2', title: 'Problem Set 1', status: 'pending' }
            ]
          },
          {
            id: 'sub_2',
            name: 'Chemistry',
            requirements: [
              { id: 'r3', title: 'Safety Quiz', status: 'graded' },
              { id: 'r4', title: 'Experiment Notes', status: 'in_progress' },
              { id: 'r5', title: 'Midterm Review', status: 'pending' }
            ]
          }
        ]
      };

      const result = calculatePendingTaskCount(semester);

      // r2, r4, r5 are pending (3 tasks)
      assert.strictEqual(result.pendingCount, 3);
      assert.strictEqual(result.pendingTasks.length, 3);
      assert.strictEqual(result.pendingTasks[0].title, 'Problem Set 1');
      assert.strictEqual(result.pendingTasks[1].title, 'Experiment Notes');
      assert.strictEqual(result.pendingTasks[2].title, 'Midterm Review');
    });

  });
}
