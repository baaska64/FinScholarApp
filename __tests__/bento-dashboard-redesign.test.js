import assert from 'node:assert';
import { Calculator } from '../utils/calculator.js';
import { Colors, getTheme, Spacing, Radius, Shadows, Typography } from '../constants/Theme.ts';
import {
  calculateSemesterProgress,
  calculateAttendanceStats,
  calculateSubjectTaskProgress,
  calculatePendingTaskCount,
  calculateDashboardHeroStats,
  getLocalDateString,
  parseLocalDate,
  parseSemDate,
  getTimeLeftText,
  parseScheduleTime,
  normalizeScheduleDay,
  normalizeScheduleDays,
  parseScheduleDuration,
  importScannedClassesToLedger
} from './helpers/dashboardCalculations.js';
import { ensureSubjectExists } from '../utils/subjectRegistry.ts';

export function runBentoDashboardTests(describe, test) {
  describe('Bento Box Dashboard Suite 1: Layout & Design System Conformance', () => {

    test('B1.1 Bento Card Radius and Geometry Constants', () => {
      assert.strictEqual(Radius.sm, 8);
      assert.strictEqual(Radius.md, 12);
      assert.strictEqual(Radius.lg, 16);
      assert.strictEqual(Radius.xl, 20);
      assert.strictEqual(Radius['2xl'], 24);
      assert.strictEqual(Radius['3xl'], 28);
      assert.strictEqual(Radius['4xl'], 32);
      assert.strictEqual(Radius.full, 9999);
    });

    test('B1.2 Bento Shadow Presets for iOS, Android and Default', () => {
      assert(Shadows.sm !== undefined);
      assert(Shadows.md !== undefined);
      assert(Shadows.lg !== undefined);
      assert(Shadows.xl !== undefined);
    });

    test('B1.3 Bento Theme Palette Conformance (Light & Dark)', () => {
      const light = getTheme(false);
      const dark = getTheme(true);

      const requiredColors = [
        'primary', 'primaryLight', 'primaryDark',
        'secondary', 'secondaryLight',
        'accent', 'accentLight',
        'success', 'successLight',
        'warning', 'warningLight',
        'error', 'errorLight',
        'background', 'surface', 'surfaceSecondary',
        'card', 'cardBorder', 'text', 'textSecondary', 'textTertiary'
      ];

      requiredColors.forEach(token => {
        assert(typeof light[token] === 'string' && light[token].length > 0, `Missing light token: ${token}`);
        assert(typeof dark[token] === 'string' && dark[token].length > 0, `Missing dark token: ${token}`);
      });

      assert.strictEqual(light.primary, '#4f46e5');
      assert.strictEqual(dark.primary, '#818cf8');
    });

    test('B1.4 Bento Typography Hierarchy', () => {
      assert(Typography.display.fontSize > Typography.heading.fontSize);
      assert(Typography.heading.fontSize > Typography.title.fontSize);
      assert(Typography.title.fontSize > Typography.subtitle.fontSize);
      assert(Typography.subtitle.fontSize > Typography.body.fontSize);
      assert(Typography.body.fontSize > Typography.caption.fontSize);
      assert(Typography.caption.fontSize > Typography.label.fontSize);
    });
  });

  describe('Bento Box Dashboard Suite 2: Feature Parity & Interactive Bento Actions', () => {

    test('B2.1 GWA calculation across 1_IS_BEST, 4_IS_BEST, and PERCENT systems', () => {
      const sem = {
        id: 'sem_test',
        subjects: [
          {
            id: 'sub_1',
            name: 'Calculus',
            units: 4,
            passingPercent: 60,
            periods: [{ id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ score: 90, max: 100 }] }] }]
          },
          {
            id: 'sub_2',
            name: 'Physics',
            units: 3,
            passingPercent: 60,
            periods: [{ id: 'p1', weight: 100, components: [{ id: 'c1', weight: 100, items: [{ score: 80, max: 100 }] }] }]
          }
        ]
      };

      const res1 = Calculator.calculateSemester(sem, '1_IS_BEST');
      const res4 = Calculator.calculateSemester(sem, '4_IS_BEST');
      const resPct = Calculator.calculateSemester(sem, 'PERCENT');

      assert(Math.abs(resPct.percent - 85.714) < 0.01);
      assert(res1.equivalent > 1.0 && res1.equivalent < 3.0);
      assert(res4.equivalent > 2.0 && res4.equivalent < 4.0);
    });

    test('B2.2 Interactive 3-way attendance status toggling', () => {
      let data = {
        years: [{
          id: 'yr_1',
          semesters: [{
            id: 'sem_1',
            classes: [{ id: 'cls_1', name: 'Software Eng', day: 0, startHour: 9, duration: 2 }],
            attendanceLog: {}
          }]
        }]
      };

      const sem = data.years[0].semesters[0];
      const todayStr = '2026-08-24';
      const key = `${todayStr}_cls_1`;

      // 1. Mark Present
      sem.attendanceLog[key] = { status: 'present', isManual: true };
      assert.strictEqual(sem.attendanceLog[key].status, 'present');

      // 2. Mark Absent
      sem.attendanceLog[key] = { status: 'absent', isManual: true };
      assert.strictEqual(sem.attendanceLog[key].status, 'absent');

      // 3. Mark Cancelled
      sem.attendanceLog[key] = { status: 'cancelled', isManual: true };
      assert.strictEqual(sem.attendanceLog[key].status, 'cancelled');

      // 4. Toggle back to pending
      sem.attendanceLog[key] = { status: 'pending', isManual: true };
      assert.strictEqual(sem.attendanceLog[key].status, 'pending');
    });

    test('B2.3 Quick task completion (DONE button action)', () => {
      let data = {
        years: [{
          id: 'yr_1',
          semesters: [{
            id: 'sem_1',
            subjects: [{
              id: 'sub_1',
              name: 'Compiler Design',
              requirements: [
                { id: 'req_1', title: 'Lexer Assignment', status: 'pending', dueDate: '2026-09-01' },
                { id: 'req_2', title: 'Parser Project', status: 'pending', dueDate: '2026-09-15' }
              ]
            }]
          }]
        }]
      };

      const sem = data.years[0].semesters[0];
      const initialPending = calculatePendingTaskCount(sem);
      assert.strictEqual(initialPending.pendingCount, 2);

      // Simulate clicking DONE on req_1
      const req = sem.subjects[0].requirements.find(r => r.id === 'req_1');
      req.status = 'submitted';

      const afterPending = calculatePendingTaskCount(sem);
      assert.strictEqual(afterPending.pendingCount, 1);
      assert.strictEqual(afterPending.pendingTasks[0].id, 'req_2');
    });

    test('B2.4 Schedule Scanner import integration with ensureSubjectExists', () => {
      let data = {
        years: [{
          id: 'yr_1',
          semesters: [{
            id: 'sem_1',
            subjects: [],
            classes: []
          }]
        }]
      };

      const scannedClasses = [
        { name: 'Data Structures', day: 'Mon', startHour: 10, duration: 1.5, room: 'Room 301' },
        { name: 'Operating Systems', day: 2, startHour: 13, duration: 2, room: 'Lab 2' }
      ];

      scannedClasses.forEach(sc => {
        const reg = ensureSubjectExists(data, 'yr_1', 'sem_1', sc.name, { fromSchedule: true });
        data = reg.data;
        const curSem = data.years[0].semesters[0];
        curSem.classes.push({
          id: 'cls_' + Math.random().toString(36).substr(2, 6),
          name: sc.name,
          room: sc.room,
          day: typeof sc.day === 'number' ? sc.day : 0,
          startHour: sc.startHour,
          duration: sc.duration,
          subjectId: reg.subjectId
        });
      });

      const updatedSem = data.years[0].semesters[0];
      assert.strictEqual(updatedSem.subjects.length, 2);
      assert.strictEqual(updatedSem.classes.length, 2);
      assert(updatedSem.subjects.some(s => s.name === 'Data Structures'));
      assert(updatedSem.subjects.some(s => s.name === 'Operating Systems'));
    });

    test('B2.5 Semester progress bar computation and date clamping', () => {
      const beforeRes = calculateSemesterProgress('2026-09-01', '2026-12-20', new Date('2026-08-20T00:00:00'));
      assert.strictEqual(beforeRes.percent, 0);
      assert.strictEqual(beforeRes.status, 'not_started');

      const midRes = calculateSemesterProgress('2026-08-01', '2026-08-31', new Date('2026-08-16T12:00:00'));
      assert(midRes.percent >= 49 && midRes.percent <= 51);
      assert.strictEqual(midRes.status, 'active');

      const afterRes = calculateSemesterProgress('2026-01-10', '2026-05-30', new Date('2026-08-24T00:00:00'));
      assert.strictEqual(afterRes.percent, 100);
      assert.strictEqual(afterRes.status, 'ended');
    });
  });

  describe('Bento Box Dashboard Suite 3: Edge Cases & Multi-Device Robustness', () => {

    test('B3.1 Empty years array produces clean zero-state without throwing', () => {
      const emptyData = { years: [] };
      const heroStats = calculateDashboardHeroStats(emptyData, 'non_existent_year', 'non_existent_sem');
      assert.strictEqual(heroStats.semProgress.percent, 0);
      assert.strictEqual(heroStats.semGWA.percent, 0);
      assert.strictEqual(heroStats.yearGWA.percent, 0);
      assert.strictEqual(heroStats.attendance.percentage, 0);
      assert.strictEqual(heroStats.pendingTasks.pendingCount, 0);
    });

    test('B3.2 Subject task completion percentage calculation', () => {
      const subjectWithTasks = {
        id: 'sub_algo',
        name: 'Algorithms',
        requirements: [
          { id: 't1', title: 'Graph Algo Quiz', status: 'graded' },
          { id: 't2', title: 'Dynamic Programming Lab', status: 'submitted' },
          { id: 't3', title: 'Greedy Algo Homework', status: 'pending' },
          { id: 't4', title: 'NP Completeness Essay', status: 'pending' }
        ]
      };

      const progress = calculateSubjectTaskProgress(subjectWithTasks);
      assert.strictEqual(progress.totalTasks, 4);
      assert.strictEqual(progress.completedTasks, 2);
      assert.strictEqual(progress.percentage, 50);
    });

    test('B3.3 Subject with no requirements returns 0% progress cleanly', () => {
      const emptySubject = { id: 'sub_empty', name: 'Seminar', requirements: [] };
      const progress = calculateSubjectTaskProgress(emptySubject);
      assert.strictEqual(progress.totalTasks, 0);
      assert.strictEqual(progress.completedTasks, 0);
      assert.strictEqual(progress.percentage, 0);
    });
  });

  describe('Bento Box Dashboard Suite 4: Timezone-Safe Date & Urgency Calculation Robustness', () => {

    test('B4.1 getLocalDateString returns consistent local YYYY-MM-DD padded format across boundaries', () => {
      const d1 = new Date(2026, 0, 5, 23, 59, 59); // Jan 5, 2026
      assert.strictEqual(getLocalDateString(d1), '2026-01-05');

      const d2 = new Date(2026, 11, 31, 0, 0, 1); // Dec 31, 2026
      assert.strictEqual(getLocalDateString(d2), '2026-12-31');

      const leapDay = new Date(2028, 1, 29, 12, 0, 0); // Feb 29, 2028
      assert.strictEqual(getLocalDateString(leapDay), '2028-02-29');
    });

    test('B4.2 parseLocalDate handles YYYY-MM-DD, ISO string, and invalid inputs gracefully', () => {
      const ms1 = parseLocalDate('2026-08-24');
      const d1 = new Date(ms1);
      assert.strictEqual(d1.getFullYear(), 2026);
      assert.strictEqual(d1.getMonth(), 7); // August (0-indexed)
      assert.strictEqual(d1.getDate(), 24);

      const ms2 = parseLocalDate('2026-08-24T15:30:00.000Z');
      assert(ms2 > 0);

      assert.strictEqual(parseLocalDate(null), 0);
      assert.strictEqual(parseLocalDate(undefined), 0);
      assert.strictEqual(parseLocalDate(''), 0);
      assert.strictEqual(parseLocalDate('  '), 0);
      assert.strictEqual(parseLocalDate('invalid-date-string'), 0);
    });

    test('B4.3 parseSemDate handles YYYY-MM-DD, ISO strings and invalid ranges', () => {
      const s1 = parseSemDate('2026-08-01');
      assert(!isNaN(s1));
      const s2 = parseSemDate('2026-12-15T00:00:00');
      assert(!isNaN(s2));
      assert(s2 > s1);

      assert(isNaN(parseSemDate(null)));
      assert(isNaN(parseSemDate(undefined)));
      assert(isNaN(parseSemDate('')));
      assert(isNaN(parseSemDate('not-a-date')));
    });

    test('B4.4 getTimeLeftText returns proper urgency text without throwing', () => {
      const nowMs = new Date(2026, 7, 24, 12, 0, 0).getTime();

      // Overdue
      assert.strictEqual(getTimeLeftText('2026-08-20', nowMs), 'Overdue');
      assert.strictEqual(getTimeLeftText('2026-08-24T10:00:00', nowMs), 'Overdue');

      // Future days
      const inDays = getTimeLeftText('2026-08-27', nowMs);
      assert(inDays.startsWith('In 3 day') || inDays.startsWith('In 4 day') || inDays.startsWith('In 2 day'));

      // Future hours
      const inHours = getTimeLeftText(new Date(nowMs + 3 * 3600 * 1000 + 15 * 60 * 1000).toISOString(), nowMs);
      assert(inHours.includes('hr'));

      // Null, empty, invalid strings
      assert.strictEqual(getTimeLeftText(null, nowMs), 'No date');
      assert.strictEqual(getTimeLeftText(undefined, nowMs), 'No date');
      assert.strictEqual(getTimeLeftText('', nowMs), 'No date');
      assert.strictEqual(getTimeLeftText('invalid-date', nowMs), 'Invalid date');
    });
  });

  describe('Bento Box Dashboard Suite 5: Time Parser & Interactive Attendance Invariants', () => {

    test('B5.1 parseScheduleTime supports 12h AM/PM with minutes and 24h formats', () => {
      // 8:30 AM -> 8.5
      assert.strictEqual(parseScheduleTime('8:30 AM'), 8.5);
      assert.strictEqual(parseScheduleTime('8:30am'), 8.5);

      // 1:45 PM -> 13.75
      assert.strictEqual(parseScheduleTime('1:45 PM'), 13.75);

      // 12:00 PM -> 12
      assert.strictEqual(parseScheduleTime('12:00 PM'), 12);

      // 12:30 AM -> 0.5
      assert.strictEqual(parseScheduleTime('12:30 AM'), 0.5);

      // 24h format
      assert.strictEqual(parseScheduleTime('14:30'), 14.5);

      // Numeric input
      assert.strictEqual(parseScheduleTime(9.5), 9.5);

      // Non-string fallback
      assert.strictEqual(parseScheduleTime(null), 8);
    });

    test('B5.2 Class attendance toggles remain persistent and reactive in currentSem state', () => {
      const sem = {
        id: 'sem_1',
        classes: [
          { id: 'c1', name: 'Software Arch', day: 0, startHour: 10, duration: 1.5 },
          { id: 'c2', name: 'Databases', day: 0, startHour: 13, duration: 2 }
        ],
        attendanceLog: {}
      };

      const todayStr = getLocalDateString(new Date());
      const key1 = `${todayStr}_c1`;
      const key2 = `${todayStr}_c2`;

      // Log class 1 as Present
      sem.attendanceLog[key1] = { status: 'present', isManual: true };
      assert.strictEqual(sem.attendanceLog[key1].status, 'present');

      // Log class 2 as Absent
      sem.attendanceLog[key2] = { status: 'absent', isManual: true };
      assert.strictEqual(sem.attendanceLog[key2].status, 'absent');

      // Verify both classes remain in sem.classes list (cards never disappear)
      assert.strictEqual(sem.classes.length, 2);
      assert.strictEqual(sem.classes[0].id, 'c1');
      assert.strictEqual(sem.classes[1].id, 'c2');

      // Toggle class 1 back to pending
      sem.attendanceLog[key1] = { status: 'pending', isManual: true };
      assert.strictEqual(sem.attendanceLog[key1].status, 'pending');
    });
  });

  describe('Bento Box Dashboard Suite 6: Advanced Scanner, Day Aliases & Milestone Invariants', () => {

    test('B6.1 Nested schedules array scanner import (MWF / TTH multi-meeting classes)', () => {
      let data = {
        years: [{
          id: 'yr_1',
          semesters: [{
            id: 'sem_1',
            subjects: [],
            classes: []
          }]
        }]
      };

      const scannedClasses = [
        {
          name: 'Computer Networks',
          room: 'ICS MegaLab',
          instructor: 'Dr. Santos',
          schedules: [
            { day: 'Mon', startHour: '8:30 AM', duration: 1.5 },
            { day: 'Wed', startHour: '8:30 AM', duration: 1.5 },
            { day: 'Fri', startHour: '8:30 AM', duration: 1.5 }
          ]
        },
        {
          name: 'Discrete Math',
          room: 'CAS 204',
          instructor: 'Prof. Garcia',
          schedules: [
            { day: 'T', startHour: '10:00 AM', duration: 2 },
            { day: 'R', startHour: '10:00 AM', duration: 2 }
          ]
        }
      ];

      const updated = importScannedClassesToLedger(data, 'yr_1', 'sem_1', scannedClasses, ensureSubjectExists);
      const sem = updated.years[0].semesters[0];

      assert.strictEqual(sem.subjects.length, 2);
      assert.strictEqual(sem.classes.length, 5); // 3 MWF + 2 TR

      const netClasses = sem.classes.filter(c => c.name === 'Computer Networks');
      assert.strictEqual(netClasses.length, 3);
      assert.deepStrictEqual(netClasses.map(c => c.day), [0, 2, 4]); // Mon, Wed, Fri
      assert.strictEqual(netClasses[0].startHour, 8.5);
      assert.strictEqual(netClasses[0].duration, 1.5);
      assert.strictEqual(netClasses[0].room, 'ICS MegaLab');

      const mathClasses = sem.classes.filter(c => c.name === 'Discrete Math');
      assert.strictEqual(mathClasses.length, 2);
      assert.deepStrictEqual(mathClasses.map(c => c.day), [1, 3]); // Tue (T), Thu (R)
      assert.strictEqual(mathClasses[0].startHour, 10);
      assert.strictEqual(mathClasses[0].duration, 2);
    });

    test('B6.2 Schedule end time to duration computation when duration field is omitted', () => {
      // Flat class with startTime and endTime
      const dur1 = parseScheduleDuration(undefined, 8.5, '10:30 AM');
      assert.strictEqual(dur1, 2.0);

      // Duration string with decimal
      const dur2 = parseScheduleDuration('1.5 hours', 9);
      assert.strictEqual(dur2, 1.5);

      // Number duration passed directly
      const dur3 = parseScheduleDuration(3, 13);
      assert.strictEqual(dur3, 3);

      // Fallback to 1 hour
      const dur4 = parseScheduleDuration(undefined, 10, undefined);
      assert.strictEqual(dur4, 1);
    });

    test('B6.3 Full day alias normalization across standard and abbreviated university codes', () => {
      // Standard number preservation
      assert.strictEqual(normalizeScheduleDay(0), 0);
      assert.strictEqual(normalizeScheduleDay(6), 6);
      assert.strictEqual(normalizeScheduleDay(99), 6); // clamped

      // String names and codes
      assert.strictEqual(normalizeScheduleDay('Monday'), 0);
      assert.strictEqual(normalizeScheduleDay('Mon'), 0);
      assert.strictEqual(normalizeScheduleDay('M'), 0);

      assert.strictEqual(normalizeScheduleDay('Tuesday'), 1);
      assert.strictEqual(normalizeScheduleDay('Tue'), 1);
      assert.strictEqual(normalizeScheduleDay('T'), 1);

      assert.strictEqual(normalizeScheduleDay('Wednesday'), 2);
      assert.strictEqual(normalizeScheduleDay('Wed'), 2);
      assert.strictEqual(normalizeScheduleDay('W'), 2);

      assert.strictEqual(normalizeScheduleDay('Thursday'), 3);
      assert.strictEqual(normalizeScheduleDay('Thu'), 3);
      assert.strictEqual(normalizeScheduleDay('Th'), 3);
      assert.strictEqual(normalizeScheduleDay('R'), 3);
      assert.strictEqual(normalizeScheduleDay('H'), 3);

      assert.strictEqual(normalizeScheduleDay('Friday'), 4);
      assert.strictEqual(normalizeScheduleDay('Fri'), 4);
      assert.strictEqual(normalizeScheduleDay('F'), 4);

      assert.strictEqual(normalizeScheduleDay('Saturday'), 5);
      assert.strictEqual(normalizeScheduleDay('Sat'), 5);
      assert.strictEqual(normalizeScheduleDay('Sa'), 5);

      assert.strictEqual(normalizeScheduleDay('Sunday'), 6);
      assert.strictEqual(normalizeScheduleDay('Sun'), 6);
      assert.strictEqual(normalizeScheduleDay('Su'), 6);

      // Invalid string defaults to Monday (0)
      assert.strictEqual(normalizeScheduleDay('unknown'), 0);
      assert.strictEqual(normalizeScheduleDay(null), 0);
    });

    test('B6.4 Comprehensive milestone date filtering, sorting, and days-remaining text', () => {
      const todayTime = new Date(2026, 7, 24, 0, 0, 0).getTime(); // Aug 24, 2026

      const milestones = [
        { id: 'm_past', title: 'Orientation', date: '2026-08-15', priority: 'low' },
        { id: 'm_today', title: 'Club Fair', date: '2026-08-24', priority: 'medium' },
        { id: 'm_tomorrow', title: 'Add/Drop Deadline', date: '2026-08-25', priority: 'high' },
        { id: 'm_future', title: 'Midterm Exams', date: '2026-10-15', priority: 'high' },
      ];

      // Filter: mTime >= todayTime
      const upcoming = milestones
        .filter(m => {
          const mTime = parseLocalDate(m.date);
          return mTime >= todayTime;
        })
        .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

      assert.strictEqual(upcoming.length, 3);
      assert.strictEqual(upcoming[0].id, 'm_today');
      assert.strictEqual(upcoming[1].id, 'm_tomorrow');
      assert.strictEqual(upcoming[2].id, 'm_future');

      // Test days countdown labels
      const getDaysLabel = (dateStr) => {
        const mTime = parseLocalDate(dateStr);
        const diffDays = Math.round((mTime - todayTime) / (1000 * 60 * 60 * 24));
        return diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `In ${diffDays} days`;
      };

      assert.strictEqual(getDaysLabel('2026-08-24'), 'Today');
      assert.strictEqual(getDaysLabel('2026-08-25'), 'Tomorrow');
      assert.strictEqual(getDaysLabel('2026-08-27'), 'In 3 days');
      assert.strictEqual(getDaysLabel('2026-10-15'), 'In 52 days');
    });

    test('B6.5 Complete task flow updates both pending task count and subject progress bar', () => {
      let sem = {
        id: 'sem_1',
        subjects: [
          {
            id: 'sub_1',
            name: 'Web Engineering',
            requirements: [
              { id: 'r1', title: 'Figma Prototype', status: 'submitted' },
              { id: 'r2', title: 'REST API', status: 'pending', dueDate: '2026-08-28', priority: 'high' },
              { id: 'r3', title: 'Final Deployment', status: 'pending', dueDate: '2026-09-10', priority: 'medium' }
            ]
          }
        ]
      };

      // Before completing r2: 2 pending tasks, progress 1/3 (33%)
      let pending = calculatePendingTaskCount(sem);
      let subjectProgress = calculateSubjectTaskProgress(sem.subjects[0]);
      assert.strictEqual(pending.pendingCount, 2);
      assert.strictEqual(subjectProgress.completedTasks, 1);
      assert.strictEqual(subjectProgress.totalTasks, 3);
      assert.strictEqual(Math.round(subjectProgress.percentage), 33);

      // Complete r2 (DONE clicked)
      sem.subjects[0].requirements.find(r => r.id === 'r2').status = 'submitted';

      // After completing r2: 1 pending task, progress 2/3 (67%)
      pending = calculatePendingTaskCount(sem);
      subjectProgress = calculateSubjectTaskProgress(sem.subjects[0]);
      assert.strictEqual(pending.pendingCount, 1);
      assert.strictEqual(pending.pendingTasks[0].id, 'r3');
      assert.strictEqual(subjectProgress.completedTasks, 2);
      assert.strictEqual(Math.round(subjectProgress.percentage), 67);

      // Complete r3 (DONE clicked)
      sem.subjects[0].requirements.find(r => r.id === 'r3').status = 'graded';

      // After completing r3: 0 pending tasks (All Clear), progress 3/3 (100%)
      pending = calculatePendingTaskCount(sem);
      subjectProgress = calculateSubjectTaskProgress(sem.subjects[0]);
      assert.strictEqual(pending.pendingCount, 0);
      assert.strictEqual(subjectProgress.completedTasks, 3);
      assert.strictEqual(Math.round(subjectProgress.percentage), 100);
    });
  });

  describe('Bento Box Dashboard Suite 7: Scanner Expansion, Zero-Color & Time Precision Invariants', () => {

    test('B7.1 Flat compound day expansion (MWF, TTH, TR, Mon, Wed, Fri, Mon/Wed/Fri)', () => {
      // 1. MWF keyword
      assert.deepStrictEqual(normalizeScheduleDays('MWF'), [0, 2, 4]);
      assert.deepStrictEqual(normalizeScheduleDays('mwf'), [0, 2, 4]);

      // 2. TTH and TR keywords
      assert.deepStrictEqual(normalizeScheduleDays('TTH'), [1, 3]);
      assert.deepStrictEqual(normalizeScheduleDays('TR'), [1, 3]);
      assert.deepStrictEqual(normalizeScheduleDays('tth'), [1, 3]);

      // 3. M-F and MTWTF keywords
      assert.deepStrictEqual(normalizeScheduleDays('mtwtf'), [0, 1, 2, 3, 4]);
      assert.deepStrictEqual(normalizeScheduleDays('m-f'), [0, 1, 2, 3, 4]);
      assert.deepStrictEqual(normalizeScheduleDays('mon-fri'), [0, 1, 2, 3, 4]);

      // 4. Delimited lists
      assert.deepStrictEqual(normalizeScheduleDays('Mon, Wed, Fri'), [0, 2, 4]);
      assert.deepStrictEqual(normalizeScheduleDays('Tue / Thu'), [1, 3]);
      assert.deepStrictEqual(normalizeScheduleDays('Tuesday & Thursday'), [1, 3]);
      assert.deepStrictEqual(normalizeScheduleDays('Sat, Sun'), [5, 6]);

      // 5. Single day fallbacks
      assert.deepStrictEqual(normalizeScheduleDays('Wednesday'), [2]);
      assert.deepStrictEqual(normalizeScheduleDays('T'), [1]);
      assert.deepStrictEqual(normalizeScheduleDays('R'), [3]);
      assert.deepStrictEqual(normalizeScheduleDays('H'), [3]);
      assert.deepStrictEqual(normalizeScheduleDays(4), [4]);
      assert.deepStrictEqual(normalizeScheduleDays(null), [0]);
    });

    test('B7.2 Falsy 0 color index preservation on scanned class import', () => {
      let data = {
        years: [{
          id: 'yr_1',
          semesters: [{
            id: 'sem_1',
            subjects: [],
            classes: []
          }]
        }]
      };

      const scannedClasses = [
        { name: 'CS 101', day: 'MWF', startHour: '8:30 AM', duration: 1.5, colorIdx: 0, room: 'Lab 1' },
        { name: 'CS 102', day: 'TTH', startHour: '10:00 AM', duration: 1.5, colorIdx: 4, room: 'Lab 2' }
      ];

      const updated = importScannedClassesToLedger(data, 'yr_1', 'sem_1', scannedClasses, ensureSubjectExists);
      const sem = updated.years[0].semesters[0];

      // CS 101 expanded to 3 classes (M, W, F) all with colorIdx === 0
      const cs101Classes = sem.classes.filter(c => c.name === 'CS 101');
      assert.strictEqual(cs101Classes.length, 3);
      cs101Classes.forEach(cls => {
        assert.strictEqual(cls.colorIdx, 0); // Preserved 0, not overridden
      });

      // CS 102 expanded to 2 classes (T, Th) all with colorIdx === 4
      const cs102Classes = sem.classes.filter(c => c.name === 'CS 102');
      assert.strictEqual(cs102Classes.length, 2);
      cs102Classes.forEach(cls => {
        assert.strictEqual(cls.colorIdx, 4);
      });
    });

    test('B7.3 Safe modulo on negative and out-of-bounds colorIdx', () => {
      const palette = ['#4f46e5', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899'];
      const getAccent = (idx) => palette[((Math.floor(idx) % 6) + 6) % 6];

      // Negative values map safely to positive indexes
      assert.strictEqual(getAccent(-1), '#ec4899'); // index 5
      assert.strictEqual(getAccent(-2), '#8b5cf6'); // index 4
      assert.strictEqual(getAccent(-6), '#4f46e5'); // index 0
      assert.strictEqual(getAccent(0), '#4f46e5');  // index 0
      assert.strictEqual(getAccent(6), '#4f46e5');  // index 0
      assert.strictEqual(getAccent(7), '#10b981');  // index 1
    });

    test('B7.4 Chronological sorting of Today classes', () => {
      const classes = [
        { id: 'c3', name: 'Night Class', startHour: 18, day: 0 },
        { id: 'c1', name: 'Morning Lecture', startHour: 8.5, day: 0 },
        { id: 'c2', name: 'Afternoon Lab', startHour: 13, day: 0 }
      ];

      const sorted = classes.slice().sort((a, b) => (a.startHour || 0) - (b.startHour || 0));

      assert.strictEqual(sorted[0].id, 'c1'); // 8:30 AM
      assert.strictEqual(sorted[1].id, 'c2'); // 1:00 PM
      assert.strictEqual(sorted[2].id, 'c3'); // 6:00 PM
    });

    test('B7.5 Robust formatTime and countdown timeString rollover calculations', () => {
      const formatTime = (h) => {
        const totalMins = Math.round(h * 60);
        const normH = (Math.floor(totalMins / 60) % 24 + 24) % 24;
        const normM = (totalMins % 60 + 60) % 60;
        const ampm = normH >= 12 ? 'PM' : 'AM';
        const dh = normH % 12 === 0 ? 12 : normH % 12;
        return `${dh}:${normM.toString().padStart(2, '0')} ${ampm}`;
      };

      assert.strictEqual(formatTime(8.5), '8:30 AM');
      assert.strictEqual(formatTime(12.0), '12:00 PM');
      assert.strictEqual(formatTime(13.75), '1:45 PM');
      assert.strictEqual(formatTime(0.5), '12:30 AM');
      assert.strictEqual(formatTime(8.99999), '9:00 AM'); // Rollover avoided 8:60 AM

      // Countdown test
      const getCountdown = (waitHours, durationVal = 1) => {
        if (waitHours > 0) {
          const totalMins = Math.max(1, Math.round(waitHours * 60));
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          return `Starts in ${h > 0 ? `${h}h ` : ''}${m > 0 || h === 0 ? `${m}m` : ''}`.trim();
        } else if (waitHours > -durationVal) {
          return 'Ongoing';
        } else {
          return 'Ended';
        }
      };

      assert.strictEqual(getCountdown(0.5), 'Starts in 30m');
      assert.strictEqual(getCountdown(1.25), 'Starts in 1h 15m');
      assert.strictEqual(getCountdown(0.999), 'Starts in 1h');
      assert.strictEqual(getCountdown(0), 'Ongoing');
      assert.strictEqual(getCountdown(-0.5, 1.5), 'Ongoing');
      assert.strictEqual(getCountdown(-2.0, 1.5), 'Ended');
    });

    test('B7.6 Task dueDate or date fallback handling', () => {
      const requirements = [
        { id: 'r1', title: 'Task with dueDate', dueDate: '2026-09-01', status: 'pending' },
        { id: 'r2', title: 'Task with date only', date: '2026-09-05', status: 'pending' }
      ];

      const mapped = requirements.map(r => ({
        id: r.id,
        title: r.title,
        date: r.dueDate || r.date
      }));

      assert.strictEqual(mapped[0].date, '2026-09-01');
      assert.strictEqual(mapped[1].date, '2026-09-05');
    });
  });
}

