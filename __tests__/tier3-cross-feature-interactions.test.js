import assert from 'node:assert';
import { Calculator } from '../utils/calculator.js';
import {
  calculateSemesterProgress,
  calculateAttendanceStats,
  calculateSubjectTaskProgress,
  calculatePendingTaskCount,
  calculateDashboardHeroStats
} from './helpers/dashboardCalculations.js';

export function runTier3Tests(describe, test) {
  describe('Tier 3: Cross-Feature Interactions & Dynamic State Updates', () => {

    test('3.1 Switching active years and semesters updates dashboard hero stats', () => {
      const fullData = {
        settings: { gradingSystem: '1_IS_BEST' },
        years: [
          {
            id: 'year_2025',
            name: 'First Year (2025-2026)',
            semesters: [
              {
                id: 'sem_2025_1',
                name: '1st Semester',
                startDate: '2025-08-01',
                endDate: '2025-12-15',
                subjects: [
                  {
                    id: 'sub_y1s1',
                    name: 'Intro to CS',
                    units: 3,
                    passingPercent: 60,
                    periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 100, max: 100 }] }] }],
                    requirements: [{ id: 'r1', title: 'HW 1', status: 'submitted' }]
                  }
                ]
              }
            ]
          },
          {
            id: 'year_2026',
            name: 'Second Year (2026-2027)',
            semesters: [
              {
                id: 'sem_2026_1',
                name: '1st Semester',
                startDate: '2026-08-01',
                endDate: '2026-12-15',
                subjects: [
                  {
                    id: 'sub_y2s1',
                    name: 'Algorithms',
                    units: 4,
                    passingPercent: 60,
                    periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 75, max: 100 }] }] }],
                    requirements: [{ id: 'r2', title: 'Algorithm Analysis', status: 'pending' }]
                  }
                ]
              }
            ]
          }
        ]
      };

      const currentDate = new Date('2026-08-15T12:00:00');

      // 1. Calculate stats for Year 2025 / Sem 1
      const stats2025 = calculateDashboardHeroStats(fullData, 'year_2025', 'sem_2025_1', currentDate);
      assert.strictEqual(stats2025.semGWA.percent, 100);
      assert.strictEqual(stats2025.semGWA.equivalent, 1.0);
      assert.strictEqual(stats2025.pendingTasks.pendingCount, 0);
      assert.strictEqual(stats2025.semProgress.status, 'ended'); // 2025 semester ended

      // 2. Switch context to Year 2026 / Sem 1
      const stats2026 = calculateDashboardHeroStats(fullData, 'year_2026', 'sem_2026_1', currentDate);
      assert.strictEqual(stats2026.semGWA.percent, 75);
      assert.strictEqual(stats2026.pendingTasks.pendingCount, 1);
      assert.strictEqual(stats2026.pendingTasks.pendingTasks[0].title, 'Algorithm Analysis');
      assert.strictEqual(stats2026.semProgress.status, 'active');
    });

    test('3.2 Toggling P/A/NC (Present / Absent / Cancelled) updates attendance log & stats', () => {
      const startDate = '2026-08-03';
      const endDate = '2026-08-07';
      const currentDate = new Date('2026-08-07T23:59:59');

      const classes = [
        { id: 'c1', name: 'Software Engineering', day: 0 }, // Mon
        { id: 'c2', name: 'Software Engineering', day: 2 }  // Wed
      ];

      // Initial attendance log: 2 sessions
      let attendanceLog = {
        '2026-08-03_c1': { status: 'present' },
        '2026-08-05_c2': { status: 'absent' }
      };

      // Initial stats: 1 Present, 1 Absent => 50%
      let stats = calculateAttendanceStats(classes, attendanceLog, startDate, endDate, currentDate);
      assert.strictEqual(stats.totalLogged, 2);
      assert.strictEqual(stats.presentCount, 1);
      assert.strictEqual(stats.absentCount, 1);
      assert.strictEqual(stats.percentage, 50);

      // Step 1: User toggles Wed class from Absent -> Present
      attendanceLog['2026-08-05_c2'] = { status: 'present', isManual: true };
      stats = calculateAttendanceStats(classes, attendanceLog, startDate, endDate, currentDate);
      assert.strictEqual(stats.presentCount, 2);
      assert.strictEqual(stats.absentCount, 0);
      assert.strictEqual(stats.percentage, 100);

      // Step 2: User toggles Mon class from Present -> Cancelled (NC - No Class)
      attendanceLog['2026-08-03_c1'] = { status: 'cancelled', isManual: true };
      stats = calculateAttendanceStats(classes, attendanceLog, startDate, endDate, currentDate);
      assert.strictEqual(stats.totalLogged, 1); // Cancelled class excluded from denominator
      assert.strictEqual(stats.presentCount, 1);
      assert.strictEqual(stats.cancelledCount, 1);
      assert.strictEqual(stats.percentage, 100); // 1 present out of 1 valid logged = 100%
    });

    test('3.3 Marking task DONE updates pending task count & subject progress synchronously', () => {
      const semester = {
        id: 'sem_1',
        subjects: [
          {
            id: 'sub_1',
            name: 'Web Development',
            requirements: [
              { id: 'req_1', title: 'HTML Layout', status: 'pending' },
              { id: 'req_2', title: 'CSS Grid', status: 'pending' },
              { id: 'req_3', title: 'React App', status: 'pending' }
            ]
          }
        ]
      };

      const subject = semester.subjects[0];

      // Initial state: 3 tasks pending, 0% subject progress
      let pending = calculatePendingTaskCount(semester);
      let progress = calculateSubjectTaskProgress(subject);
      assert.strictEqual(pending.pendingCount, 3);
      assert.strictEqual(progress.percentage, 0);

      // Action 1: Mark req_1 as submitted
      subject.requirements[0].status = 'submitted';
      pending = calculatePendingTaskCount(semester);
      progress = calculateSubjectTaskProgress(subject);
      assert.strictEqual(pending.pendingCount, 2);
      assert(Math.abs(progress.percentage - 33.333) < 0.1);

      // Action 2: Mark req_2 as graded
      subject.requirements[1].status = 'graded';
      pending = calculatePendingTaskCount(semester);
      progress = calculateSubjectTaskProgress(subject);
      assert.strictEqual(pending.pendingCount, 1);
      assert(Math.abs(progress.percentage - 66.666) < 0.1);

      // Action 3: Mark req_3 as completed: true
      subject.requirements[2].completed = true;
      pending = calculatePendingTaskCount(semester);
      progress = calculateSubjectTaskProgress(subject);
      assert.strictEqual(pending.pendingCount, 0);
      assert.strictEqual(progress.percentage, 100);
    });

  });
}
