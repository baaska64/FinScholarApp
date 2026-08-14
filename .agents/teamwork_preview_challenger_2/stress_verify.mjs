import assert from 'node:assert';
import { register } from 'node:module';

register('../../scripts/test-loader.js', import.meta.url);

if (typeof globalThis.require === 'undefined') {
  globalThis.require = (specifier) => specifier;
}

const { formatTimeStr, formatCountdown, isValidClass } = await import('../../widget/WidgetTaskHandler.tsx');
const { getSubjectStyle, getSubjectIcon, getThemeTokens } = await import('../../widget/subjectUtils.ts');

console.log('=== STRESS TEST & BOUNDARY VERIFICATION HARNESS ===');

// 1. Time string formatter boundaries
assert.strictEqual(formatTimeStr(0), '12:00 AM');
assert.strictEqual(formatTimeStr(7.5), '7:30 AM');
assert.strictEqual(formatTimeStr(12), '12:00 PM');
assert.strictEqual(formatTimeStr(13.25), '1:15 PM');
assert.strictEqual(formatTimeStr(23.75), '11:45 PM');
console.log('✓ Time string formatter boundary tests passed');

// 2. Countdown formatter boundaries
assert.strictEqual(formatCountdown(0.1, true), 'In progress');
assert.strictEqual(formatCountdown(0.25, false), 'In 15m');
assert.strictEqual(formatCountdown(1.5, false), 'In 1h 30m');
assert.strictEqual(formatCountdown(2.0, false), 'In 2h');
assert.strictEqual(formatCountdown(25, false), 'In 1 day');
assert.strictEqual(formatCountdown(48, false), 'In 2 days');
console.log('✓ Countdown formatter boundary tests passed');

// 3. Class object validator bounds
assert.strictEqual(isValidClass(null), false);
assert.strictEqual(isValidClass({}), false);
assert.strictEqual(isValidClass({ name: '  ', startHour: 9, day: 1 }), false);
assert.strictEqual(isValidClass({ name: 'CS101', startHour: '9', day: 1 }), false);
assert.strictEqual(isValidClass({ name: 'CS101', startHour: 9, day: 1 }), true);
console.log('✓ Class validator boundary tests passed');

// 4. Deterministic subject style hashing distribution & consistency
const name1 = 'Computer Science 101';
const style1a = getSubjectStyle(name1);
const style1b = getSubjectStyle(name1);
assert.deepStrictEqual(style1a, style1b, 'Subject style must be 100% deterministic');

const nullStyle = getSubjectStyle(null);
const emptyStyle = getSubjectStyle('');
assert.ok(nullStyle.color && nullStyle.lightBg && nullStyle.darkBg);
assert.ok(emptyStyle.color && emptyStyle.lightBg && emptyStyle.darkBg);
console.log('✓ Deterministic hashing & null safety passed');

// 5. Keyword subject icon mapper
assert.strictEqual(getSubjectIcon('CS 101'), 'code');
assert.strictEqual(getSubjectIcon('Intro to Programming'), 'code');
assert.strictEqual(getSubjectIcon('Calculus II'), 'math');
assert.strictEqual(getSubjectIcon('University Physics 1'), 'science');
assert.strictEqual(getSubjectIcon('World Literature'), 'book');
assert.strictEqual(getSubjectIcon('Physical Education'), 'school');
assert.strictEqual(getSubjectIcon(null), 'school');
console.log('✓ Keyword icon resolution passed');

// 6. Theme token resolution
const lightTokens = getThemeTokens(false);
const darkTokens = getThemeTokens(true);
assert.strictEqual(lightTokens.bgColor, '#f8fafc');
assert.strictEqual(lightTokens.cardColor, '#ffffff');
assert.strictEqual(darkTokens.bgColor, '#0f172a');
assert.strictEqual(darkTokens.cardColor, '#1e293b');
console.log('✓ Theme tokens resolution passed');

console.log('\n=== ALL STRESS & BOUNDARY VERIFICATIONS SUCCESSFUL ===');
