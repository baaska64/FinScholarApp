import assert from 'node:assert';
import {
  buildWidgetSnapshot,
  emptySnapshot,
  formatCountdown,
  formatShortDuration,
  formatTimeRange,
  formatTimeStr,
  isValidClass,
  parseDueDate,
} from '../widget/widgetData.ts';
import {
  WIDGET_NAMES,
  WIDGET_GALLERY,
  WIDGET_REGISTRY,
  loadWidgetSnapshot,
  renderWidgetByName,
  widgetTaskHandler,
} from '../widget/WidgetTaskHandler.tsx';
import { widgetUpdateConfigs, resetWidgetUpdates } from '../scripts/mocks/react-native-android-widget.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolve, texts } from './helpers/widgetTree.js';

/** Thursday 3 Sep 2026, 08:12 — mid-way through a 7:30–9:00 class. */
const NOW = new Date(2026, 8, 3, 8, 12, 0);
const THU = 3;
const FRI = 4;

function ledgerWith(overrides = {}) {
  return {
    settings: { gradingSystem: '1_IS_BEST' },
    years: [
      {
        id: 'y1',
        name: '1st Year',
        semesters: [
          {
            id: 's1',
            name: '1st Semester',
            startDate: '2026-08-31',
            endDate: '2026-12-11',
            subjects: [],
            classes: [],
            attendanceLog: {},
            ...overrides,
          },
        ],
      },
    ],
  };
}

const CLASSES = [
  { id: 'c1', name: 'CSIT 227 - Advanced Mobile', room: 'NGE 108', day: THU, startHour: 7.5, duration: 1.5, colorIdx: 0 },
  { id: 'c2', name: 'CSIT 228', room: 'NGE 205', day: THU, startHour: 10, duration: 1.5, colorIdx: 2 },
  { id: 'c3', name: 'MATH 101', room: 'RM 314', day: FRI, startHour: 9, duration: 1, colorIdx: 3 },
];

export function runWidgetTaskHandlerTests(describe, test) {
  describe('WidgetTaskHandler Suite 1: Time and countdown formatters', () => {
    test('1.1 formatTimeStr 12-hour formatting (AM/PM)', () => {
      assert.strictEqual(formatTimeStr(8), '8:00 AM');
      assert.strictEqual(formatTimeStr(9.5), '9:30 AM');
      assert.strictEqual(formatTimeStr(12), '12:00 PM');
      assert.strictEqual(formatTimeStr(13.5), '1:30 PM');
      assert.strictEqual(formatTimeStr(0), '12:00 AM');
      assert.strictEqual(formatTimeStr(0.25), '12:15 AM');
      assert.strictEqual(formatTimeStr(23.75), '11:45 PM');
      assert.strictEqual(formatTimeStr(8.999), '9:00 AM');
      assert.strictEqual(formatTimeStr(11.999), '12:00 PM');
      assert.strictEqual(formatTimeStr(23.999), '12:00 AM');
      assert.strictEqual(formatTimeStr(NaN), '12:00 AM');
      assert.strictEqual(formatTimeStr(Infinity), '12:00 AM');
      assert.strictEqual(formatTimeStr(null), '12:00 AM');
      assert.strictEqual(formatTimeStr(undefined), '12:00 AM');
    });

    test('1.2 formatCountdown returns expected status and countdown strings', () => {
      assert.strictEqual(formatCountdown(0, true), 'In progress');
      assert.strictEqual(formatCountdown(-0.5, false), 'In progress');
      assert.strictEqual(formatCountdown(0, false), 'In 0m');
      assert.strictEqual(formatCountdown(0.5, false), 'In 30m');
      assert.strictEqual(formatCountdown(0.25, false), 'In 15m');
      assert.strictEqual(formatCountdown(0.999, false), 'In 1h');
      assert.strictEqual(formatCountdown(1.5, false), 'In 1h 30m');
      assert.strictEqual(formatCountdown(2, false), 'In 2h');
      assert.strictEqual(formatCountdown(23.999, false), 'In 1 day');
      assert.strictEqual(formatCountdown(24, false), 'In 1 day');
      assert.strictEqual(formatCountdown(48, false), 'In 2 days');
      assert.strictEqual(formatCountdown(NaN, false), 'In progress');
      assert.strictEqual(formatCountdown(Infinity, false), 'In progress');
      assert.strictEqual(formatCountdown(null, false), 'In progress');
    });

    test('1.3 formatShortDuration fits a chip', () => {
      assert.strictEqual(formatShortDuration(0), 'now');
      assert.strictEqual(formatShortDuration(-5), 'now');
      assert.strictEqual(formatShortDuration(NaN), 'now');
      assert.strictEqual(formatShortDuration(1), '1m');
      assert.strictEqual(formatShortDuration(59), '59m');
      assert.strictEqual(formatShortDuration(60), '1h');
      assert.strictEqual(formatShortDuration(150), '2h 30m');
      assert.strictEqual(formatShortDuration(1440), '1d');
      assert.strictEqual(formatShortDuration(4320), '3d');
    });

    test('1.4 formatTimeRange writes the meridiem once when both ends share it', () => {
      assert.strictEqual(formatTimeRange(7.5, 1.5), '7:30 – 9:00 AM');
      assert.strictEqual(formatTimeRange(13, 1), '1:00 – 2:00 PM');
      assert.strictEqual(formatTimeRange(11.5, 1.5), '11:30 AM – 1:00 PM');
    });

    test('1.5 isValidClass validates class structure', () => {
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: 0 }), true);
      assert.strictEqual(isValidClass({ name: '', startHour: 8, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: '8', day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: NaN, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: Infinity, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: -1, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 24, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: NaN }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: -1 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: 7 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: 1.5 }), false);
      assert.strictEqual(isValidClass(null), false);
      assert.strictEqual(isValidClass(undefined), false);
    });

    test('1.6 parseDueDate keeps the legacy end-of-day meaning', () => {
      const legacy = parseDueDate('2026-09-10');
      assert.strictEqual(legacy.getHours(), 23);
      assert.strictEqual(legacy.getMinutes(), 59);
      assert(parseDueDate('2026-09-10T15:00:00.000Z') instanceof Date);
      assert.strictEqual(parseDueDate(''), null);
      assert.strictEqual(parseDueDate('   '), null);
      assert.strictEqual(parseDueDate(null), null);
      assert.strictEqual(parseDueDate(undefined), null);
      assert.strictEqual(parseDueDate('not a date'), null);
      assert.strictEqual(parseDueDate(12345), null);
    });
  });

  describe('WidgetTaskHandler Suite 2: Snapshot — schedule', () => {
    test('2.1 The class in progress leads, then the next sessions in time order', () => {
      const snap = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: NOW });

      assert.strictEqual(snap.upcoming[0].courseName, 'CSIT 227', 'Course codes are kept, the long title trimmed');
      assert.strictEqual(snap.upcoming[0].isOngoing, true);
      assert.strictEqual(snap.upcoming[1].courseName, 'CSIT 228');
      assert.strictEqual(snap.upcoming[2].courseName, 'MATH 101');
      assert.strictEqual(snap.hasSchedule, true);
    });

    test('2.2 The ongoing class reports how far through it is', () => {
      const snap = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: NOW });
      const hero = snap.upcoming[0];
      // 42 of 90 minutes gone at 08:12 in a 7:30–9:00 session.
      assert(Math.abs(hero.progress - 42 / 90) < 0.01, `progress was ${hero.progress}`);
      assert.strictEqual(hero.minutesLeft, 48);
      assert.strictEqual(hero.shortRemainingStr, '48m left');
      assert.strictEqual(hero.rangeStr, '7:30 – 9:00 AM');
      assert.strictEqual(hero.room, 'NGE 108');
    });

    test('2.3 Progress stays inside 0…1 and never leaks into upcoming classes', () => {
      const snap = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: NOW });
      for (const item of snap.upcoming) {
        assert(item.progress >= 0 && item.progress <= 1, `progress ${item.progress}`);
        if (!item.isOngoing) assert.strictEqual(item.progress, 0);
        assert(Number.isFinite(item.minutesAway) && item.minutesAway >= 0);
      }
    });

    test('2.4 A class that already finished today rolls forward to next week', () => {
      const evening = new Date(2026, 8, 3, 20, 0, 0);
      const snap = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: evening });
      assert.strictEqual(snap.upcoming[0].courseName, 'MATH 101', "Tomorrow's class comes before next Thursday's");
      assert.strictEqual(snap.upcoming[0].isOngoing, false);
      assert(snap.upcoming.some((c) => c.courseName === 'CSIT 227'), 'Thursday returns a week later');
    });

    test('2.5 A semester that has not started previews its first week', () => {
      const beforeTerm = new Date(2026, 7, 20, 9, 0, 0);
      const snap = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: beforeTerm });
      assert(snap.upcoming.length > 0, 'The timetable should preview rather than sit empty');
      assert(snap.upcoming.every((c) => !c.isOngoing), 'Nothing is in progress before term starts');
      assert.deepStrictEqual(snap.today, [], "There is no 'today' before the term opens");
    });

    test('2.6 Today lists the day in clock order and tags each session', () => {
      const snap = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: NOW });
      assert.deepStrictEqual(snap.today.map((c) => c.courseName), ['CSIT 227', 'CSIT 228']);
      assert.deepStrictEqual(snap.today.map((c) => c.state), ['now', 'next']);
      assert.strictEqual(snap.stats.classesToday, 2);
      assert.strictEqual(snap.stats.classesLeftToday, 2, 'A class in progress still counts as left to do');

      const evening = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: new Date(2026, 8, 3, 20, 0) });
      assert.deepStrictEqual(evening.today.map((c) => c.state), ['past', 'past']);
      assert.strictEqual(evening.stats.classesLeftToday, 0);
    });

    test('2.7 Invalid classes are dropped before anything is drawn', () => {
      const junk = [
        ...CLASSES,
        null,
        undefined,
        'not a class',
        { name: '', day: THU, startHour: 8 },
        { name: 'Bad day', day: 9, startHour: 8 },
        { name: 'Bad hour', day: THU, startHour: 99 },
      ];
      const snap = buildWidgetSnapshot(ledgerWith({ classes: junk }), { yearId: 'y1', semId: 's1', now: NOW });
      assert.strictEqual(snap.upcoming.length, 3);
      assert(snap.upcoming.every((c) => typeof c.courseName === 'string' && c.courseName.length > 0));
    });

    test('2.8 A missing duration or room falls back rather than breaking the row', () => {
      const sparse = [{ id: 'x', name: 'CS 101', day: THU, startHour: 14 }];
      const snap = buildWidgetSnapshot(ledgerWith({ classes: sparse }), { yearId: 'y1', semId: 's1', now: NOW });
      assert.strictEqual(snap.upcoming[0].room, 'TBA');
      assert.strictEqual(snap.upcoming[0].duration, 1);
      assert.strictEqual(snap.upcoming[0].rangeStr, '2:00 – 3:00 PM');
    });

    test('2.9 The upcoming list is capped so a busy timetable cannot bloat the payload', () => {
      const many = Array.from({ length: 60 }, (_, i) => ({
        id: `m${i}`,
        name: `Course ${i}`,
        day: i % 7,
        startHour: 8 + (i % 10),
        duration: 1,
      }));
      const snap = buildWidgetSnapshot(ledgerWith({ classes: many }), { yearId: 'y1', semId: 's1', now: NOW });
      assert(snap.upcoming.length <= 6, `upcoming was ${snap.upcoming.length}`);
      assert(snap.today.length <= 8, `today was ${snap.today.length}`);
    });
  });

  describe('WidgetTaskHandler Suite 3: Snapshot — deadlines', () => {
    const subjects = [
      {
        id: 'sub1',
        name: 'CSIT 227 - Advanced Mobile',
        colorIdx: 0,
        requirements: [
          { id: 't1', title: 'Case study draft', status: 'pending', priority: 'high', dueDate: new Date(2026, 8, 2, 12).toISOString() },
          { id: 't2', title: 'Submitted already', status: 'submitted', dueDate: new Date(2026, 8, 1).toISOString() },
          { id: 't3', title: 'Graded already', status: 'graded', dueDate: new Date(2026, 8, 1).toISOString() },
        ],
      },
      {
        id: 'sub2',
        name: 'MATH 101',
        colorIdx: 3,
        requirements: [
          { id: 't4', title: 'Problem set 4', status: 'pending', dueDate: new Date(2026, 8, 3, 18).toISOString() },
          { id: 't5', title: 'Term project', status: 'pending', dueDate: new Date(2026, 9, 20).toISOString() },
          { id: 't6', title: 'Someday', status: 'pending', dueDate: '' },
        ],
      },
    ];

    test('3.1 Only unfinished work reaches the widget, soonest first', () => {
      const snap = buildWidgetSnapshot(ledgerWith({ subjects }), { yearId: 'y1', semId: 's1', now: NOW });
      assert.deepStrictEqual(
        snap.tasks.map((t) => t.title),
        ['Case study draft', 'Problem set 4', 'Term project', 'Someday']
      );
      assert(!snap.tasks.some((t) => t.title.includes('already')), 'Submitted and graded work is done with');
      assert.strictEqual(snap.tasks[snap.tasks.length - 1].dueAt, null, 'Undated work sorts last');
    });

    test('3.2 Urgency and its label track the clock', () => {
      const snap = buildWidgetSnapshot(ledgerWith({ subjects }), { yearId: 'y1', semId: 's1', now: NOW });
      const byId = Object.fromEntries(snap.tasks.map((t) => [t.title, t]));

      assert.strictEqual(byId['Case study draft'].urgency, 'overdue');
      assert.strictEqual(byId['Case study draft'].dueLabel, 'Overdue');
      assert.strictEqual(byId['Problem set 4'].urgency, 'today');
      assert.strictEqual(byId['Problem set 4'].dueLabel, 'Today');
      assert.strictEqual(byId['Term project'].urgency, 'later');
      assert.strictEqual(byId['Someday'].urgency, 'none');
      assert.strictEqual(byId['Someday'].dueLabel, 'No due date');
    });

    test('3.3 Tomorrow and the near future read in human units', () => {
      const soon = [
        {
          id: 'sub',
          name: 'ENG 101',
          requirements: [
            { id: 'a', title: 'Tomorrow task', status: 'pending', dueDate: new Date(2026, 8, 4, 12).toISOString() },
            { id: 'b', title: 'Next week task', status: 'pending', dueDate: new Date(2026, 8, 10, 12).toISOString() },
            { id: 'c', title: 'Imminent', status: 'pending', dueDate: new Date(2026, 8, 3, 8, 42).toISOString() },
          ],
        },
      ];
      const snap = buildWidgetSnapshot(ledgerWith({ subjects: soon }), { yearId: 'y1', semId: 's1', now: NOW });
      const byTitle = Object.fromEntries(snap.tasks.map((t) => [t.title, t.dueLabel]));
      assert.strictEqual(byTitle['Imminent'], '30m left');
      assert.strictEqual(byTitle['Tomorrow task'], 'Tomorrow');
      assert.strictEqual(byTitle['Next week task'], '7d left', 'Counted in calendar days, the way a student counts');
    });

    test('3.4 Open and overdue counts cover the whole term, not just the visible rows', () => {
      const many = [
        {
          id: 'sub',
          name: 'CS',
          requirements: Array.from({ length: 12 }, (_, i) => ({
            id: `t${i}`,
            title: `Task ${i}`,
            status: 'pending',
            dueDate: new Date(2026, 8, i < 5 ? 1 : 20).toISOString(),
          })),
        },
      ];
      const snap = buildWidgetSnapshot(ledgerWith({ subjects: many }), { yearId: 'y1', semId: 's1', now: NOW });
      assert.strictEqual(snap.tasks.length, 6, 'The list itself stays small');
      assert.strictEqual(snap.stats.pendingCount, 12, 'The count is of everything open');
      assert.strictEqual(snap.stats.overdueCount, 5);
    });

    test('3.5 Malformed requirements are skipped without taking the widget down', () => {
      const broken = [
        { id: 'sub', name: 'CS', requirements: [null, undefined, 42, 'text', {}, { title: '   ' }, { id: 'ok', title: 'Real task', status: 'pending' }] },
        { id: 'sub2', name: 'No reqs' },
        null,
      ];
      const snap = buildWidgetSnapshot(ledgerWith({ subjects: broken }), { yearId: 'y1', semId: 's1', now: NOW });
      assert.deepStrictEqual(snap.tasks.map((t) => t.title), ['Real task']);
    });
  });

  describe('WidgetTaskHandler Suite 4: Snapshot — term stats', () => {
    test('4.1 Attendance counts hours sat against hours held', () => {
      const present = buildWidgetSnapshot(
        ledgerWith({ classes: [CLASSES[0]], attendanceLog: { '2026-09-03_c1': { status: 'present', isManual: true } } }),
        { yearId: 'y1', semId: 's1', now: NOW }
      );
      assert.strictEqual(present.stats.hasAttendance, true);
      assert.strictEqual(present.stats.attendancePct, 100);

      const absent = buildWidgetSnapshot(
        ledgerWith({ classes: [CLASSES[0]], attendanceLog: { '2026-09-03_c1': { status: 'absent', isManual: true } } }),
        { yearId: 'y1', semId: 's1', now: NOW }
      );
      assert.strictEqual(absent.stats.attendancePct, 0);
    });

    test('4.2 A cancelled session leaves the denominator alone', () => {
      const cancelled = buildWidgetSnapshot(
        ledgerWith({ classes: [CLASSES[0]], attendanceLog: { '2026-09-03_c1': { status: 'cancelled', isManual: true } } }),
        { yearId: 'y1', semId: 's1', now: NOW }
      );
      assert.strictEqual(cancelled.stats.hasAttendance, false, 'No sessions held means no record to show');
      assert.strictEqual(cancelled.stats.attendancePct, 100);
    });

    test('4.3 Sessions still ahead of the clock are not counted as missed', () => {
      const beforeClass = buildWidgetSnapshot(ledgerWith({ classes: [CLASSES[0]] }), {
        yearId: 'y1',
        semId: 's1',
        now: new Date(2026, 8, 3, 6, 0),
      });
      assert.strictEqual(beforeClass.stats.hasAttendance, false);
    });

    test('4.4 Term progress reads as a week, not a percentage nobody can place', () => {
      const snap = buildWidgetSnapshot(ledgerWith({}), { yearId: 'y1', semId: 's1', now: NOW });
      assert.strictEqual(snap.stats.termPct, 3);
      assert.strictEqual(snap.stats.termCaption, 'Week 1 of 15');

      const before = buildWidgetSnapshot(ledgerWith({}), { yearId: 'y1', semId: 's1', now: new Date(2026, 7, 20) });
      assert.strictEqual(before.stats.termPct, 0);
      assert(before.stats.termCaption.startsWith('Starts in'), before.stats.termCaption);

      const after = buildWidgetSnapshot(ledgerWith({}), { yearId: 'y1', semId: 's1', now: new Date(2027, 0, 5) });
      assert.strictEqual(after.stats.termPct, 100);
      assert.strictEqual(after.stats.termCaption, 'Term complete');

      const undated = buildWidgetSnapshot(ledgerWith({ startDate: '', endDate: '' }), { yearId: 'y1', semId: 's1', now: NOW });
      assert.strictEqual(undated.stats.termCaption, 'No term dates');
    });

    test('4.5 The grade is pre-formatted for the grading system in use', () => {
      const gpa = buildWidgetSnapshot(ledgerWith({}), { yearId: 'y1', semId: 's1', now: NOW });
      assert.strictEqual(gpa.stats.gradeCaption, 'Term GWA');
      assert.strictEqual(gpa.stats.gradeValue, '--', 'No marks yet reads as no grade, not as zero');

      const percentLedger = ledgerWith({});
      percentLedger.settings.gradingSystem = 'PERCENT';
      const percent = buildWidgetSnapshot(percentLedger, { yearId: 'y1', semId: 's1', now: NOW });
      assert.strictEqual(percent.stats.gradeCaption, 'Term average');
    });
  });

  describe('WidgetTaskHandler Suite 5: Snapshot — resolution and resilience', () => {
    test('5.1 The selected year and semester win; without them the first is used', () => {
      const ledger = ledgerWith({ classes: CLASSES });
      ledger.years.push({
        id: 'y2',
        semesters: [{ id: 's2', name: 'Other', classes: [{ id: 'z', name: 'ZZZ 999', day: THU, startHour: 12, duration: 1 }] }],
      });

      const selected = buildWidgetSnapshot(ledger, { yearId: 'y2', semId: 's2', now: NOW });
      assert.strictEqual(selected.upcoming[0].courseName, 'ZZZ 999');

      const fallback = buildWidgetSnapshot(ledger, { now: NOW });
      assert.strictEqual(fallback.termLabel, '1st Semester');
    });

    test('5.2 A ledger with nothing in it produces a drawable empty snapshot', () => {
      for (const ledger of [null, undefined, {}, { years: [] }, { years: 'nope' }, { years: [{ id: 'y1' }] }]) {
        const snap = buildWidgetSnapshot(ledger, { now: NOW });
        assert.strictEqual(snap.hasSchedule, false);
        assert.deepStrictEqual(snap.upcoming, []);
        assert.deepStrictEqual(snap.today, []);
        assert.deepStrictEqual(snap.tasks, []);
        assert.strictEqual(snap.stats.gradeValue, '--');
        assert.strictEqual(snap.dayLabel, 'Thu');
        assert.strictEqual(snap.dateLabel, 'Sep 3');
      }
    });

    test('5.3 Absurd text is truncated before it reaches a bitmap', () => {
      const huge = [{ id: 'h', name: 'A'.repeat(5000), room: 'B'.repeat(5000), day: THU, startHour: 14, duration: 1 }];
      const snap = buildWidgetSnapshot(ledgerWith({ classes: huge }), { yearId: 'y1', semId: 's1', now: NOW });
      assert(snap.upcoming[0].courseName.length <= 81, `name was ${snap.upcoming[0].courseName.length} chars`);
      assert(snap.upcoming[0].room.length <= 81);
    });

    test('5.4 An invalid clock falls back to the real one instead of throwing', () => {
      const snap = buildWidgetSnapshot(ledgerWith({ classes: CLASSES }), { yearId: 'y1', semId: 's1', now: new Date('nonsense') });
      assert(Number.isFinite(snap.generatedAt));
    });

    test('5.5 Building a snapshot from a full term stays fast enough for a background task', () => {
      const heavy = ledgerWith({
        classes: Array.from({ length: 30 }, (_, i) => ({
          id: `c${i}`,
          name: `Course ${i}`,
          day: i % 7,
          startHour: 7 + (i % 12),
          duration: 1,
        })),
        subjects: Array.from({ length: 12 }, (_, s) => ({
          id: `s${s}`,
          name: `Subject ${s}`,
          requirements: Array.from({ length: 20 }, (_, r) => ({
            id: `s${s}t${r}`,
            title: `Task ${r}`,
            status: 'pending',
            dueDate: new Date(2026, 8, 5 + (r % 20)).toISOString(),
          })),
        })),
      });
      const started = performance.now();
      const snap = buildWidgetSnapshot(heavy, { yearId: 'y1', semId: 's1', now: NOW });
      const elapsed = performance.now() - started;
      assert(snap.upcoming.length > 0);
      assert(elapsed < 250, `Snapshot took ${elapsed.toFixed(1)}ms`);
    });
  });

  describe('WidgetTaskHandler Suite 6: Drawing the widgets', () => {
    test('6.1 Every widget on the home screen is refreshed in one pass', async () => {
      resetWidgetUpdates();
      await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(ledgerWith({ classes: CLASSES })));
      await AsyncStorage.setItem('@selectedYear', 'y1');
      await AsyncStorage.setItem('@selectedSemester', 's1');

      await widgetTaskHandler();

      assert.deepStrictEqual(
        widgetUpdateConfigs.map((c) => c.widgetName).sort(),
        [...WIDGET_NAMES].sort(),
        'A data change must reach every widget the student placed'
      );
    });

    test('6.2 Each widget is drawn for both themes so Android can pick', async () => {
      resetWidgetUpdates();
      await widgetTaskHandler();

      for (const config of widgetUpdateConfigs) {
        const rendered = config.renderWidget({ width: 280, height: 200 });
        assert(rendered.light && rendered.dark, `${config.widgetName} must supply light and dark`);
        assert.notStrictEqual(
          resolve(rendered.light).props.style.backgroundColor,
          resolve(rendered.dark).props.style.backgroundColor,
          `${config.widgetName} drew the same card for both themes`
        );
      }
    });

    test('6.3 The widget picks up the real schedule, not a placeholder', async () => {
      resetWidgetUpdates();
      await widgetTaskHandler();

      const upNext = widgetUpdateConfigs.find((c) => c.widgetName === 'FinScholarWidget');
      const tree = resolve(upNext.renderWidget({ width: 300, height: 240 }).light);
      const found = texts(tree);
      assert(found.includes('CSIT 227'), `Expected the stored class, saw ${JSON.stringify(found)}`);
    });

    test('6.4 A deleted widget does no work', async () => {
      resetWidgetUpdates();
      await widgetTaskHandler({ widgetAction: 'WIDGET_DELETED', widgetInfo: { widgetName: 'FinScholarWidget' } });
      assert.strictEqual(widgetUpdateConfigs.length, 0);
    });

    test('6.5 The native path draws only the widget it was called for', async () => {
      resetWidgetUpdates();
      let rendered = null;
      await widgetTaskHandler({
        widgetAction: 'WIDGET_UPDATE',
        widgetInfo: { widgetName: 'FinScholarStatsWidget', width: 280, height: 200 },
        renderWidget: (component) => {
          rendered = component;
        },
      });
      assert.strictEqual(widgetUpdateConfigs.length, 0, 'No second round-trip through requestWidgetUpdate');
      assert(rendered?.light && rendered?.dark);
    });

    test('6.6 A corrupt ledger still leaves a drawable widget', async () => {
      resetWidgetUpdates();
      await AsyncStorage.setItem('grade_ledger_v2_data', 'INVALID_JSON{{{');

      await widgetTaskHandler();

      assert.strictEqual(widgetUpdateConfigs.length, WIDGET_NAMES.length);
      for (const config of widgetUpdateConfigs) {
        const rendered = config.renderWidget({ width: 280, height: 200 });
        assert(texts(resolve(rendered.light)).length > 0, `${config.widgetName} rendered nothing`);
      }
    });

    test('6.7 A ledger that was never saved is treated as an empty one', async () => {
      await AsyncStorage.removeItem('grade_ledger_v2_data');
      const snap = await loadWidgetSnapshot(NOW);
      assert.strictEqual(snap.hasSchedule, false);
      assert.strictEqual(snap.generatedAt, NOW.getTime());
    });

    test('6.8 An unknown widget name falls back rather than rendering nothing', () => {
      const rendered = renderWidgetByName('SomeWidgetFromAnOlderBuild', emptySnapshot(NOW), { width: 280, height: 200 });
      assert(rendered.light && rendered.dark);
      assert(texts(resolve(rendered.light)).length > 0, 'The fallback must still draw something');
    });

    test('6.9 The in-app gallery covers exactly the widgets that exist', () => {
      assert.deepStrictEqual(
        WIDGET_GALLERY.map((w) => w.name).sort(),
        Object.keys(WIDGET_REGISTRY).sort()
      );
      for (const item of WIDGET_GALLERY) {
        assert(item.title && item.description, `${item.name} needs a title and description`);
        assert(item.previewWidth > 0 && item.previewHeight > 0);
      }
    });
  });
}
