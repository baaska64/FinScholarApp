import assert from 'node:assert';
import {
  normalizeScheduleDays,
  normalizeScheduleDay,
  parseClassHour,
  parseClassDuration,
} from '../utils/scheduleParsing.ts';

const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;

export function runScheduleParsingTests(describe, test) {
  describe('Schedule Parsing Suite 1: Compressed Day Codes (study loads)', () => {
    test('SP1.1 MWF expands to Monday, Wednesday, Friday', () => {
      assert.deepStrictEqual(normalizeScheduleDays('MWF'), [MON, WED, FRI]);
    });

    test('SP1.2 TTh / TTH / TR all expand to Tuesday and Thursday', () => {
      ['TTh', 'TTH', 'tth', 'TR', 'tr'].forEach((code) => {
        assert.deepStrictEqual(normalizeScheduleDays(code), [TUE, THU], code);
      });
    });

    test('SP1.3 Five-day codes expand fully, however they spell Thursday', () => {
      ['MTWThF', 'MTWTHF', 'MTWRF', 'mtwthf'].forEach((code) => {
        assert.deepStrictEqual(normalizeScheduleDays(code), [MON, TUE, WED, THU, FRI], code);
      });
    });

    test('SP1.4 Two-letter prefixes win over single letters', () => {
      // The bug this guards: "Th" must not read as T followed by H.
      assert.deepStrictEqual(normalizeScheduleDays('Th'), [THU]);
      assert.deepStrictEqual(normalizeScheduleDays('MTh'), [MON, THU]);
      assert.deepStrictEqual(normalizeScheduleDays('WF'), [WED, FRI]);
    });

    test('SP1.5 SS resolves to the weekend rather than Saturday twice', () => {
      assert.deepStrictEqual(normalizeScheduleDays('SS'), [SAT, SUN]);
    });
  });

  describe('Schedule Parsing Suite 2: Words, Abbreviations and Lists', () => {
    test('SP2.1 Full day names in any case', () => {
      assert.deepStrictEqual(normalizeScheduleDays('Monday'), [MON]);
      assert.deepStrictEqual(normalizeScheduleDays('WEDNESDAY'), [WED]);
      assert.deepStrictEqual(normalizeScheduleDays('thursday'), [THU]);
      assert.deepStrictEqual(normalizeScheduleDays('Sunday'), [SUN]);
    });

    test('SP2.2 Every common abbreviation of Thursday', () => {
      ['Th', 'Thu', 'Thur', 'Thurs', 'Thursday', 'R', 'H'].forEach((s) => {
        assert.deepStrictEqual(normalizeScheduleDays(s), [THU], s);
      });
    });

    test('SP2.3 Space-separated words, including truncated ones', () => {
      assert.deepStrictEqual(normalizeScheduleDays('mon tue wed thur'), [MON, TUE, WED, THU]);
      assert.deepStrictEqual(normalizeScheduleDays('Monday Wednesday Friday'), [MON, WED, FRI]);
      assert.deepStrictEqual(normalizeScheduleDays('Tues Thurs'), [TUE, THU]);
    });

    test('SP2.4 Comma, slash, ampersand and pipe separated lists', () => {
      assert.deepStrictEqual(normalizeScheduleDays('M,W,F'), [MON, WED, FRI]);
      assert.deepStrictEqual(normalizeScheduleDays('M/W/F'), [MON, WED, FRI]);
      assert.deepStrictEqual(normalizeScheduleDays('Tuesday & Thursday'), [TUE, THU]);
      assert.deepStrictEqual(normalizeScheduleDays('Mon, Wed, Fri'), [MON, WED, FRI]);
    });

    test('SP2.5 Inclusive ranges', () => {
      assert.deepStrictEqual(normalizeScheduleDays('M-F'), [MON, TUE, WED, THU, FRI]);
      assert.deepStrictEqual(normalizeScheduleDays('Mon-Fri'), [MON, TUE, WED, THU, FRI]);
      assert.deepStrictEqual(normalizeScheduleDays('Tue to Thu'), [TUE, WED, THU]);
      assert.deepStrictEqual(normalizeScheduleDays('Sat-Sun'), [SAT, SUN]);
    });

    test('SP2.6 Results are de-duplicated and sorted', () => {
      assert.deepStrictEqual(normalizeScheduleDays('F, M, W, M'), [MON, WED, FRI]);
      assert.deepStrictEqual(normalizeScheduleDays([3, 1, 3]), [TUE, THU]);
    });
  });

  describe('Schedule Parsing Suite 3: Numbers, Arrays and Bad Input', () => {
    test('SP3.1 Numeric days pass through and clamp to range', () => {
      assert.deepStrictEqual(normalizeScheduleDays(0), [MON]);
      assert.deepStrictEqual(normalizeScheduleDays(6), [SUN]);
      assert.deepStrictEqual(normalizeScheduleDays(9), [SUN]);
      assert.deepStrictEqual(normalizeScheduleDays(-2), [MON]);
      assert.deepStrictEqual(normalizeScheduleDays('3'), [THU]);
    });

    test('SP3.2 Arrays flatten, including mixed forms', () => {
      assert.deepStrictEqual(normalizeScheduleDays(['MWF', 'Sat']), [MON, WED, FRI, SAT]);
      assert.deepStrictEqual(normalizeScheduleDays([0, 'Fri']), [MON, FRI]);
    });

    test('SP3.3 Unreadable input yields an empty list, not a silent Monday', () => {
      [null, undefined, '', '   ', {}, 'zzz', '???'].forEach((bad) => {
        assert.deepStrictEqual(normalizeScheduleDays(bad), [], JSON.stringify(bad));
      });
    });

    test('SP3.4 The single-day helper still defaults to Monday for callers that need one', () => {
      assert.strictEqual(normalizeScheduleDay('MWF'), MON);
      assert.strictEqual(normalizeScheduleDay('Thurs'), THU);
      assert.strictEqual(normalizeScheduleDay('nonsense'), MON);
    });
  });

  describe('Schedule Parsing Suite 4: Printed Times', () => {
    test('SP4.1 12-hour times convert to 24-hour floats', () => {
      assert.strictEqual(parseClassHour('8:15 AM'), 8.25);
      assert.strictEqual(parseClassHour('1:30 PM'), 13.5);
      assert.strictEqual(parseClassHour('12:00 PM'), 12);
      assert.strictEqual(parseClassHour('12:00 AM'), 0);
      assert.strictEqual(parseClassHour('4:45 pm'), 16.75);
    });

    test('SP4.2 Punctuation and spacing variants', () => {
      assert.strictEqual(parseClassHour('8.30 a.m.'), 8.5);
      assert.strictEqual(parseClassHour('7:00A.M.'), 7);
      assert.strictEqual(parseClassHour('  9:00   PM  '), 21);
    });

    test('SP4.3 24-hour input is not shifted again', () => {
      assert.strictEqual(parseClassHour('13:30'), 13.5);
      assert.strictEqual(parseClassHour('08:00'), 8);
      assert.strictEqual(parseClassHour(15.5), 15.5);
    });

    test('SP4.4 Unreadable times return the caller-supplied fallback', () => {
      assert.strictEqual(parseClassHour('TBA'), 8);
      assert.strictEqual(parseClassHour('', 7), 7);
      assert.ok(Number.isNaN(parseClassHour(null, NaN)));
    });
  });

  describe('Schedule Parsing Suite 5: Duration', () => {
    test('SP5.1 An explicit duration wins', () => {
      assert.strictEqual(parseClassDuration(1.5, 8), 1.5);
      assert.strictEqual(parseClassDuration('2 hours', 8), 2);
    });

    test('SP5.2 Otherwise derived from the printed end time', () => {
      assert.strictEqual(parseClassDuration(undefined, 8, '9:30 AM'), 1.5);
      assert.strictEqual(parseClassDuration(undefined, 13, '2:00 PM'), 1);
      assert.strictEqual(parseClassDuration(null, 7.5, '10:00 AM'), 2.5);
    });

    test('SP5.3 An end time past midnight wraps instead of going negative', () => {
      assert.strictEqual(parseClassDuration(undefined, 23, '12:30 AM'), 1.5);
    });

    test('SP5.4 Falls back to one hour when nothing is usable', () => {
      assert.strictEqual(parseClassDuration(undefined, 8), 1);
      assert.strictEqual(parseClassDuration(0, 8), 1);
      assert.strictEqual(parseClassDuration('TBA', 8, 'TBA'), 1);
    });
  });

  describe('Schedule Parsing Suite 6: Study-Load Rows End to End', () => {
    const expand = (row) =>
      normalizeScheduleDays(row.day).map((day) => {
        const startHour = parseClassHour(row.startTime);
        return {
          day,
          startHour,
          duration: parseClassDuration(row.duration, startHour, row.endTime),
        };
      });

    test('SP6.1 A three-day lecture row becomes three sessions', () => {
      const out = expand({ day: 'MWF', startTime: '8:00 AM', endTime: '9:00 AM' });
      assert.strictEqual(out.length, 3);
      assert.deepStrictEqual(out.map((c) => c.day), [MON, WED, FRI]);
      out.forEach((c) => {
        assert.strictEqual(c.startHour, 8);
        assert.strictEqual(c.duration, 1);
      });
    });

    test('SP6.2 A TTh lab row keeps its longer span', () => {
      const out = expand({ day: 'TTh', startTime: '1:00 PM', endTime: '4:00 PM' });
      assert.deepStrictEqual(out.map((c) => c.day), [TUE, THU]);
      out.forEach((c) => {
        assert.strictEqual(c.startHour, 13);
        assert.strictEqual(c.duration, 3);
      });
    });

    test('SP6.3 A single Saturday row stays one session', () => {
      const out = expand({ day: 'Saturday', startTime: '7:30 AM', endTime: '10:30 AM' });
      assert.strictEqual(out.length, 1);
      assert.strictEqual(out[0].day, SAT);
      assert.strictEqual(out[0].startHour, 7.5);
      assert.strictEqual(out[0].duration, 3);
    });

    test('SP6.4 A row whose days are unreadable produces no phantom Monday class', () => {
      assert.deepStrictEqual(expand({ day: 'TBA', startTime: '8:00 AM' }), []);
    });
  });
}
