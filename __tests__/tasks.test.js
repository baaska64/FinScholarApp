import assert from 'node:assert';
import {
  BUCKET_ORDER,
  checklistProgress,
  doneTasks,
  filterTasks,
  getDigest,
  getDueBucket,
  getTaskCounts,
  groupTasksByDue,
  isDone,
  sortTasks,
} from '../utils/taskModel.ts';

/** Fixed instant so every bucket boundary in this suite is deterministic. */
const NOW = new Date(2026, 8, 10, 14, 0, 0).getTime(); // Thu 10 Sep 2026, 2pm

const at = (y, m, d, h = 23, min = 59) => new Date(y, m, d, h, min, 0).toISOString();

function task(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    title: 'Task',
    description: '',
    dueDate: at(2026, 8, 10),
    priority: 'medium',
    status: 'pending',
    subjectId: 'sub1',
    subjectName: 'Data Structures',
    checklist: [],
    ...overrides,
  };
}

export function runTasksTests(describe, test) {
  describe('Tasks Suite 1: Due buckets', () => {
    test('TSK1.1 Overdue is measured against the instant, not the day', () => {
      // A task due at 11:59pm tonight is NOT overdue at 2pm — grouping it with
      // genuinely late work is what makes an "overdue" count untrustworthy.
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 10, 23, 59) }), NOW), 'today');
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 10, 13, 0) }), NOW), 'overdue');
      // Exactly now counts as due.
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 10, 14, 0) }), NOW), 'overdue');
    });

    test('TSK1.2 Tomorrow means the next calendar day, whatever the clock says', () => {
      // 25 hours away but the same calendar distance regardless of the hour.
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 11, 1, 0) }), NOW), 'tomorrow');
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 11, 23, 59) }), NOW), 'tomorrow');
    });

    test('TSK1.3 The week runs seven days out, then Later takes over', () => {
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 12) }), NOW), 'week');
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 17) }), NOW), 'week');
      assert.strictEqual(getDueBucket(task({ dueDate: at(2026, 8, 18) }), NOW), 'later');
      assert.strictEqual(getDueBucket(task({ dueDate: at(2027, 0, 1) }), NOW), 'later');
    });

    test('TSK1.4 A task with no usable due date lands in "none", never "overdue"', () => {
      assert.strictEqual(getDueBucket(task({ dueDate: undefined }), NOW), 'none');
      assert.strictEqual(getDueBucket(task({ dueDate: '' }), NOW), 'none');
      assert.strictEqual(getDueBucket(task({ dueDate: 'sometime' }), NOW), 'none');
    });

    test('TSK1.5 A legacy YYYY-MM-DD due date is read as end of that local day', () => {
      // Older tasks stored a bare date. Read as midnight it would look overdue
      // all day; `parseDueDate` puts it at 23:59:59 instead.
      assert.strictEqual(getDueBucket(task({ dueDate: '2026-09-10' }), NOW), 'today');
      assert.strictEqual(getDueBucket(task({ dueDate: '2026-09-09' }), NOW), 'overdue');
    });
  });

  describe('Tasks Suite 2: Grouping', () => {
    const mixed = [
      task({ id: 'late', dueDate: at(2026, 8, 1) }),
      task({ id: 'today', dueDate: at(2026, 8, 10) }),
      task({ id: 'tomorrow', dueDate: at(2026, 8, 11) }),
      task({ id: 'week', dueDate: at(2026, 8, 14) }),
      task({ id: 'later', dueDate: at(2026, 9, 30) }),
      task({ id: 'undated', dueDate: undefined }),
      task({ id: 'submitted', status: 'submitted', dueDate: at(2026, 8, 2) }),
      task({ id: 'graded', status: 'graded', dueDate: at(2026, 8, 3) }),
    ];

    test('TSK2.1 Groups come back in urgency order', () => {
      const groups = groupTasksByDue(mixed, NOW);
      assert.deepStrictEqual(groups.map(g => g.key), ['overdue', 'today', 'tomorrow', 'week', 'later', 'none']);
      // The order the UI renders is the order this file declares.
      groups.forEach(g => assert.ok(BUCKET_ORDER.includes(g.key)));
    });

    test('TSK2.2 EMPTY GROUPS DO NOT EXIST', () => {
      // The old screen rendered Pending / Submitted / Graded headings
      // unconditionally, so one submitted task produced two empty sections
      // complete with placeholder cards.
      const groups = groupTasksByDue([task({ id: 'only', dueDate: at(2026, 8, 14) })], NOW);
      assert.strictEqual(groups.length, 1);
      assert.strictEqual(groups[0].key, 'week');
      assert.deepStrictEqual(groupTasksByDue([], NOW), []);
      groups.forEach(g => assert.ok(g.tasks.length > 0));
    });

    test('TSK2.3 Finished tasks are kept out of the due timeline', () => {
      const groups = groupTasksByDue(mixed, NOW);
      const ids = groups.flatMap(g => g.tasks.map(t => t.id));
      assert.ok(!ids.includes('submitted'), 'submitted work is not "overdue"');
      assert.ok(!ids.includes('graded'));
      assert.strictEqual(ids.length, 6);
    });

    test('TSK2.4 Every unfinished task lands in exactly one group', () => {
      const groups = groupTasksByDue(mixed, NOW);
      const ids = groups.flatMap(g => g.tasks.map(t => t.id));
      assert.strictEqual(new Set(ids).size, ids.length, 'no task appears twice');
      const unfinished = mixed.filter(t => !isDone(t)).length;
      assert.strictEqual(ids.length, unfinished, 'nothing is dropped');
    });

    test('TSK2.5 Done tasks come back most recently due first', () => {
      const finished = doneTasks(mixed);
      assert.deepStrictEqual(finished.map(t => t.id), ['graded', 'submitted']);
      assert.ok(finished.every(isDone));
    });
  });

  describe('Tasks Suite 3: Counts and the digest line', () => {
    test('TSK3.1 Counts split by status and flag what is late or due today', () => {
      const counts = getTaskCounts(
        [
          task({ dueDate: at(2026, 8, 1) }),
          task({ dueDate: at(2026, 8, 10) }),
          task({ dueDate: at(2026, 8, 20) }),
          task({ status: 'submitted', dueDate: at(2026, 8, 1) }),
          task({ status: 'graded', dueDate: at(2026, 8, 1) }),
        ],
        NOW,
      );
      assert.strictEqual(counts.total, 5);
      assert.strictEqual(counts.pending, 3);
      assert.strictEqual(counts.submitted, 1);
      assert.strictEqual(counts.graded, 1);
      assert.strictEqual(counts.overdue, 1);
      assert.strictEqual(counts.dueToday, 1);
      assert.strictEqual(counts.completionPercent, 40);
    });

    test('TSK3.2 A submitted task that is past its date is not counted as overdue', () => {
      const counts = getTaskCounts([task({ status: 'submitted', dueDate: at(2020, 0, 1) })], NOW);
      assert.strictEqual(counts.overdue, 0);
      assert.strictEqual(counts.completionPercent, 100);
    });

    test('TSK3.3 An empty term reports 0%, never NaN', () => {
      const counts = getTaskCounts([], NOW);
      assert.strictEqual(counts.completionPercent, 0);
      assert.strictEqual(Number.isFinite(counts.completionPercent), true);
    });

    test('TSK3.4 The digest states the single most urgent fact', () => {
      const of = (tasks) => getDigest(getTaskCounts(tasks, NOW));

      assert.deepStrictEqual(of([]), { headline: 'No tasks yet', tone: 'neutral' });

      // Overdue outranks everything else, including things due today.
      const urgent = of([task({ dueDate: at(2026, 8, 1) }), task({ dueDate: at(2026, 8, 10) })]);
      assert.strictEqual(urgent.headline, '1 task overdue');
      assert.strictEqual(urgent.tone, 'danger');

      assert.strictEqual(of([task({ dueDate: at(2026, 8, 10) })]).headline, '1 task due today');
      assert.strictEqual(of([task({ dueDate: at(2026, 8, 20) })]).headline, '1 task to go');
      assert.strictEqual(of([task({ status: 'graded' })]).headline, 'All caught up');
    });

    test('TSK3.5 The digest pluralises', () => {
      const many = getDigest(getTaskCounts([task({ dueDate: at(2026, 8, 1) }), task({ dueDate: at(2026, 8, 2) })], NOW));
      assert.strictEqual(many.headline, '2 tasks overdue');
    });
  });

  describe('Tasks Suite 4: Filtering and sorting', () => {
    const list = [
      task({ id: 'a', title: 'Lab report', subjectId: 's1', subjectName: 'Physics', priority: 'low', dueDate: at(2026, 8, 20) }),
      task({ id: 'b', title: 'Essay draft', subjectId: 's2', subjectName: 'History', priority: 'high', dueDate: at(2026, 8, 14) }),
      task({ id: 'c', title: 'Quiz', subjectId: 's1', subjectName: 'Physics', status: 'submitted', dueDate: at(2026, 8, 1) }),
      task({ id: 'd', title: 'Old exam', subjectId: 's1', subjectName: 'Physics', dueDate: at(2026, 8, 1) }),
    ];

    test('TSK4.1 Subject, status and search compose', () => {
      assert.strictEqual(filterTasks(list, { subjectId: 's1' }, NOW).length, 3);
      assert.strictEqual(filterTasks(list, { status: 'submitted' }, NOW).length, 1);
      assert.deepStrictEqual(
        filterTasks(list, { subjectId: 's1', status: 'pending' }, NOW).map(t => t.id),
        ['a', 'd'],
      );
    });

    test('TSK4.2 The overdue filter means pending AND late', () => {
      const overdue = filterTasks(list, { status: 'overdue' }, NOW);
      // 'c' is also past its date but has been submitted, so it is not late.
      assert.deepStrictEqual(overdue.map(t => t.id), ['d']);
    });

    test('TSK4.3 Search covers title and subject, case-insensitively', () => {
      assert.deepStrictEqual(filterTasks(list, { query: 'ESSAY' }, NOW).map(t => t.id), ['b']);
      assert.strictEqual(filterTasks(list, { query: 'physics' }, NOW).length, 3);
      assert.strictEqual(filterTasks(list, { query: '   ' }, NOW).length, 4);
      assert.strictEqual(filterTasks(list, { query: 'zzz' }, NOW).length, 0);
    });

    test('TSK4.4 Sorting never reorders the caller\'s array', () => {
      const snapshot = list.map(t => t.id);
      sortTasks(list, 'title');
      assert.deepStrictEqual(list.map(t => t.id), snapshot);
    });

    test('TSK4.5 Undated tasks sink to the bottom of a due-date sort', () => {
      const withUndated = [...list, task({ id: 'undated', dueDate: undefined })];
      const sorted = sortTasks(withUndated, 'dueDate');
      assert.strictEqual(sorted[sorted.length - 1].id, 'undated');
    });

    test('TSK4.6 Priority sort breaks ties chronologically', () => {
      // Two mediums with different dates must not come back in arbitrary order.
      const sorted = sortTasks(
        [
          task({ id: 'later-medium', priority: 'medium', dueDate: at(2026, 8, 25) }),
          task({ id: 'high', priority: 'high', dueDate: at(2026, 8, 28) }),
          task({ id: 'soon-medium', priority: 'medium', dueDate: at(2026, 8, 12) }),
        ],
        'priority',
      );
      assert.deepStrictEqual(sorted.map(t => t.id), ['high', 'soon-medium', 'later-medium']);
    });

    test('TSK4.7 Title sort is alphabetical', () => {
      assert.deepStrictEqual(sortTasks(list, 'title').map(t => t.title), [
        'Essay draft',
        'Lab report',
        'Old exam',
        'Quiz',
      ]);
    });
  });

  describe('Tasks Suite 5: Checklist progress', () => {
    test('TSK5.1 Counts completed subtasks', () => {
      const withList = task({
        checklist: [
          { id: '1', text: 'a', completed: true },
          { id: '2', text: 'b', completed: false },
          { id: '3', text: 'c', completed: true },
        ],
      });
      assert.deepStrictEqual(checklistProgress(withList), { done: 2, total: 3 });
    });

    test('TSK5.2 A missing or malformed checklist is zero of zero, not a crash', () => {
      assert.deepStrictEqual(checklistProgress(task({ checklist: undefined })), { done: 0, total: 0 });
      assert.deepStrictEqual(checklistProgress(task({ checklist: null })), { done: 0, total: 0 });
      assert.deepStrictEqual(checklistProgress(task({ checklist: 'nope' })), { done: 0, total: 0 });
    });
  });
}
