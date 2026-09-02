import assert from 'node:assert';
import { getGradeTier, getGradeTierColor, getGradeTierLabel } from '../utils/gradeTiers.ts';

export function runGradeTierTests(describe, test) {
  describe('Grade Tiers Suite 1: Band boundaries', () => {
    test('GT1.1 90 and above is Outstanding, 89.9 is not', () => {
      assert.strictEqual(getGradeTier(90).key, 'outstanding');
      assert.strictEqual(getGradeTier(100).key, 'outstanding');
      assert.strictEqual(getGradeTier(89.9).key, 'on-track');
    });

    test('GT1.2 75 opens On track, 60 opens Passing', () => {
      assert.strictEqual(getGradeTier(75).key, 'on-track');
      assert.strictEqual(getGradeTier(74.9).key, 'passing');
      assert.strictEqual(getGradeTier(60).key, 'passing');
      assert.strictEqual(getGradeTier(59.9).key, 'needs-work');
    });

    test('GT1.3 Anything above zero but below 60 is Needs work', () => {
      assert.strictEqual(getGradeTier(0.1).key, 'needs-work');
      assert.strictEqual(getGradeTier(45).key, 'needs-work');
    });

    test('GT1.4 Zero, negatives and non-numbers all mean "no grades yet"', () => {
      assert.strictEqual(getGradeTier(0).key, 'none');
      assert.strictEqual(getGradeTier(-10).key, 'none');
      assert.strictEqual(getGradeTier(NaN).key, 'none');
      assert.strictEqual(getGradeTier(undefined).key, 'none');
    });

    test('GT1.5 hasData false overrides a real percentage', () => {
      // A paused subject keeps its scores but must not read as a grade.
      assert.strictEqual(getGradeTier(95, false).key, 'none');
      assert.strictEqual(getGradeTierLabel(95, false), 'No grades yet');
    });
  });

  describe('Grade Tiers Suite 2: Colour resolution', () => {
    test('GT2.1 Every band resolves to a distinct hex in each scheme', () => {
      const samples = [95, 80, 65, 30, 0];
      for (const isDark of [true, false]) {
        const colors = samples.map(p => getGradeTierColor(p, isDark));
        assert.strictEqual(new Set(colors).size, samples.length, `bands collided in ${isDark ? 'dark' : 'light'}`);
        colors.forEach(c => assert.match(c, /^#[0-9a-f]{6}$/i));
      }
    });

    test('GT2.2 Light and dark never return the same hex for a band', () => {
      // The dark values are lifted variants; if a refactor collapses them the
      // grade colours go muddy on the dark canvas.
      for (const p of [95, 80, 65, 30, 0]) {
        assert.notStrictEqual(getGradeTierColor(p, true), getGradeTierColor(p, false));
      }
    });

    test('GT2.3 The no-data grey is shared by zero and by hasData false', () => {
      assert.strictEqual(getGradeTierColor(0, true), getGradeTierColor(88, true, false));
    });
  });

  describe('Grade Tiers Suite 3: Labels', () => {
    test('GT3.1 Labels track the bands', () => {
      assert.strictEqual(getGradeTierLabel(92), 'Outstanding');
      assert.strictEqual(getGradeTierLabel(80), 'On track');
      assert.strictEqual(getGradeTierLabel(62), 'Passing');
      assert.strictEqual(getGradeTierLabel(40), 'Needs work');
      assert.strictEqual(getGradeTierLabel(0), 'No grades yet');
    });
  });
}
