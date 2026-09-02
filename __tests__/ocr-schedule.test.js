import assert from 'node:assert';
import {
  collectOcrLines,
  groupLinesIntoRows,
  extractClassesFromRow,
  parseOcrToClasses,
  mergeContinuationRows,
  repairOcrDigits,
} from '../utils/ocrSchedule.ts';
import { normalizeScheduleDays, parseClassHour, parseClassDuration } from '../utils/scheduleParsing.ts';

const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4;

/** Builds an ML Kit-shaped line at a given band. */
const line = (text, top, left, height = 20, width = 100) => ({
  text,
  frame: { top, left, height, width },
});

/**
 * Rows exactly as they read off a real study load: wide table, several columns
 * before the schedule, and a Schedule cell that can hold two meeting patterns.
 */
const REAL_ROWS = [
  'Course Code Section Cluster Description Lec Units Lab Units Units Taken Schedule Room Mode of Delivery Remarks',
  'CSIT227 G2 C0 Object-oriented Programming 1 2.0 1.0 3 TH 08:00 AM - 10:00 AM, M 07:30 AM - 10:30 AM GLE202, NGE105 In-Person',
  'CSIT221 G5 C0 Data Structures and Algorithms 2.0 1.0 3 F 08:00 AM - 10:00 AM, T 07:30 AM - 10:30 AM GLE201, NGE102 In-Person',
  'CSIT104 G7 C0 Platform-based Development 1 (Multimedia) 0.0 1.0 1 W 07:30 AM - 10:30 AM NGE204 In-Person',
  'SDG031 B2 C0 Sustainable Development Goals 3.0 0.0 3 TF 12:00 PM - 01:30 PM ONLINE Online',
  'CSIT213 G6 C0 Social Issues and Professional Practice 3.0 0.0 3 TH 01:00 PM - 03:00 PM, W 05:00 PM - 06:00 PM GLE203, ONLINE Hybrid',
  'IT227 G4 C0 Networking 1 2.0 1.0 3 TH 11:00 AM - 01:00 PM, M 10:30 AM - 01:30 PM GLE203, NGE207 In-Person',
  'SOCSCI032 E3/D4 C0 The Contemporary World 3.0 0.0 3 T 10:30 AM - 12:00 PM, F 10:30 AM - 12:00 PM TBA, ONLINE Hybrid',
  'PE205 G4/G8 C0 PATHFIT 1 / PATHFit 3-Menu of Sports, Dance, Recreation and Martial Arts 2.0 0.0 2 W 11:30 AM - 01:30 PM PE-COVEREDCOURT In-Person Arnis',
  'Total: 21',
];

/** The same table as OCR blocks, one band per row. */
const REAL_OCR = {
  blocks: REAL_ROWS.map((text, i) => ({ lines: [line(text, 40 * i, 0)] })),
};

export function runOcrScheduleTests(describe, test) {
  describe('OCR Schedule Suite 1: Line Collection and Row Grouping', () => {
    test('OC1.1 Flattens nested blocks into lines that carry a frame', () => {
      const lines = collectOcrLines(REAL_OCR);
      assert.strictEqual(lines.length, REAL_ROWS.length);
      assert.ok(lines.every((l) => l.frame && typeof l.frame.top === 'number'));
    });

    test('OC1.2 Lines sharing a horizontal band become one row, ordered left to right', () => {
      const split = {
        blocks: [{ lines: [
          line('CSIT227 G2', 50, 0),
          line('TH 08:00 AM - 10:00 AM', 50, 300),
          line('GLE202', 50, 600),
        ] }],
      };
      assert.deepStrictEqual(
        groupLinesIntoRows(collectOcrLines(split)),
        ['CSIT227 G2 TH 08:00 AM - 10:00 AM GLE202'],
      );
    });

    test('OC1.3 Out-of-order input still reconstructs the row correctly', () => {
      const scrambled = {
        blocks: [{ lines: [line('GLE202', 50, 600), line('CSIT227', 50, 0), line('TH', 50, 300)] }],
      };
      assert.deepStrictEqual(groupLinesIntoRows(collectOcrLines(scrambled)), ['CSIT227 TH GLE202']);
    });

    test('OC1.4 Slight vertical jitter within a row does not split it', () => {
      const jittered = {
        blocks: [{ lines: [line('CSIT227', 50, 0), line('TH', 53, 300), line('GLE202', 48, 600)] }],
      };
      assert.strictEqual(groupLinesIntoRows(collectOcrLines(jittered)).length, 1);
    });

    test('OC1.5 Empty and malformed input yields no rows rather than throwing', () => {
      assert.deepStrictEqual(collectOcrLines(null), []);
      assert.deepStrictEqual(collectOcrLines({}), []);
      assert.deepStrictEqual(groupLinesIntoRows([]), []);
      assert.deepStrictEqual(parseOcrToClasses(undefined), []);
    });
  });

  describe('OCR Schedule Suite 2: Multiple Meeting Patterns Per Row', () => {
    test('OC2.1 A row with two patterns yields two classes', () => {
      const out = extractClassesFromRow(REAL_ROWS[1]);
      assert.strictEqual(out.length, 2);
      assert.deepStrictEqual(out.map((c) => c.day), ['TH', 'M']);
      assert.deepStrictEqual(out.map((c) => c.startTime), ['08:00 AM', '07:30 AM']);
      assert.deepStrictEqual(out.map((c) => c.endTime), ['10:00 AM', '10:30 AM']);
    });

    test('OC2.2 Rooms line up with their patterns in order', () => {
      const out = extractClassesFromRow(REAL_ROWS[1]);
      assert.deepStrictEqual(out.map((c) => c.room), ['GLE202', 'NGE105']);
    });

    test('OC2.3 A single room is shared by every pattern in the row', () => {
      const out = extractClassesFromRow(REAL_ROWS[3]);
      assert.strictEqual(out.length, 1);
      assert.strictEqual(out[0].room, 'NGE204');
    });

    test('OC2.4 The name is the course code and section, not the description', () => {
      assert.strictEqual(extractClassesFromRow(REAL_ROWS[1])[0].name, 'CSIT227 G2');
      assert.strictEqual(extractClassesFromRow(REAL_ROWS[4])[0].name, 'SDG031 B2');
      assert.strictEqual(extractClassesFromRow(REAL_ROWS[7])[0].name, 'SOCSCI032 E3/D4');
      assert.strictEqual(extractClassesFromRow(REAL_ROWS[8])[0].name, 'PE205 G4/G8');
    });

    test('OC2.5 The cluster column is never mistaken for a section', () => {
      extractClassesFromRow(REAL_ROWS[1]).forEach((c) => {
        assert.ok(!c.name.includes('C0'), `cluster leaked into name: ${c.name}`);
      });
    });

    test('OC2.6 Delivery mode and remarks are stripped from the room', () => {
      assert.strictEqual(extractClassesFromRow(REAL_ROWS[8])[0].room, 'PE-COVEREDCOURT');
      assert.strictEqual(extractClassesFromRow(REAL_ROWS[4])[0].room, 'ONLINE');
    });

    test('OC2.7 Header, total and prose rows yield nothing', () => {
      assert.deepStrictEqual(extractClassesFromRow(REAL_ROWS[0]), []);
      assert.deepStrictEqual(extractClassesFromRow(REAL_ROWS[9]), []);
      assert.deepStrictEqual(extractClassesFromRow('Dance, Recreation and Martial Arts'), []);
      assert.deepStrictEqual(extractClassesFromRow(''), []);
    });

    test('OC2.8 Description prose is never read as a meeting pattern', () => {
      // "Programming 1 2.0 1.0 3" sits right before the real schedule cell.
      const out = extractClassesFromRow(REAL_ROWS[1]);
      out.forEach((c) => {
        assert.ok(normalizeScheduleDays(c.day).length > 0, `bogus day ${c.day}`);
      });
    });
  });

  describe('OCR Schedule Suite 3: Surviving Imperfect OCR', () => {
    test('OC4.1 A two-line Schedule cell folds back into its subject row', () => {
      // ML Kit sees the stacked patterns as separate bands; without merging,
      // the second one is stranded with no subject attached.
      const merged = mergeContinuationRows([
        'CSIT227 G2 C0 Object-oriented Programming 1 2.0 1.0 3 TH 08:00 AM - 10:00 AM, GLE202,',
        'M 07:30 AM - 10:30 AM NGE105',
      ]);
      assert.strictEqual(merged.length, 1);
      assert.strictEqual(extractClassesFromRow(merged[0]).length, 2);
    });

    test('OC4.2 A wrapped Description does not become its own row', () => {
      const merged = mergeContinuationRows([
        'PE205 G4/G8 C0 PATHFIT 1 / PATHFit 3-Menu of Sports,',
        'Dance, Recreation and Martial Arts',
        'Group Exercise, Outdoor and Adventure Activities 2.0 0.0 2 W 11:30 AM - 01:30 PM PE-COVEREDCOURT',
      ]);
      assert.strictEqual(merged.length, 1);
      const out = extractClassesFromRow(merged[0]);
      assert.strictEqual(out.length, 1);
      assert.strictEqual(out[0].name, 'PE205 G4/G8');
    });

    test('OC4.3 O-for-zero is repaired inside numbers but not inside words', () => {
      assert.strictEqual(repairOcrDigits('TH O1:00 PM'), 'TH 01:00 PM');
      assert.ok(repairOcrDigits('ONLINE GLE203').includes('ONLINE'), 'ONLINE must survive');
      assert.ok(repairOcrDigits('ONLINE GLE203').includes('GLE203'), 'room code must survive');
    });

    test('OC4.4 A time missing its colon is still read', () => {
      const out = extractClassesFromRow('SDG031 B2 TF 1200 PM - 0130 PM ONLINE');
      assert.strictEqual(out.length, 1);
      assert.strictEqual(out[0].day, 'TF');
    });
  });

  describe('OCR Schedule Suite 4: The Real Study Load, End to End', () => {
    const classes = parseOcrToClasses(REAL_OCR);

    test('OC3.1 Eight subjects become fourteen sessions', () => {
      // Segments: CSIT227 2, CSIT221 2, CSIT104 1, SDG031 1 (one "TF" cell),
      // CSIT213 2, IT227 2, SOCSCI032 2, PE205 1 = 13.
      // SDG031's single segment expands to two days, so 13 segments -> 14 blocks.
      const total = classes.reduce((n, c) => n + normalizeScheduleDays(c.day).length, 0);
      assert.strictEqual(classes.length, 13, 'thirteen schedule segments');
      assert.strictEqual(total, 14, 'fourteen timetable blocks after day expansion');
    });

    test('OC3.2 Every subject from the table is present exactly once per pattern', () => {
      const names = [...new Set(classes.map((c) => c.name))].sort();
      assert.deepStrictEqual(names, [
        'CSIT104 G7', 'CSIT213 G6', 'CSIT221 G5', 'CSIT227 G2',
        'IT227 G4', 'PE205 G4/G8', 'SDG031 B2', 'SOCSCI032 E3/D4',
      ]);
    });

    test('OC3.3 TH reads as Thursday and TF as Tuesday plus Friday', () => {
      const csit227 = classes.filter((c) => c.name === 'CSIT227 G2');
      assert.deepStrictEqual(normalizeScheduleDays(csit227[0].day), [THU]);
      assert.deepStrictEqual(normalizeScheduleDays(csit227[1].day), [MON]);

      const sdg = classes.find((c) => c.name === 'SDG031 B2');
      assert.deepStrictEqual(normalizeScheduleDays(sdg.day), [TUE, FRI]);
    });

    test('OC3.4 Times and durations convert as the timetable expects', () => {
      const it227 = classes.filter((c) => c.name === 'IT227 G4');
      // TH 11:00 AM - 01:00 PM -> 11.0 for 2h
      assert.strictEqual(parseClassHour(it227[0].startTime), 11);
      assert.strictEqual(parseClassDuration(undefined, 11, it227[0].endTime), 2);
      // M 10:30 AM - 01:30 PM -> 10.5 for 3h
      assert.strictEqual(parseClassHour(it227[1].startTime), 10.5);
      assert.strictEqual(parseClassDuration(undefined, 10.5, it227[1].endTime), 3);
    });

    test('OC3.5 An afternoon range does not wrap into a 10-hour block', () => {
      const csit213 = classes.filter((c) => c.name === 'CSIT213 G6');
      const wed = csit213.find((c) => normalizeScheduleDays(c.day)[0] === WED);
      assert.strictEqual(parseClassHour(wed.startTime), 17);
      assert.strictEqual(parseClassDuration(undefined, 17, wed.endTime), 1);
    });

    test('OC3.6 The emitted shape matches the AI scanner contract', () => {
      ['name', 'day', 'startTime', 'endTime', 'room', 'instructor'].forEach((key) => {
        assert.ok(key in classes[0], `missing ${key}`);
        assert.strictEqual(typeof classes[0][key], 'string', `${key} must be a string`);
      });
    });

    test('OC3.7 A page of prose produces nothing rather than junk classes', () => {
      const prose = {
        blocks: [
          { lines: [line('University of Somewhere', 10, 0)] },
          { lines: [line('Office of the Registrar', 40, 0)] },
          { lines: [line('This is to certify that the student', 70, 0)] },
        ],
      };
      assert.deepStrictEqual(parseOcrToClasses(prose), []);
    });
  });
}
