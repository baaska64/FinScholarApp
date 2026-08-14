import assert from 'node:assert';
import {
  getSubjectStyle,
  getSubjectIcon,
  getThemeTokens,
  SUBJECT_PALETTE,
} from '../widget/subjectUtils.ts';

export function runSubjectUtilsTests(describe, test) {
  describe('SubjectUtils Suite 1: Deterministic Color Hashing & Distribution', () => {
    test('1.1 Same input string always yields identical palette entry', () => {
      const courseName = 'CS 101 - Intro to Computer Science';
      const style1 = getSubjectStyle(courseName);
      const style2 = getSubjectStyle(courseName);
      const style3 = getSubjectStyle(courseName);

      assert.deepStrictEqual(style1, style2);
      assert.deepStrictEqual(style2, style3);
      assert.strictEqual(typeof style1.color, 'string');
      assert.strictEqual(typeof style1.lightBg, 'string');
      assert.strictEqual(typeof style1.darkBg, 'string');
    });

    test('1.2 Distinct course names produce a distribution of palette entries', () => {
      const courses = [
        'CS101',
        'MATH201',
        'PHYS102',
        'ENG105',
        'CHEM301',
        'HIST202',
        'BIO110',
        'ART100',
        'PE101',
        'STAT300'
      ];

      const usedColors = new Set();
      courses.forEach((c) => {
        const style = getSubjectStyle(c);
        usedColors.add(style.color);
      });

      // Distribution check: At least 4 distinct palette colors among 10 different course names
      assert(
        usedColors.size >= 4,
        `Expected at least 4 distinct colors, got ${usedColors.size}`
      );
    });

    test('1.3 All returned subject styles have valid color strings', () => {
      SUBJECT_PALETTE.forEach((entry) => {
        assert(/^#[0-9a-fA-F]{6}$/.test(entry.color), `Invalid hex color: ${entry.color}`);
        assert(/^#[0-9a-fA-F]{6}$/.test(entry.lightBg), `Invalid hex lightBg: ${entry.lightBg}`);
        assert(/^#[0-9a-fA-F]{6}$/.test(entry.darkBg), `Invalid hex darkBg: ${entry.darkBg}`);
      });
    });
  });

  describe('SubjectUtils Suite 2: Keyword Icon Resolution', () => {
    test('2.1 CS and IT keywords resolve to "code"', () => {
      assert.strictEqual(getSubjectIcon('CS101'), 'code');
      assert.strictEqual(getSubjectIcon('CS 102'), 'code');
      assert.strictEqual(getSubjectIcon('IT 201'), 'code');
      assert.strictEqual(getSubjectIcon('Intro to Computer Science'), 'code');
      assert.strictEqual(getSubjectIcon('Software Engineering'), 'code');
      assert.strictEqual(getSubjectIcon('Data Structures'), 'code');
      assert.strictEqual(getSubjectIcon('Web Development'), 'code');
    });

    test('2.2 MATH and CALC keywords resolve to "math"', () => {
      assert.strictEqual(getSubjectIcon('MATH101'), 'math');
      assert.strictEqual(getSubjectIcon('MATH 202'), 'math');
      assert.strictEqual(getSubjectIcon('Calculus I'), 'math');
      assert.strictEqual(getSubjectIcon('Linear Algebra'), 'math');
      assert.strictEqual(getSubjectIcon('STAT 301'), 'math');
      assert.strictEqual(getSubjectIcon('Statistics'), 'math');
    });

    test('2.3 PHYS, CHEM, and SCI keywords resolve to "science"', () => {
      assert.strictEqual(getSubjectIcon('PHYS101'), 'science');
      assert.strictEqual(getSubjectIcon('Physics Lab'), 'science');
      assert.strictEqual(getSubjectIcon('CHEM201'), 'science');
      assert.strictEqual(getSubjectIcon('General Chemistry'), 'science');
      assert.strictEqual(getSubjectIcon('General Science'), 'science');
      assert.strictEqual(getSubjectIcon('Biology 101'), 'science');
    });

    test('2.4 ENG and LIT keywords resolve to "book"', () => {
      assert.strictEqual(getSubjectIcon('ENG101'), 'book');
      assert.strictEqual(getSubjectIcon('English Composition'), 'book');
      assert.strictEqual(getSubjectIcon('LIT 202'), 'book');
      assert.strictEqual(getSubjectIcon('World Literature'), 'book');
      assert.strictEqual(getSubjectIcon('History 101'), 'book');
      assert.strictEqual(getSubjectIcon('Philosophy'), 'book');
    });

    test('2.5 Unmatched course names resolve to default "school"', () => {
      assert.strictEqual(getSubjectIcon('PE 101'), 'school');
      assert.strictEqual(getSubjectIcon('Physical Education'), 'school');
      assert.strictEqual(getSubjectIcon('REED 102'), 'school');
      assert.strictEqual(getSubjectIcon('National Service'), 'school');
    });
  });

  describe('SubjectUtils Suite 3: Empty and Invalid Input Handling', () => {
    test('3.1 getSubjectStyle handles empty string, null, and undefined gracefully', () => {
      const defaultStyle = SUBJECT_PALETTE[0];

      assert.deepStrictEqual(getSubjectStyle(''), defaultStyle);
      assert.deepStrictEqual(getSubjectStyle('   '), defaultStyle);
      assert.deepStrictEqual(getSubjectStyle(null), defaultStyle);
      assert.deepStrictEqual(getSubjectStyle(undefined), defaultStyle);
      assert.deepStrictEqual(getSubjectStyle(12345), defaultStyle);
    });

    test('3.2 getSubjectIcon handles empty string, null, and undefined gracefully', () => {
      assert.strictEqual(getSubjectIcon(''), 'school');
      assert.strictEqual(getSubjectIcon('   '), 'school');
      assert.strictEqual(getSubjectIcon(null), 'school');
      assert.strictEqual(getSubjectIcon(undefined), 'school');
      assert.strictEqual(getSubjectIcon(9999), 'school');
    });
  });

  describe('SubjectUtils Suite 4: Light and Dark Theme Token Resolution', () => {
    test('4.1 Light mode theme tokens', () => {
      const tokens = getThemeTokens(false);

      assert.strictEqual(tokens.bgColor, '#f8fafc');
      assert.strictEqual(tokens.cardColor, '#ffffff');
      assert.strictEqual(tokens.cardBorder, '#e2e8f0');
      assert.strictEqual(tokens.textColor, '#0f172a');
      assert.strictEqual(tokens.textSecondary, '#475569');
      assert.strictEqual(tokens.textTertiary, '#94a3b8');
      assert.strictEqual(tokens.primaryColor, '#4f46e5');
      assert.strictEqual(tokens.successColor, '#10b981');
      assert.strictEqual(tokens.successBg, '#d1fae5');
    });

    test('4.2 Dark mode theme tokens', () => {
      const tokens = getThemeTokens(true);

      assert.strictEqual(tokens.bgColor, '#0f172a');
      assert.strictEqual(tokens.cardColor, '#1e293b');
      assert.strictEqual(tokens.cardBorder, '#334155');
      assert.strictEqual(tokens.textColor, '#f8fafc');
      assert.strictEqual(tokens.textSecondary, '#cbd5e1');
      assert.strictEqual(tokens.textTertiary, '#64748b');
      assert.strictEqual(tokens.primaryColor, '#818cf8');
      assert.strictEqual(tokens.successColor, '#34d399');
      assert.strictEqual(tokens.successBg, '#134e3a');
    });
  });
}
