import assert from 'node:assert';
import { register } from 'node:module';
import path from 'node:path';

register('../../scripts/test-loader.js', import.meta.url);

if (typeof globalThis.require === 'undefined') {
  globalThis.require = (specifier) => specifier;
}

const { FinScholarWidget } = await import('../../widget/FinScholarWidget.tsx');
const { FlexWidget, TextWidget, SvgWidget, ImageWidget } = await import('react-native-android-widget');

console.log('=== EMPIRICAL VERIFICATION HARNESS ===');

function getChildren(node) {
  if (!node || !node.props) return [];
  if (Array.isArray(node.props.children)) return node.props.children.filter(Boolean);
  return node.props.children ? [node.props.children] : [];
}

// 1. Zero hardcoded absolute heights on root, top, or bottom containers
console.log('\n[Check 1] Hardcoded absolute heights verification:');
const sampleClasses = [
  { courseName: 'CS 101', room: 'Lab 3', timeStr: '9:00 AM', timeRemainingStr: 'In 30m', isOngoing: true },
  { courseName: 'MATH 201', room: 'Rm 402', timeStr: '11:00 AM', timeRemainingStr: 'In 2h', isOngoing: false }
];

const widget = FinScholarWidget({ classes: sampleClasses, isDark: false });

// Root container
assert.strictEqual(widget.props.style.flex, 1);
assert.strictEqual(widget.props.style.width, 'match_parent');
assert.strictEqual(widget.props.style.height, undefined, 'Root container must not have hardcoded height');
console.log('  ✓ Root container has flex: 1, width: match_parent, height: undefined');

// Top container
const topSection = getChildren(widget)[0];
assert.strictEqual(topSection.props.style.width, 'match_parent');
assert.strictEqual(topSection.props.style.height, undefined, 'Top section container must not have hardcoded height');
console.log('  ✓ Top section container has width: match_parent, height: undefined');

// Bottom container
const bottomSection = getChildren(widget)[1];
assert.strictEqual(bottomSection.props.style.flex, 1);
assert.strictEqual(bottomSection.props.style.width, 'match_parent');
assert.strictEqual(bottomSection.props.style.height, undefined, 'Bottom section container must not have hardcoded height');
console.log('  ✓ Bottom section container has flex: 1, width: match_parent, height: undefined');

// Empty state root container
const emptyWidget = FinScholarWidget({ classes: [], isDark: false });
assert.strictEqual(emptyWidget.props.style.flex, 1);
assert.strictEqual(emptyWidget.props.style.width, 'match_parent');
assert.strictEqual(emptyWidget.props.style.height, undefined, 'Empty state root container must not have hardcoded height');
console.log('  ✓ Empty state root container has flex: 1, width: match_parent, height: undefined');

// 2. Top section background gradient invariant under both light and dark mode
console.log('\n[Check 2] Top section background gradient invariance:');
const lightWidget = FinScholarWidget({ classes: sampleClasses, isDark: false });
const lightTop = getChildren(lightWidget)[0];
assert.deepStrictEqual(lightTop.props.style.backgroundGradient, {
  from: '#3b82f6',
  to: '#1d4ed8',
  orientation: 'TL_BR'
});

const darkWidget = FinScholarWidget({ classes: sampleClasses, isDark: true });
const darkTop = getChildren(darkWidget)[0];
assert.deepStrictEqual(darkTop.props.style.backgroundGradient, {
  from: '#3b82f6',
  to: '#1d4ed8',
  orientation: 'TL_BR'
});
console.log('  ✓ Top section gradient is invariant (#3b82f6 -> #1d4ed8 TL_BR) in both light and dark mode');

// 3. SVG wave divider path fill matches bottom section background color dynamically
console.log('\n[Check 3] SVG wave divider path fill dynamic matching:');
const lightSvg = getChildren(lightTop).find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');
assert.ok(lightSvg.props.svg.includes('fill="#ffffff"'), 'Light mode wave fill must match #ffffff');
assert.strictEqual(getChildren(lightWidget)[1].props.style.backgroundColor, '#ffffff');

const darkSvg = getChildren(darkTop).find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');
assert.ok(darkSvg.props.svg.includes('fill="#0f172a"'), 'Dark mode wave fill must match #0f172a');
assert.strictEqual(getChildren(darkWidget)[1].props.style.backgroundColor, '#0f172a');
console.log('  ✓ SVG wave fill dynamically matches bottom background color (#ffffff in light, #0f172a in dark)');

// 4. Deep link URL format and OPEN_APP click action
console.log('\n[Check 4] Deep link format and OPEN_APP click action:');
assert.strictEqual(lightWidget.props.clickAction, 'OPEN_APP');
assert.ok(
  typeof lightWidget.props.clickActionData.uri === 'string' &&
  lightWidget.props.clickActionData.uri.startsWith('finscholarapp://schedule?viewMode=attendance'),
  `Invalid deep link format: ${lightWidget.props.clickActionData.uri}`
);
assert.strictEqual(emptyWidget.props.clickAction, 'OPEN_APP');
assert.ok(
  typeof emptyWidget.props.clickActionData.uri === 'string' &&
  emptyWidget.props.clickActionData.uri.startsWith('finscholarapp://schedule?viewMode=attendance'),
  `Invalid deep link format: ${emptyWidget.props.clickActionData.uri}`
);
console.log('  ✓ Deep link URL format (finscholarapp://schedule...) and OPEN_APP click action verified on both populated and empty widgets');

console.log('\n=== ALL EMPIRICAL VERIFICATIONS SUCCESSFUL ===');
