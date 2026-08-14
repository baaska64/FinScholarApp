const React = require('react');
const path = require('path');
const assert = require('assert');

// Register ts-node or babel if needed, or require compiled / ts file using ts-node/register
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    jsx: 'react-jsx'
  }
});

const { FinScholarWidget } = require('../../widget/FinScholarWidget');

console.log('--- EMPIRICAL TEST HARNESS FOR WIDGET VERIFICATION ---');

// Test 1: Light Mode Component Tree
const lightElement = FinScholarWidget({
  classes: [
    { courseName: 'CS 101', room: 'Lab 3', timeStr: '9:00 AM', timeRemainingStr: 'In 30m', isOngoing: true },
    { courseName: 'MATH 201', room: 'Rm 402', timeStr: '11:00 AM', timeRemainingStr: 'In 2h', isOngoing: false }
  ],
  isDark: false
});

assert.strictEqual(lightElement.props.clickAction, 'OPEN_APP');
assert.ok(lightElement.props.clickActionData.uri.startsWith('finscholarapp://schedule?viewMode=attendance'));
assert.strictEqual(lightElement.props.style.flex, 1);
assert.strictEqual(lightElement.props.style.width, 'match_parent');
assert.strictEqual(lightElement.props.style.backgroundColor, '#ffffff');

// Inspect Top Section (Child 0)
const topSectionLight = lightElement.props.children[0];
assert.strictEqual(topSectionLight.props.style.width, 'match_parent');
assert.strictEqual(topSectionLight.props.style.height, undefined, 'Top container height must not be hardcoded');
assert.deepStrictEqual(topSectionLight.props.style.backgroundGradient, {
  from: '#3b82f6',
  to: '#1d4ed8',
  orientation: 'TL_BR'
});

// Inspect SVG Wave (Child 4 of top section)
const svgDividerLight = topSectionLight.props.children[4];
assert.ok(svgDividerLight.props.svg.includes('fill="#ffffff"'), 'SVG wave fill in light mode must be #ffffff');

// Inspect Bottom Section (Child 1)
const bottomSectionLight = lightElement.props.children[1];
assert.strictEqual(bottomSectionLight.props.style.flex, 1);
assert.strictEqual(bottomSectionLight.props.style.width, 'match_parent');
assert.strictEqual(bottomSectionLight.props.style.height, undefined, 'Bottom container height must not be hardcoded');
assert.strictEqual(bottomSectionLight.props.style.backgroundColor, '#ffffff');

console.log('✓ Light Mode verification passed.');

// Test 2: Dark Mode Component Tree
const darkElement = FinScholarWidget({
  classes: [
    { courseName: 'CS 101', room: 'Lab 3', timeStr: '9:00 AM', timeRemainingStr: 'In 30m', isOngoing: true },
    { courseName: 'MATH 201', room: 'Rm 402', timeStr: '11:00 AM', timeRemainingStr: 'In 2h', isOngoing: false }
  ],
  isDark: true
});

assert.strictEqual(darkElement.props.style.backgroundColor, '#0f172a');
const topSectionDark = darkElement.props.children[0];
assert.deepStrictEqual(topSectionDark.props.style.backgroundGradient, {
  from: '#3b82f6',
  to: '#1d4ed8',
  orientation: 'TL_BR'
}, 'Top gradient must remain #3b82f6 -> #1d4ed8 in dark mode');

const svgDividerDark = topSectionDark.props.children[4];
assert.ok(svgDividerDark.props.svg.includes('fill="#0f172a"'), 'SVG wave fill in dark mode must be #0f172a');

const bottomSectionDark = darkElement.props.children[1];
assert.strictEqual(bottomSectionDark.props.style.backgroundColor, '#0f172a');

console.log('✓ Dark Mode verification passed.');

// Test 3: Empty State Component Tree
const emptyElement = FinScholarWidget({
  classes: [],
  isDark: true
});

assert.strictEqual(emptyElement.props.clickAction, 'OPEN_APP');
assert.ok(emptyElement.props.clickActionData.uri.startsWith('finscholarapp://schedule?viewMode=attendance'));
assert.strictEqual(emptyElement.props.style.flex, 1);
assert.strictEqual(emptyElement.props.style.width, 'match_parent');
assert.strictEqual(emptyElement.props.style.height, undefined, 'Empty state root container height must not be hardcoded');
assert.strictEqual(emptyElement.props.style.backgroundColor, '#0f172a');

console.log('✓ Empty state verification passed.');

console.log('\n--- ALL EMPIRICAL CHECKS PASSED ---');
