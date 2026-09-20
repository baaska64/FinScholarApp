import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ORDER,
  addMonths,
  appDayIndex,
  buildDayChips,
  buildMonthMatrix,
  chunkWeeks,
  collectCalendarItems,
  daysBetweenKeys,
  filterItems,
  formatHour,
  getClassesForDate,
  getTermProgress,
  groupByDateKey,
  normalizeEventType,
  parseDateKey,
  pastItems,
  relativeDayLabel,
  sortItems,
  toDateKey,
  toDateKeyLoose,
  toMinutesOfDay,
  trimTrailingWeeks,
  upcomingItems,
} from '../utils/calendarModel.ts';
import { getEventIcon, getEventLabel, getEventTint } from '../components/calendar/calendarTheme.ts';

/**
 * A ledger shaped like the real one: two years, the second holding the active
 * term with classes, milestones and a subject carrying task deadlines.
 */
function makeLedger() {
  return {
    settings: {},
    years: [
      {
        id: 'y1',
        name: 'Year 1',
        semesters: [
          {
            id: 's1',
            name: 'Semester 1',
            startDate: '2025-01-06',
            endDate: '2025-05-16',
            subjects: [],
            classes: [],
            milestones: [{ id: 'old-1', title: 'Old orientation', date: '2025-01-06', type: 'enrollment' }],
          },
        ],
      },
      {
        id: 'y2',
        name: 'Year 2',
        semesters: [
          {
            id: 's2',
            name: 'Semester 1',
            startDate: '2025-08-11',
            endDate: '2025-12-19',
            // 0 = Monday. Two Monday classes and one Sunday class.
            classes: [
              { id: 'c1', name: 'CSIT227', day: 0, startHour: 13.5, duration: 1.5, room: 'GLE202', colorIdx: 0 },
              { id: 'c2', name: 'MATH101', day: 0, startHour: 8, duration: 1, room: 'NGE105', colorIdx: 1 },
              { id: 'c3', name: 'PE205', day: 6, startHour: 7, duration: 2, colorIdx: 2 },
            ],
            subjects: [
              {
                id: 'sub1',
                name: 'Data Structures',
                code: 'CSIT227',
                colorIdx: 0,
                requirements: [
                  { id: 't1', title: 'Lab report 3', dueDate: '2025-10-14T23:59:00', status: 'pending', priority: 'high' },
                  { id: 't2', title: 'Quiz makeup', dueDate: '2025-10-14T09:30:00', status: 'graded', priority: 'low' },
                  { id: 't3', title: 'No due date', status: 'pending' },
                ],
              },
            ],
            milestones: [
              { id: 'm1', title: 'Midterm exams', date: '2025-10-14', type: 'finals', note: 'Bring your ID' },
              { id: 'm2', title: 'Dropping deadline', date: '2025-10-20', type: 'drop_deadline' },
              { id: 'm3', title: 'Founders Day', date: '2025-10-14', type: 'holiday' },
              { id: 'm4', title: 'Legacy import', date: '2025-11-03', type: 'weird_unknown_type' },
            ],
          },
        ],
      },
    ],
  };
}

const ACTIVE = { activeYearId: 'y2', activeSemId: 's2' };

export function runCalendarTests(describe, test) {
  describe('Calendar Suite 1: Date keys never drift', () => {
    test('CAL1.1 toDateKey uses local parts, so it cannot shift the day', () => {
      // 00:30 local on Oct 14. `toISOString()` would report Oct 13 for anyone
      // east of UTC and this is exactly the bug the old screen shipped.
      const midnightish = new Date(2025, 9, 14, 0, 30, 0);
      assert.strictEqual(toDateKey(midnightish), '2025-10-14');

      const lateNight = new Date(2025, 9, 14, 23, 45, 0);
      assert.strictEqual(toDateKey(lateNight), '2025-10-14');
    });

    test('CAL1.2 parseDateKey round-trips and rejects impossible dates', () => {
      const parsed = parseDateKey('2025-10-14');
      assert.strictEqual(parsed.getFullYear(), 2025);
      assert.strictEqual(parsed.getMonth(), 9);
      assert.strictEqual(parsed.getDate(), 14);
      assert.strictEqual(toDateKey(parsed), '2025-10-14');

      // Date would roll 2025-02-31 forward into March; we refuse it instead.
      assert.strictEqual(parseDateKey('2025-02-31'), null);
      assert.strictEqual(parseDateKey('not a date'), null);
      assert.strictEqual(parseDateKey(''), null);
      assert.strictEqual(parseDateKey(null), null);
    });

    test('CAL1.3 toDateKeyLoose reads all three shapes the ledger stores', () => {
      // Milestones write a bare local day.
      assert.strictEqual(toDateKeyLoose('2025-10-14'), '2025-10-14');
      // Tasks write a full ISO timestamp; the local day is what matters.
      assert.strictEqual(toDateKeyLoose('2025-10-14T23:59:00'), '2025-10-14');
      // A Date object survives too.
      assert.strictEqual(toDateKeyLoose(new Date(2025, 9, 14)), '2025-10-14');
      // Junk is null, not a wrong date.
      assert.strictEqual(toDateKeyLoose(''), null);
      assert.strictEqual(toDateKeyLoose(null), null);
      assert.strictEqual(toDateKeyLoose(undefined), null);
      assert.strictEqual(toDateKeyLoose('tuesday-ish'), null);
      assert.strictEqual(toDateKeyLoose(42), null);
    });

    test('CAL1.4 toMinutesOfDay only reports a clock when one was stored', () => {
      assert.strictEqual(toMinutesOfDay('2025-10-14T09:30:00'), 9 * 60 + 30);
      // An all-day milestone has no clock, and must not be sorted as midnight.
      assert.strictEqual(toMinutesOfDay('2025-10-14'), null);
      assert.strictEqual(toMinutesOfDay(undefined), null);
    });

    test('CAL1.5 daysBetweenKeys survives a DST boundary', () => {
      assert.strictEqual(daysBetweenKeys('2025-10-14', '2025-10-20'), 6);
      assert.strictEqual(daysBetweenKeys('2025-10-20', '2025-10-14'), -6);
      assert.strictEqual(daysBetweenKeys('2025-10-14', '2025-10-14'), 0);
      // Spans a US DST change: 23-hour and 25-hour days must still count as 1.
      assert.strictEqual(daysBetweenKeys('2025-11-01', '2025-11-03'), 2);
      assert.strictEqual(daysBetweenKeys('2025-03-08', '2025-03-10'), 2);
      assert.strictEqual(daysBetweenKeys('bad', '2025-10-14'), null);
    });

    test('CAL1.6 addMonths steps by calendar month, never by 30 days', () => {
      // From Jan 31, naive date maths lands on Mar 3.
      const jan31 = new Date(2025, 0, 31);
      const feb = addMonths(jan31, 1);
      assert.strictEqual(feb.getMonth(), 1);
      assert.strictEqual(feb.getDate(), 1);

      const dec = addMonths(new Date(2025, 0, 15), -1);
      assert.strictEqual(dec.getFullYear(), 2024);
      assert.strictEqual(dec.getMonth(), 11);
    });
  });

  describe('Calendar Suite 2: Monday-first month matrix', () => {
    test('CAL2.1 appDayIndex is Monday-zero, matching class.day', () => {
      // 2025-10-13 is a Monday, 2025-10-19 the Sunday that ends that week.
      assert.strictEqual(appDayIndex(new Date(2025, 9, 13)), 0);
      assert.strictEqual(appDayIndex(new Date(2025, 9, 18)), 5);
      assert.strictEqual(appDayIndex(new Date(2025, 9, 19)), 6);
    });

    test('CAL2.2 Every month builds six rows — the most a month can ever span', () => {
      for (let month = 0; month < 12; month++) {
        assert.strictEqual(buildMonthMatrix(2025, month).length, 42);
      }
      // February 2021 started on a Monday and is exactly four weeks. Six are
      // still built; trimming, not counting, is what shortens the grid.
      assert.strictEqual(buildMonthMatrix(2021, 1).length, 42);
    });

    test('CAL2.3 The first cell is the Monday on or before the 1st', () => {
      // Oct 2025 starts on a Wednesday, so the grid opens on Mon Sep 29.
      const cells = buildMonthMatrix(2025, 9);
      assert.strictEqual(cells[0].key, '2025-09-29');
      assert.strictEqual(cells[0].inMonth, false);
      assert.strictEqual(cells[2].key, '2025-10-01');
      assert.strictEqual(cells[2].inMonth, true);

      // A month that already starts on Monday borrows nothing.
      const sep = buildMonthMatrix(2025, 8);
      assert.strictEqual(sep[0].key, '2025-09-01');
      assert.strictEqual(sep[0].inMonth, true);
    });

    test('CAL2.4 Cells are contiguous days with no gaps or repeats', () => {
      const cells = buildMonthMatrix(2026, 1);
      const keys = cells.map(c => c.key);
      assert.strictEqual(new Set(keys).size, 42);
      for (let i = 1; i < cells.length; i++) {
        assert.strictEqual(daysBetweenKeys(cells[i - 1].key, cells[i].key), 1);
      }
    });

    test('CAL2.5 Weekend flags land on columns 6 and 7, not 1 and 7', () => {
      const cells = buildMonthMatrix(2025, 9);
      // Column index 5 and 6 of every row are Saturday and Sunday.
      for (let row = 0; row < 6; row++) {
        assert.strictEqual(cells[row * 7 + 0].isWeekend, false, 'Monday is not a weekend');
        assert.strictEqual(cells[row * 7 + 5].isWeekend, true, 'Saturday is a weekend');
        assert.strictEqual(cells[row * 7 + 6].isWeekend, true, 'Sunday is a weekend');
      }
    });

    test('CAL2.6 trimTrailingWeeks drops rows that belong entirely to next month', () => {
      // September 2026 runs Mon Aug 31 – Sun Oct 4, so the sixth row is all
      // October and is pure wasted height.
      const sept = buildMonthMatrix(2026, 8);
      const trimmed = trimTrailingWeeks(sept);
      assert.strictEqual(sept.length, 42);
      assert.strictEqual(trimmed.length, 35);
      assert.strictEqual(trimmed[trimmed.length - 1].key, '2026-10-04');

      // A month that genuinely spans six weeks keeps all six: August 2026
      // opens on a Saturday and runs 31 days, so it needs 5 + 31 = 36 cells.
      assert.strictEqual(trimTrailingWeeks(buildMonthMatrix(2026, 7)).length, 42);
      // And a four-week February keeps exactly its four.
      assert.strictEqual(trimTrailingWeeks(buildMonthMatrix(2021, 1)).length, 28);
    });

    test('CAL2.7 Trimming never drops a day of the month itself', () => {
      for (let year = 2024; year <= 2027; year++) {
        for (let month = 0; month < 12; month++) {
          const trimmed = trimTrailingWeeks(buildMonthMatrix(year, month));
          const inMonth = trimmed.filter(c => c.inMonth).length;
          const expected = new Date(year, month + 1, 0).getDate();
          assert.strictEqual(inMonth, expected, `${year}-${month + 1} keeps every day`);
          assert.strictEqual(trimmed.length % 7, 0, 'rows stay whole');
          assert.ok(trimmed.length >= 28);
        }
      }
    });

    test('CAL2.8 isToday marks exactly one cell, and only when it is in range', () => {
      const today = new Date(2025, 9, 14);
      const cells = buildMonthMatrix(2025, 9, today);
      const marked = cells.filter(c => c.isToday);
      assert.strictEqual(marked.length, 1);
      assert.strictEqual(marked[0].key, '2025-10-14');

      const farAway = buildMonthMatrix(2030, 5, today);
      assert.strictEqual(farAway.filter(c => c.isToday).length, 0);
    });
  });

  describe('Calendar Suite 3: Reading the ledger', () => {
    test('CAL3.1 Events are collected from every term, not just the active one', () => {
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const events = items.filter(i => i.kind === 'event');
      assert.strictEqual(events.length, 5, 'four in Year 2 plus one in Year 1');

      const old = events.find(e => e.id === 'old-1');
      assert.strictEqual(old.isCurrentTerm, false);
      assert.strictEqual(old.yearName, 'Year 1');

      const midterm = events.find(e => e.id === 'm1');
      assert.strictEqual(midterm.isCurrentTerm, true);
      assert.strictEqual(midterm.semName, 'Semester 1');
    });

    test('CAL3.2 Task deadlines become calendar items; undated tasks do not', () => {
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const tasks = items.filter(i => i.kind === 'task');
      assert.strictEqual(tasks.length, 2, 't3 has no dueDate and is skipped');

      const lab = tasks.find(t => t.id === 't1');
      assert.strictEqual(lab.dateKey, '2025-10-14');
      assert.strictEqual(lab.minutes, 23 * 60 + 59);
      assert.strictEqual(lab.subjectCode, 'CSIT227');
      assert.strictEqual(lab.status, 'pending');
    });

    test('CAL3.3 includeTasks false leaves only events', () => {
      const items = collectCalendarItems(makeLedger(), { ...ACTIVE, includeTasks: false });
      assert.strictEqual(items.every(i => i.kind === 'event'), true);
    });

    test('CAL3.4 An unknown milestone type degrades to custom, it does not vanish', () => {
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const legacy = items.find(i => i.id === 'm4');
      assert.ok(legacy, 'the legacy import is still on the calendar');
      assert.strictEqual(legacy.type, 'custom');
    });

    test('CAL3.5 A missing, empty or malformed ledger yields an empty stream', () => {
      assert.deepStrictEqual(collectCalendarItems(null), []);
      assert.deepStrictEqual(collectCalendarItems({}), []);
      assert.deepStrictEqual(collectCalendarItems({ years: 'nope' }), []);
      assert.deepStrictEqual(collectCalendarItems({ years: [{ id: 'y', semesters: null }] }), []);
    });

    test('CAL3.6 A milestone with no id is dropped rather than becoming uneditable', () => {
      const ledger = makeLedger();
      ledger.years[1].semesters[0].milestones.push({ title: 'Ghost', date: '2025-10-15' });
      const items = collectCalendarItems(ledger, ACTIVE);
      assert.strictEqual(items.filter(i => i.title === 'Ghost').length, 0);
    });

    test('CAL3.7 Sorting is by date, then all-day first, then title', () => {
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const oct14 = items.filter(i => i.dateKey === '2025-10-14');
      // Two all-day events (Founders Day, Midterm exams) sort before the 9:30
      // quiz and the 23:59 lab report.
      assert.deepStrictEqual(oct14.map(i => i.title), [
        'Founders Day',
        'Midterm exams',
        'Quiz makeup',
        'Lab report 3',
      ]);
    });

    test('CAL3.8 All-day and timed items are separable, which the day view relies on', () => {
      // The day panel puts untimed items in a strip above the timeline, so
      // `minutes === null` has to mean exactly "no clock was stored".
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const oct14 = groupByDateKey(items)['2025-10-14'];
      const allDay = oct14.filter(i => i.minutes === null);
      const timed = oct14.filter(i => i.minutes !== null);

      assert.deepStrictEqual(allDay.map(i => i.title).sort(), ['Founders Day', 'Midterm exams']);
      assert.deepStrictEqual(timed.map(i => i.title), ['Quiz makeup', 'Lab report 3']);
      // Merging classes into that timeline compares minutes to startHour*60.
      assert.ok(timed.every(i => Number.isFinite(i.minutes)));
    });

    test('CAL3.9 groupByDateKey buckets without losing anything', () => {
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const grouped = groupByDateKey(items);
      assert.strictEqual(grouped['2025-10-14'].length, 4);
      assert.strictEqual(grouped['2025-10-20'].length, 1);
      assert.strictEqual(grouped['2025-12-25'], undefined);

      const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
      assert.strictEqual(total, items.length);
    });

    test('CAL3.10 sortItems does not mutate its input', () => {
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const snapshot = items.map(i => i.id);
      sortItems([...items].reverse());
      assert.deepStrictEqual(items.map(i => i.id), snapshot);
    });
  });

  describe('Calendar Suite 4: Classes land on the right days', () => {
    const sem = makeLedger().years[1].semesters[0];

    test('CAL4.1 Monday classes appear on Mondays, sorted by start time', () => {
      // 2025-10-13 is a Monday inside the term.
      const monday = getClassesForDate(sem, new Date(2025, 9, 13));
      assert.deepStrictEqual(monday.map(c => c.name), ['MATH101', 'CSIT227']);
      assert.strictEqual(monday[1].startHour, 13.5);
    });

    test('CAL4.2 day 6 is Sunday, not Saturday', () => {
      // The ledger indexes 0 = Monday, so a `day: 6` class meets on Sunday.
      assert.strictEqual(getClassesForDate(sem, new Date(2025, 9, 18)).length, 0, 'Saturday is empty');
      assert.deepStrictEqual(
        getClassesForDate(sem, new Date(2025, 9, 19)).map(c => c.name),
        ['PE205'],
        'Sunday holds the day-6 class',
      );
    });

    test('CAL4.3 Dates outside the term have no classes', () => {
      // A July Monday, months before the term opens on 2025-08-11.
      assert.deepStrictEqual(getClassesForDate(sem, new Date(2025, 6, 7)), []);
      // The day after the term ends.
      assert.deepStrictEqual(getClassesForDate(sem, new Date(2025, 11, 22)), []);
      // The boundary days themselves still meet.
      assert.strictEqual(getClassesForDate(sem, new Date(2025, 7, 11)).length, 2, 'first day of term is a Monday');
    });

    test('CAL4.4 With no term dates set, classes fall back to every matching weekday', () => {
      const open = { classes: sem.classes };
      assert.strictEqual(getClassesForDate(open, new Date(2030, 0, 7)).length, 2, 'a Monday in 2030');
    });

    test('CAL4.5 A semester with no classes, or a broken one, returns empty', () => {
      assert.deepStrictEqual(getClassesForDate(null, new Date()), []);
      assert.deepStrictEqual(getClassesForDate({}, new Date()), []);
      assert.deepStrictEqual(getClassesForDate({ classes: [] }, new Date()), []);
    });
  });

  describe('Calendar Suite 5: Term progress', () => {
    const sem = makeLedger().years[1].semesters[0]; // 2025-08-11 → 2025-12-19

    test('CAL5.1 Mid-term reports the right week, day and days left', () => {
      const progress = getTermProgress(sem, new Date(2025, 9, 14));
      assert.strictEqual(progress.state, 'active');
      assert.strictEqual(progress.totalDays, 131);
      assert.strictEqual(progress.totalWeeks, 19);
      // Aug 11 is day 1, so Oct 14 is day 65 and lands in week 10.
      assert.strictEqual(progress.dayNumber, 65);
      assert.strictEqual(progress.weekNumber, 10);
      assert.strictEqual(progress.daysLeft, 66);
      assert.ok(progress.percent > 0.4 && progress.percent < 0.55);
    });

    test('CAL5.2 The first and last day are inside the term', () => {
      const first = getTermProgress(sem, new Date(2025, 7, 11));
      assert.strictEqual(first.state, 'active');
      assert.strictEqual(first.dayNumber, 1);
      assert.strictEqual(first.weekNumber, 1);
      assert.strictEqual(first.percent, 0);

      const last = getTermProgress(sem, new Date(2025, 11, 19));
      assert.strictEqual(last.state, 'active');
      assert.strictEqual(last.daysLeft, 0);
      assert.strictEqual(last.percent, 1);
    });

    test('CAL5.3 Before and after the term have their own states', () => {
      const before = getTermProgress(sem, new Date(2025, 7, 1));
      assert.strictEqual(before.state, 'upcoming');
      assert.strictEqual(before.daysUntilStart, 10);

      const after = getTermProgress(sem, new Date(2025, 11, 20));
      assert.strictEqual(after.state, 'ended');
      assert.strictEqual(after.percent, 1);
    });

    test('CAL5.4 A half-set or backwards range reads as unset, never as NaN', () => {
      assert.strictEqual(getTermProgress({ startDate: '2025-08-11' }).state, 'unset');
      assert.strictEqual(getTermProgress({ endDate: '2025-12-19' }).state, 'unset');
      assert.strictEqual(getTermProgress({}).state, 'unset');
      assert.strictEqual(getTermProgress(null).state, 'unset');
      // End before start: refuse rather than reporting a negative term.
      const backwards = getTermProgress({ startDate: '2025-12-19', endDate: '2025-08-11' });
      assert.strictEqual(backwards.state, 'unset');
      assert.strictEqual(backwards.percent, 0);
    });

    test('CAL5.5 A one-day term does not divide by zero', () => {
      const single = getTermProgress({ startDate: '2025-08-11', endDate: '2025-08-11' }, new Date(2025, 7, 11));
      assert.strictEqual(single.totalDays, 1);
      assert.strictEqual(single.percent, 1);
      assert.strictEqual(Number.isFinite(single.percent), true);
    });
  });

  describe('Calendar Suite 6: Filtering and slicing', () => {
    const items = collectCalendarItems(makeLedger(), ACTIVE);

    test('CAL6.1 Scope "term" keeps only the active term', () => {
      const scoped = filterItems(items, { scope: 'term' });
      assert.strictEqual(scoped.every(i => i.isCurrentTerm), true);
      assert.strictEqual(scoped.find(i => i.id === 'old-1'), undefined);
      assert.strictEqual(filterItems(items, { scope: 'all' }).length, items.length);
    });

    test('CAL6.2 A type filter narrows events but never hides tasks', () => {
      const finalsOnly = filterItems(items, { types: ['finals'] });
      const events = finalsOnly.filter(i => i.kind === 'event');
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].title, 'Midterm exams');
      // Deadlines are not an event type, so a type filter must leave them be —
      // otherwise picking "Exams" would silently hide everything a student owes.
      assert.strictEqual(finalsOnly.filter(i => i.kind === 'task').length, 2);
    });

    test('CAL6.3 kinds excludes a whole class of item', () => {
      const eventsOnly = filterItems(items, { kinds: ['event'] });
      assert.strictEqual(eventsOnly.every(i => i.kind === 'event'), true);
    });

    test('CAL6.4 Search covers title, note and subject, case-insensitively', () => {
      assert.strictEqual(filterItems(items, { query: 'midterm' }).length, 1);
      assert.strictEqual(filterItems(items, { query: 'MIDTERM' }).length, 1);
      // "Bring your ID" is m1's note.
      assert.strictEqual(filterItems(items, { query: 'bring your' })[0].id, 'm1');
      // The subject code reaches its tasks.
      assert.strictEqual(filterItems(items, { query: 'csit' }).length, 2);
      assert.strictEqual(filterItems(items, { query: '   ' }).length, items.length);
      assert.strictEqual(filterItems(items, { query: 'zzz' }).length, 0);
    });

    test('CAL6.5 Filters compose', () => {
      const result = filterItems(items, { scope: 'term', types: ['holiday'], kinds: ['event'] });
      assert.deepStrictEqual(result.map(i => i.title), ['Founders Day']);
    });

    test('CAL6.6 Upcoming includes today; past excludes it and reads backwards', () => {
      const today = new Date(2025, 9, 14);
      const future = upcomingItems(items, today);
      assert.strictEqual(future.some(i => i.dateKey === '2025-10-14'), true, 'today is still upcoming');
      assert.strictEqual(future.some(i => i.dateKey === '2025-01-06'), false);
      assert.strictEqual(future[0].dateKey, '2025-10-14');

      const past = pastItems(items, today);
      assert.strictEqual(past.every(i => i.dateKey < '2025-10-14'), true);
      // Most recent first.
      for (let i = 1; i < past.length; i++) {
        assert.ok(past[i - 1].dateKey >= past[i].dateKey);
      }
    });

    test('CAL6.7 upcomingItems honours a limit', () => {
      assert.strictEqual(upcomingItems(items, new Date(2025, 0, 1), 3).length, 3);
      assert.strictEqual(upcomingItems([], new Date(), 3).length, 0);
    });
  });

  describe('Calendar Suite 7: What a day cell shows', () => {
    const chipItems = (n, prefix = 'Item') =>
      Array.from({ length: n }, (_, i) => ({
        kind: 'event',
        type: 'finals',
        id: String(i),
        title: `${prefix} ${i}`,
        dateKey: '2025-10-14',
        minutes: null,
      }));

    test('CAL7.1 A cell that fits everything shows every chip and no count', () => {
      const { chips, overflow } = buildDayChips(chipItems(2));
      assert.deepStrictEqual(chips.map(c => c.title), ['Item 0', 'Item 1']);
      assert.strictEqual(overflow, 0);
    });

    test('CAL7.2 Overflowing spends the LAST slot on the count, not a chip', () => {
      // Three items in two slots is one chip plus "+2" — the count has to
      // include the item whose slot it took, or the cell lies about the day.
      const { chips, overflow } = buildDayChips(chipItems(3));
      assert.deepStrictEqual(chips.map(c => c.title), ['Item 0']);
      assert.strictEqual(overflow, 2);
      assert.strictEqual(chips.length + overflow, 3, 'nothing is unaccounted for');
    });

    test('CAL7.3 Every count from 0 to 10 accounts for exactly the whole day', () => {
      for (let limit = 1; limit <= 4; limit++) {
        for (let n = 0; n <= 10; n++) {
          const { chips, overflow } = buildDayChips(chipItems(n), limit);
          assert.ok(chips.length <= limit, `at most ${limit} chips`);
          assert.strictEqual(chips.length + overflow, n, `limit ${limit}, ${n} items`);
        }
      }
    });

    test('CAL7.4 Chips keep the day order, so the earliest thing is shown', () => {
      const items = collectCalendarItems(makeLedger(), ACTIVE);
      const oct14 = groupByDateKey(items)['2025-10-14'];
      const { chips, overflow } = buildDayChips(oct14, 2);
      // Oct 14 holds two all-day events and two timed tasks; all-day sorts
      // first, so the visible chip is the first of those.
      assert.strictEqual(oct14.length, 4);
      assert.deepStrictEqual(chips.map(c => c.title), ['Founders Day']);
      assert.strictEqual(overflow, 3);
    });

    test('CAL7.5 An empty day is empty, and the input is never mutated', () => {
      assert.deepStrictEqual(buildDayChips([]), { chips: [], overflow: 0 });
      const items = chipItems(3);
      const snapshot = items.map(i => i.id);
      buildDayChips(items);
      assert.deepStrictEqual(items.map(i => i.id), snapshot);
    });
  });

  describe('Calendar Suite 7b: The grid is seven columns wide', () => {
    test('CAL7b.1 chunkWeeks always yields rows of exactly seven', () => {
      // The grid renders one row per week with seven flexed children. When it
      // was a single wrap container the cells lost their width and ELEVEN
      // landed on a row under seven weekday headers.
      for (let year = 2025; year <= 2027; year++) {
        for (let month = 0; month < 12; month++) {
          const weeks = chunkWeeks(trimTrailingWeeks(buildMonthMatrix(year, month)));
          assert.ok(weeks.length >= 4 && weeks.length <= 6, `${year}-${month + 1} spans 4-6 weeks`);
          weeks.forEach(week => assert.strictEqual(week.length, 7));
        }
      }
    });

    test('CAL7b.2 Each row starts on a Monday and ends on a Sunday', () => {
      const weeks = chunkWeeks(trimTrailingWeeks(buildMonthMatrix(2026, 8)));
      weeks.forEach(week => {
        assert.strictEqual(appDayIndex(parseDateKey(week[0].key)), 0, 'row opens on Monday');
        assert.strictEqual(appDayIndex(parseDateKey(week[6].key)), 6, 'row closes on Sunday');
      });
    });

    test('CAL7b.3 Chunking loses nothing', () => {
      const cells = trimTrailingWeeks(buildMonthMatrix(2026, 1));
      const flat = chunkWeeks(cells).flat();
      assert.deepStrictEqual(flat.map(c => c.key), cells.map(c => c.key));
      assert.deepStrictEqual(chunkWeeks([]), []);
    });
  });

  describe('Calendar Suite 7c: Pressables carry object styles, not callbacks', () => {
    const dir = new URL('../components/calendar/', import.meta.url);
    const sources = readdirSync(dir)
      .filter(f => f.endsWith('.tsx'))
      .map(f => [f, readFileSync(new URL(f, dir), 'utf8')]);

    test('CAL7c.1 No calendar component passes a function to a style prop', () => {
      // This project patches react-native-css-interop (NativeWind v4), whose
      // wrapper remaps `style` and drops a `({ pressed }) => ({...})` callback.
      // It shipped twice: the month cells lost their `flex` and `height`, so
      // eleven of them wrapped onto a row under seven weekday headers, and the
      // rows collapsed to the height of their digits. Press feedback belongs on
      // `TouchableOpacity`'s `activeOpacity`.
      const offenders = sources
        .filter(([, src]) => /style=\{\(/.test(src))
        .map(([name]) => name);
      assert.deepStrictEqual(offenders, [], `function styles found in: ${offenders.join(', ')}`);
    });

    test('CAL7c.2 The month grid never lays itself out with flexWrap', () => {
      const [, grid] = sources.find(([name]) => name === 'MonthGrid.tsx');
      // The doc comment names `flexWrap` to warn against it, so match the style
      // property itself rather than the prose.
      assert.ok(!/flexWrap\s*:/.test(grid), 'the grid must be explicit week rows of seven flexed cells');
      assert.ok(/chunkWeeks/.test(grid), 'the grid builds its rows with chunkWeeks');
    });
  });

  describe('Calendar Suite 8: Labels', () => {
    const today = new Date(2025, 9, 14);

    test('CAL8.1 Nearby days get words, distant ones get counts', () => {
      assert.strictEqual(relativeDayLabel('2025-10-14', today), 'Today');
      assert.strictEqual(relativeDayLabel('2025-10-15', today), 'Tomorrow');
      assert.strictEqual(relativeDayLabel('2025-10-13', today), 'Yesterday');
      assert.strictEqual(relativeDayLabel('2025-10-17', today), 'In 3 days');
      assert.strictEqual(relativeDayLabel('2025-10-11', today), '3 days ago');
      assert.strictEqual(relativeDayLabel('2025-11-14', today), 'In 4 wk');
      assert.strictEqual(relativeDayLabel('nonsense', today), '');
    });

    test('CAL8.2 formatHour reads the float hours the timetable stores', () => {
      assert.strictEqual(formatHour(13.5), '1:30 PM');
      assert.strictEqual(formatHour(8), '8:00 AM');
      assert.strictEqual(formatHour(12), '12:00 PM');
      assert.strictEqual(formatHour(0), '12:00 AM');
      assert.strictEqual(formatHour(23.75), '11:45 PM');
    });
  });

  describe('Calendar Suite 9: One event palette', () => {
    test('CAL9.1 Every type has a label, an icon and a tint in both schemes', () => {
      EVENT_TYPE_ORDER.forEach(type => {
        assert.ok(EVENT_TYPE_LABELS[type], `${type} has a label`);
        assert.ok(getEventIcon(type), `${type} has an icon`);
        [true, false].forEach(isDark => {
          const tint = getEventTint(type, isDark);
          ['fill', 'line', 'ink', 'solid'].forEach(slot => {
            assert.ok(typeof tint[slot] === 'string' && tint[slot].length > 0, `${type}.${slot} in ${isDark ? 'dark' : 'light'}`);
          });
        });
      });
    });

    test('CAL9.2 Each type is visually distinct — no two share a solid', () => {
      [true, false].forEach(isDark => {
        const solids = EVENT_TYPE_ORDER.map(t => getEventTint(t, isDark).solid);
        assert.strictEqual(new Set(solids).size, EVENT_TYPE_ORDER.length);
      });
    });

    test('CAL9.3 Unknown types resolve to the custom tint instead of throwing', () => {
      assert.strictEqual(normalizeEventType('weird_unknown_type'), 'custom');
      assert.strictEqual(normalizeEventType(undefined), 'custom');
      assert.strictEqual(normalizeEventType(null), 'custom');
      assert.deepStrictEqual(getEventTint('nope', false), getEventTint('custom', false));
      assert.strictEqual(getEventLabel('nope'), EVENT_TYPE_LABELS.custom);
    });
  });
}
