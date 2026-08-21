import assert from 'node:assert';
import {
  parseDueDate,
  getTimeLeftText,
  getUrgencyColor,
  formatTimer,
  formatAMPM,
  sanitizeScore,
  triggerHaptic,
} from '../components/tasks/utils.ts';

export function runTasksRedesignTests(describe, test) {
  describe('Tasks & Pomodoro Redesign Suite 1: Timer & Formatters', () => {
    test('1.1 formatTimer handles standard minute-second intervals', () => {
      assert.strictEqual(formatTimer(0), '00:00');
      assert.strictEqual(formatTimer(9), '00:09');
      assert.strictEqual(formatTimer(60), '01:00');
      assert.strictEqual(formatTimer(65), '01:05');
      assert.strictEqual(formatTimer(1500), '25:00');
      assert.strictEqual(formatTimer(300), '05:00');
      assert.strictEqual(formatTimer(3600), '60:00');
      assert.strictEqual(formatTimer(-10), '00:00');
      assert.strictEqual(formatTimer(NaN), '00:00');
    });

    test('1.2 Timer progress percentage calculation and boundary clamping', () => {
      const calcProgress = (total, left) => {
        if (total <= 0) return 0;
        const raw = ((total - left) / total) * 100;
        return Math.min(100, Math.max(0, raw));
      };

      assert.strictEqual(calcProgress(1500, 1500), 0);
      assert.strictEqual(calcProgress(1500, 750), 50);
      assert.strictEqual(calcProgress(1500, 0), 100);
      assert.strictEqual(calcProgress(1500, -10), 100); // clamped at 100
      assert.strictEqual(calcProgress(0, 0), 0);
    });

    test('1.3 Quick +5m timer extension behavior', () => {
      let timeLeft = 1200; // 20 min
      timeLeft += 5 * 60;
      assert.strictEqual(timeLeft, 1500); // 25 min
    });

    test('1.4 formatAMPM formats 12-hour clock times accurately', () => {
      const morning = new Date(2026, 7, 16, 9, 5);
      assert.strictEqual(formatAMPM(morning), '9:05 AM');

      const noon = new Date(2026, 7, 16, 12, 0);
      assert.strictEqual(formatAMPM(noon), '12:00 PM');

      const night = new Date(2026, 7, 16, 23, 59);
      assert.strictEqual(formatAMPM(night), '11:59 PM');

      const midnight = new Date(2026, 7, 16, 0, 0);
      assert.strictEqual(formatAMPM(midnight), '12:00 AM');

      assert.strictEqual(formatAMPM(null), '');
      assert.strictEqual(formatAMPM(new Date(NaN)), '');
    });
  });

  describe('Tasks & Pomodoro Redesign Suite 2: Urgency Tickers & Countdown', () => {
    test('2.1 Correctly identifies overdue timestamps', () => {
      const now = 1700000000000;
      const pastIso = new Date(now - 10000).toISOString();
      assert.strictEqual(getTimeLeftText(pastIso, now), 'Overdue');

      const exactIso = new Date(now).toISOString();
      assert.strictEqual(getTimeLeftText(exactIso, now), 'Overdue');
    });

    test('2.2 Correctly calculates days, hours, minutes, and seconds countdowns', () => {
      const now = 1700000000000;
      // 3 days left
      const in3Days = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(getTimeLeftText(in3Days, now), '3 days left');

      // 1 day left
      const in1Day = new Date(now + 1 * 24 * 60 * 60 * 1000 + 1000).toISOString();
      assert.strictEqual(getTimeLeftText(in1Day, now), '1 day left');

      // 2 hours 15 mins left
      const in2Hrs = new Date(now + (2 * 60 + 15) * 60 * 1000).toISOString();
      assert.strictEqual(getTimeLeftText(in2Hrs, now), '2 hrs 15 mins left');

      // 45 mins 30 secs left
      const in45Mins = new Date(now + (45 * 60 + 30) * 1000).toISOString();
      assert.strictEqual(getTimeLeftText(in45Mins, now), '45m 30s left');

      // 25 seconds left
      const in25Secs = new Date(now + 25 * 1000).toISOString();
      assert.strictEqual(getTimeLeftText(in25Secs, now), '25s left');
    });

    test('2.3 Handles legacy YYYY-MM-DD dates gracefully', () => {
      const now = new Date(2026, 7, 16, 12, 0, 0).getTime();
      const legacyDateFuture = '2026-08-20';
      const result = getTimeLeftText(legacyDateFuture, now);
      assert.ok(result.includes('day'));

      const legacyDatePast = '2026-08-10';
      assert.strictEqual(getTimeLeftText(legacyDatePast, now), 'Overdue');
    });
  });

  describe('Tasks & Pomodoro Redesign Suite 3: Filtering, Search & Sorting', () => {
    const mockTasks = [
      { id: 't1', title: 'Math Problem Set', description: 'Calculus exercises', dueDate: '2026-08-20T10:00:00Z', priority: 'high', status: 'pending', subjectId: 's1', subjectName: 'Calculus' },
      { id: 't2', title: 'Physics Lab Report', description: 'Optics experiment write-up', dueDate: '2026-08-18T10:00:00Z', priority: 'medium', status: 'submitted', subjectId: 's2', subjectName: 'Physics' },
      { id: 't3', title: 'CS Coding Assignment', description: 'Binary search tree implementation', dueDate: '2026-08-25T10:00:00Z', priority: 'high', status: 'graded', subjectId: 's3', subjectName: 'Computer Science', earnedScore: 95, maxScore: 100 },
      { id: 't4', title: 'History Essay', description: 'World War 2 analysis', dueDate: '2026-08-15T10:00:00Z', priority: 'low', status: 'pending', subjectId: 's4', subjectName: 'History' },
      { id: 't5', title: 'No Deadline Task', description: 'Self reading', dueDate: '', priority: 'low', status: 'pending', subjectId: 's1', subjectName: 'Calculus' },
    ];

    const now = new Date('2026-08-16T12:00:00Z').getTime();

    test('3.1 Subject filtering', () => {
      const all = mockTasks.filter(t => true);
      assert.strictEqual(all.length, 5);

      const s1Only = mockTasks.filter(t => t.subjectId === 's1');
      assert.strictEqual(s1Only.length, 2);
      assert.strictEqual(s1Only[0].title, 'Math Problem Set');
    });

    test('3.2 Search query filtering across title, description, and subject', () => {
      const search = (q) => {
        const query = q.toLowerCase().trim();
        return mockTasks.filter(
          t => t.title.toLowerCase().includes(query) ||
               (t.description && t.description.toLowerCase().includes(query)) ||
               (t.subjectName && t.subjectName.toLowerCase().includes(query))
        );
      };

      assert.strictEqual(search('calculus').length, 2);
      assert.strictEqual(search('binary search').length, 1);
      assert.strictEqual(search('report').length, 1);
      assert.strictEqual(search('nonexistent').length, 0);
    });

    test('3.3 Status filtering including overdue detection', () => {
      const pending = mockTasks.filter(t => t.status === 'pending');
      assert.strictEqual(pending.length, 3);

      const submitted = mockTasks.filter(t => t.status === 'submitted');
      assert.strictEqual(submitted.length, 1);

      const graded = mockTasks.filter(t => t.status === 'graded');
      assert.strictEqual(graded.length, 1);

      const overdue = mockTasks.filter(t => {
        if (t.status !== 'pending') return false;
        const due = parseDueDate(t.dueDate);
        if (!due) return false;
        return due.getTime() <= now;
      });
      assert.strictEqual(overdue.length, 1);
      assert.strictEqual(overdue[0].id, 't4'); // History essay due Aug 15
    });

    test('3.4 Sorting by Due Date, Priority, Title, and Status', () => {
      // Due Date (soonest first, tasks with no date sorted to end)
      const sortByDate = [...mockTasks].sort((a, b) => {
        const timeA = parseDueDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const timeB = parseDueDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      });
      assert.strictEqual(sortByDate[0].id, 't4'); // Aug 15
      assert.strictEqual(sortByDate[3].id, 't3'); // Aug 25
      assert.strictEqual(sortByDate[4].id, 't5'); // No deadline -> sorted last

      // Priority (high -> medium -> low)
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const sortByPriority = [...mockTasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      assert.strictEqual(sortByPriority[0].priority, 'high');
      assert.strictEqual(sortByPriority[4].priority, 'low');

      // Title (A-Z)
      const sortByTitle = [...mockTasks].sort((a, b) => a.title.localeCompare(b.title));
      assert.strictEqual(sortByTitle[0].title, 'CS Coding Assignment');

      // Status (pending -> submitted -> graded)
      const statusOrder = { pending: 0, submitted: 1, graded: 2 };
      const sortByStatus = [...mockTasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
      assert.strictEqual(sortByStatus[0].status, 'pending');
      assert.strictEqual(sortByStatus[4].status, 'graded');
    });
  });

  describe('Tasks & Pomodoro Redesign Suite 4: Grade Ledger Synchronization', () => {
    const syncGradeItem = (subject, task) => {
      if (!subject || !subject.periods || !Array.isArray(subject.periods)) return;

      if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId)) {
        subject.periods.forEach((p) => {
          (p.components || []).forEach((c) => {
            if (c.items) {
              c.items = c.items.filter((it) => it.id !== task.gradeItemId);
            }
          });
        });
        task.gradeItemId = undefined;
      }

      if (task.status === 'graded' && task.linkedComponentId) {
        let found = false;
        subject.periods.forEach((p) => {
          (p.components || []).forEach((c) => {
            if (c.id === task.linkedComponentId) {
              if (!c.items) c.items = [];
              if (task.gradeItemId) {
                const item = c.items.find((it) => it.id === task.gradeItemId);
                if (item) {
                  item.name = task.title;
                  item.score = task.earnedScore;
                  item.max = task.maxScore;
                  found = true;
                }
              }
              if (!found) {
                const newGradeId = task.gradeItemId || 'grade_item_123';
                task.gradeItemId = newGradeId;
                c.items.push({
                  id: newGradeId,
                  name: task.title,
                  score: task.earnedScore,
                  max: task.maxScore,
                  subItems: [],
                });
                found = true;
              }
            } else if (task.gradeItemId && c.items) {
              c.items = c.items.filter((it) => it.id !== task.gradeItemId);
            }
          });
        });
      }
    };

    test('4.1 Adds new grade item when task transitions to graded with linked component', () => {
      const subject = {
        id: 's1',
        name: 'Math',
        periods: [
          {
            id: 'p1',
            name: 'Midterm',
            components: [
              { id: 'c1', name: 'Quizzes', items: [] },
            ],
          },
        ],
      };

      const task = {
        id: 't1',
        title: 'Quiz 1',
        status: 'graded',
        linkedComponentId: 'c1',
        earnedScore: 92,
        maxScore: 100,
      };

      syncGradeItem(subject, task);

      assert.ok(task.gradeItemId);
      const items = subject.periods[0].components[0].items;
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'Quiz 1');
      assert.strictEqual(items[0].score, 92);
      assert.strictEqual(items[0].max, 100);
    });

    test('4.2 Updates existing grade item when scores or title change', () => {
      const subject = {
        id: 's1',
        name: 'Math',
        periods: [
          {
            id: 'p1',
            name: 'Midterm',
            components: [
              {
                id: 'c1',
                name: 'Quizzes',
                items: [{ id: 'g1', name: 'Quiz 1', score: 85, max: 100, subItems: [{ name: 'Part A', score: 40 }] }],
              },
            ],
          },
        ],
      };

      const task = {
        id: 't1',
        title: 'Quiz 1 (Retake)',
        status: 'graded',
        linkedComponentId: 'c1',
        earnedScore: 98,
        maxScore: 100,
        gradeItemId: 'g1',
      };

      syncGradeItem(subject, task);

      const items = subject.periods[0].components[0].items;
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'Quiz 1 (Retake)');
      assert.strictEqual(items[0].score, 98);
      assert.strictEqual(items[0].subItems.length, 1); // Preserves existing subItems!
    });

    test('4.3 Removes grade item if task status changes from graded to submitted', () => {
      const subject = {
        id: 's1',
        name: 'Math',
        periods: [
          {
            id: 'p1',
            name: 'Midterm',
            components: [
              {
                id: 'c1',
                name: 'Quizzes',
                items: [{ id: 'g1', name: 'Quiz 1', score: 85, max: 100, subItems: [] }],
              },
            ],
          },
        ],
      };

      const task = {
        id: 't1',
        title: 'Quiz 1',
        status: 'submitted', // un-graded
        linkedComponentId: 'c1',
        gradeItemId: 'g1',
      };

      syncGradeItem(subject, task);

      assert.strictEqual(task.gradeItemId, undefined);
      const items = subject.periods[0].components[0].items;
      assert.strictEqual(items.length, 0);
    });

    test('4.4 Moves grade item cleanly when linkedComponentId changes to another component', () => {
      const subject = {
        id: 's1',
        name: 'Math',
        periods: [
          {
            id: 'p1',
            name: 'Midterm',
            components: [
              { id: 'c1', name: 'Quizzes', items: [{ id: 'g1', name: 'Project 1', score: 90, max: 100 }] },
              { id: 'c2', name: 'Projects', items: [] },
            ],
          },
        ],
      };

      const task = {
        id: 't1',
        title: 'Project 1',
        status: 'graded',
        linkedComponentId: 'c2', // Re-linked from c1 to c2
        gradeItemId: 'g1',
        earnedScore: 95,
        maxScore: 100,
      };

      syncGradeItem(subject, task);

      // Removed from c1
      assert.strictEqual(subject.periods[0].components[0].items.length, 0);
      // Added to c2 with updated score
      assert.strictEqual(subject.periods[0].components[1].items.length, 1);
      assert.strictEqual(subject.periods[0].components[1].items[0].id, 'g1');
      assert.strictEqual(subject.periods[0].components[1].items[0].score, 95);
    });

    test('4.5 Handles empty or malformed subject and period structures without throwing', () => {
      const emptySubject = { id: 's2', name: 'Empty' };
      const task = { id: 't2', title: 'Task', status: 'graded', linkedComponentId: 'c1' };

      // Should safely return without crash
      assert.doesNotThrow(() => syncGradeItem(emptySubject, task));
      assert.doesNotThrow(() => syncGradeItem(null, task));
      assert.doesNotThrow(() => syncGradeItem(undefined, task));
    });
  });

  describe('Tasks & Pomodoro Redesign Suite 5: Interactive Checklist Subtasks', () => {
    test('5.1 Checklist item creation, toggling and deletion', () => {
      let checklist = [];

      // Add item 1
      const item1 = { id: 'c1', text: 'Find references', completed: false };
      checklist = [...checklist, item1];
      assert.strictEqual(checklist.length, 1);
      assert.strictEqual(checklist[0].completed, false);

      // Toggle item 1
      checklist = checklist.map(c => c.id === 'c1' ? { ...c, completed: !c.completed } : c);
      assert.strictEqual(checklist[0].completed, true);

      // Add item 2
      const item2 = { id: 'c2', text: 'Write conclusion', completed: false };
      checklist = [...checklist, item2];
      assert.strictEqual(checklist.length, 2);

      const completedCount = checklist.filter(c => c.completed).length;
      assert.strictEqual(completedCount, 1);

      // Delete item 1
      checklist = checklist.filter(c => c.id !== 'c1');
      assert.strictEqual(checklist.length, 1);
      assert.strictEqual(checklist[0].id, 'c2');
    });
  });

  describe('Tasks & Pomodoro Redesign Suite 6: Edge Cases, Invalid Inputs & Urgency Colors', () => {
    test('6.1 Handles undefined, null, empty and malformed date strings safely', () => {
      const now = 1700000000000;
      assert.strictEqual(getTimeLeftText('', now), 'No Due Date');
      assert.strictEqual(getTimeLeftText(null, now), 'No Due Date');
      assert.strictEqual(getTimeLeftText(undefined, now), 'No Due Date');
      assert.strictEqual(getTimeLeftText('INVALID_DATE_STRING', now), 'No Due Date');
    });

    test('6.2 Urgency colors adapt correctly across dark and light modes', () => {
      const overdueDark = getUrgencyColor('Overdue', true);
      assert.strictEqual(overdueDark.text, '#ef4444');

      const urgentMinutesLight = getUrgencyColor('5m 20s left', false);
      assert.strictEqual(urgentMinutesLight.text, '#f97316');

      const urgentHoursDark = getUrgencyColor('3 hrs 10 mins left', true);
      assert.strictEqual(urgentHoursDark.text, '#f59e0b');

      const relaxedDaysLight = getUrgencyColor('5 days left', false);
      assert.strictEqual(relaxedDaysLight.text, '#16a34a');
    });

    test('6.3 PanResponder gesture activation predicate isolates horizontal swipes', () => {
      const shouldSetPanResponder = (dx, dy) => Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.8;

      // Pure vertical scroll (user scrolling list) -> false
      assert.strictEqual(shouldSetPanResponder(0, 50), false);
      assert.strictEqual(shouldSetPanResponder(5, 50), false);

      // Diagonal scroll -> false
      assert.strictEqual(shouldSetPanResponder(25, 20), false);

      // Definite horizontal swipe -> true
      assert.strictEqual(shouldSetPanResponder(40, 5), true);
      assert.strictEqual(shouldSetPanResponder(-40, 0), true);

      // Small jitter below threshold -> false
      assert.strictEqual(shouldSetPanResponder(10, 0), false);
    });

    test('6.4 Subject filter fallback when subject is deleted or semester switched', () => {
      const currentSubjects = [{ id: 's1', name: 'Math' }, { id: 's2', name: 'Science' }];
      let activeFilter = 's_deleted';

      if (activeFilter !== 'ALL' && currentSubjects.length > 0 && !currentSubjects.some(s => s.id === activeFilter)) {
        activeFilter = 'ALL';
      }
      assert.strictEqual(activeFilter, 'ALL');

      // Preserves valid existing filter
      let validFilter = 's2';
      if (validFilter !== 'ALL' && currentSubjects.length > 0 && !currentSubjects.some(s => s.id === validFilter)) {
        validFilter = 'ALL';
      }
      assert.strictEqual(validFilter, 's2');
    });

    test('6.5 parseDueDate comprehensive parsing matrix', () => {
      assert.strictEqual(parseDueDate(null), null);
      assert.strictEqual(parseDueDate(undefined), null);
      assert.strictEqual(parseDueDate(''), null);
      assert.strictEqual(parseDueDate('   '), null);
      assert.strictEqual(parseDueDate('corrupted_timestamp'), null);

      // Legacy YYYY-MM-DD
      const legacy = parseDueDate('2026-08-20');
      assert.ok(legacy instanceof Date);
      assert.strictEqual(legacy.getFullYear(), 2026);
      assert.strictEqual(legacy.getMonth(), 7); // 0-indexed
      assert.strictEqual(legacy.getDate(), 20);
      assert.strictEqual(legacy.getHours(), 23);
      assert.strictEqual(legacy.getMinutes(), 59);

      // ISO Timestamp
      const iso = parseDueDate('2026-08-20T15:30:00.000Z');
      assert.ok(iso instanceof Date);
      assert.ok(!isNaN(iso.getTime()));
    });
  });

  describe('Tasks & Pomodoro Redesign Suite 7: Timer AppState, Drift Immunity & Invariants', () => {
    test('7.1 Background recovery calculates accurate time remaining across simulated suspension', () => {
      const initialTime = 25 * 60; // 1500s
      const startTime = Date.now();
      const targetEndTime = startTime + initialTime * 1000;

      // Simulate 10 minutes (600s) elapsed in background
      const simulatedResumeTime = startTime + 600 * 1000;
      const remainingSeconds = Math.max(0, Math.round((targetEndTime - simulatedResumeTime) / 1000));
      assert.strictEqual(remainingSeconds, 900); // exactly 15 minutes left
    });

    test('7.2 Timer extension with +5m updates targetEndTime and maintains bounded progress', () => {
      let focusDuration = 25 * 60;
      let timeLeft = 10 * 60;
      const targetEndTime = Date.now() + timeLeft * 1000;

      // Add 5m
      const extendedTargetEndTime = targetEndTime + 5 * 60 * 1000;
      const nextTimeLeft = timeLeft + 5 * 60;
      focusDuration = Math.max(focusDuration, nextTimeLeft);

      const progress = Math.min(100, Math.max(0, ((focusDuration - nextTimeLeft) / focusDuration) * 100));
      assert.strictEqual(nextTimeLeft, 15 * 60);
      assert.strictEqual(extendedTargetEndTime - targetEndTime, 300000);
      assert.ok(progress >= 0 && progress <= 100);
    });

    test('7.3 Pomodoro mode toggle updates labels and maintains preset integrity', () => {
      const getButtonText = (isRunning, mode) => {
        return isRunning ? 'Pause' : (mode === 'focus' ? 'Start Focus' : 'Start Break');
      };

      assert.strictEqual(getButtonText(false, 'focus'), 'Start Focus');
      assert.strictEqual(getButtonText(false, 'break'), 'Start Break');
      assert.strictEqual(getButtonText(true, 'focus'), 'Pause');
      assert.strictEqual(getButtonText(true, 'break'), 'Pause');
    });
  });

  describe('Tasks & Pomodoro Redesign Suite 8: Score Sanitization, Haptics & Edge Invariants', () => {
    test('8.1 sanitizeScore handles normal numbers, string numbers, decimals, boundaries and defaults', () => {
      assert.strictEqual(sanitizeScore(95, 0, false), 95);
      assert.strictEqual(sanitizeScore('88.5', 0, false), 88.5);
      assert.strictEqual(sanitizeScore('', 0, false), 0);
      assert.strictEqual(sanitizeScore(undefined, 0, false), 0);
      assert.strictEqual(sanitizeScore(null, 0, false), 0);
      assert.strictEqual(sanitizeScore(-15, 0, false), 0);
      assert.strictEqual(sanitizeScore('-25', 0, false), 0);
      assert.strictEqual(sanitizeScore(NaN, 0, false), 0);
      assert.strictEqual(sanitizeScore(Infinity, 0, false), 0);
      assert.strictEqual(sanitizeScore('invalid_str', 0, false), 0);

      // Max score with isMax=true enforcing > 0
      assert.strictEqual(sanitizeScore(0, 100, true), 100);
      assert.strictEqual(sanitizeScore(-50, 100, true), 100);
      assert.strictEqual(sanitizeScore('0', 100, true), 100);
      assert.strictEqual(sanitizeScore('75', 100, true), 75);
      assert.strictEqual(sanitizeScore(150, 100, true), 150);
    });

    test('8.2 triggerHaptic executes across all types without throwing', () => {
      assert.doesNotThrow(() => triggerHaptic('light'));
      assert.doesNotThrow(() => triggerHaptic('medium'));
      assert.doesNotThrow(() => triggerHaptic('success'));
      assert.doesNotThrow(() => triggerHaptic('warning'));
      assert.doesNotThrow(() => triggerHaptic(undefined));
    });

    test('8.3 Progress island stat computation handles all combination of tasks', () => {
      const computeStats = (tasks, nowMs) => {
        const total = tasks.length;
        const pending = tasks.filter((t) => t.status === 'pending').length;
        const submitted = tasks.filter((t) => t.status === 'submitted').length;
        const graded = tasks.filter((t) => t.status === 'graded').length;
        const completed = submitted + graded;
        const overdueCount = tasks.filter((t) => {
          if (t.status !== 'pending') return false;
          const due = parseDueDate(t.dueDate);
          if (!due) return false;
          return due.getTime() <= nowMs;
        }).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, pending, submitted, graded, completed, overdueCount, percent };
      };

      const now = 1700000000000;
      // Empty
      assert.deepStrictEqual(computeStats([], now), {
        total: 0, pending: 0, submitted: 0, graded: 0, completed: 0, overdueCount: 0, percent: 0,
      });

      // 100% completed
      const doneTasks = [
        { id: '1', status: 'submitted', dueDate: '2026-08-20' },
        { id: '2', status: 'graded', dueDate: '2026-08-21' },
      ];
      assert.strictEqual(computeStats(doneTasks, now).percent, 100);

      // Overdue
      const overdueTasks = [
        { id: '1', status: 'pending', dueDate: new Date(now - 10000).toISOString() },
        { id: '2', status: 'pending', dueDate: new Date(now + 100000).toISOString() },
      ];
      const stats = computeStats(overdueTasks, now);
      assert.strictEqual(stats.overdueCount, 1);
      assert.strictEqual(stats.pending, 2);
      assert.strictEqual(stats.percent, 0);
    });

    test('8.4 Subtask edge cases (empty checklist, special character texts, all completed)', () => {
      const task = {
        id: 't1',
        title: 'Adversarial Task',
        checklist: [
          { id: 'c1', text: '<script>alert(1)</script>', completed: true },
          { id: 'c2', text: '日本語のタスク & 📚 emojis', completed: true },
          { id: 'c3', text: '    Whitespace Trim Test    ', completed: false },
        ],
      };

      const checklist = task.checklist || [];
      const completedCount = checklist.filter((c) => c.completed).length;
      assert.strictEqual(completedCount, 2);
      assert.strictEqual(checklist.length, 3);
    });
  });
}
