import { register } from 'node:module';
register('../../scripts/test-loader.js', import.meta.url);

import assert from 'node:assert';

function getChildren(node) {
  if (!node || !node.props) return [];
  if (Array.isArray(node.props.children)) return node.props.children.filter(Boolean);
  return node.props.children ? [node.props.children] : [];
}

async function runAdversarialAudit() {
  console.log('=== VICTORY AUDITOR ADVERSARIAL STRESS TEST ===\n');

  const { FinScholarWidget, getFirstGrapheme } = await import('../../widget/FinScholarWidget.tsx');
  const { formatTimeStr, formatCountdown, isValidClass } = await import('../../widget/WidgetTaskHandler.tsx');

  // Test 1: Extreme and Malformed Class Objects
  console.log('1. Testing Extreme Malformed Class Objects...');
  const malformedClasses = [
    null,
    undefined,
    123,
    'not a class',
    {},
    { courseName: '', room: null, timeStr: undefined, timeRemainingStr: null, isOngoing: 'yes' },
    { courseName: '   \t\n  ', room: '   ', timeStr: '   ' },
    { courseName: 'A'.repeat(500), room: 'B'.repeat(500), timeStr: '12:00 PM', timeRemainingStr: 'In 1h' },
  ];

  const wMalformed = FinScholarWidget({ classes: malformedClasses, widgetInfo: { width: 250, height: 330 } });
  assert(wMalformed, 'Widget must render without throwing on malformed inputs');
  console.log('   ✓ Malformed input resilience verified');

  // Test 2: Multi-dash delimiter parsing
  console.log('2. Testing Multi-dash Delimiter Parsing...');
  const dashClasses = [
    { courseName: 'MATH 101 - Calculus I - Section A', room: 'R1', timeStr: '8:00 AM', isOngoing: false },
    { courseName: 'PHYS 201 – Physics with Calculus – Lab', room: 'R2', timeStr: '10:00 AM', isOngoing: false },
    { courseName: 'CHEM 301 — Organic Chemistry — Lecture', room: 'R3', timeStr: '1:00 PM', isOngoing: false },
  ];
  const wDash = FinScholarWidget({ classes: dashClasses, widgetInfo: { width: 250, height: 330 } });
  const topSec = getChildren(wDash)[0];
  const activePanel = getChildren(topSec)[1];
  const activeTitle = getChildren(activePanel)[1];
  assert.strictEqual(activeTitle.props.text, 'MATH 101');

  const bottomSec = getChildren(wDash)[2];
  const upcomingCards = getChildren(getChildren(bottomSec)[0]);
  assert.strictEqual(getChildren(getChildren(upcomingCards[0])[1])[0].props.text, 'PHYS 201');
  assert.strictEqual(getChildren(getChildren(upcomingCards[1])[1])[0].props.text, 'CHEM 301');
  console.log('   ✓ Multi-dash parsing correctly extracts canonical course prefixes');

  // Test 3: Responsive Height Thresholds
  console.log('3. Testing Responsive Height Thresholds...');
  const wVerySmall = FinScholarWidget({ classes: dashClasses, widgetInfo: { width: 250, height: 100 } });
  const bVerySmall = getChildren(wVerySmall)[2];
  assert.strictEqual(getChildren(getChildren(bVerySmall)[0])[0].props.text, 'No other classes today');

  const wSmall = FinScholarWidget({ classes: dashClasses, widgetInfo: { width: 250, height: 200 } });
  const bSmall = getChildren(wSmall)[2];
  assert.strictEqual(getChildren(getChildren(bSmall)[0]).length, 1);

  const wNormal = FinScholarWidget({ classes: dashClasses, widgetInfo: { width: 250, height: 330 } });
  const bNormal = getChildren(wNormal)[2];
  assert.strictEqual(getChildren(getChildren(bNormal)[0]).length, 2);
  console.log('   ✓ Responsive height truncation verified for 100dp, 200dp, and 330dp');

  // Test 4: Extreme Floating Point & Negative Times in TaskHandler
  console.log('4. Testing Extreme Times in TaskHandler helpers...');
  assert.strictEqual(formatTimeStr(-5), '7:00 PM'); // wraps around properly
  assert.strictEqual(formatTimeStr(25), '1:00 AM'); // wraps around properly
  assert.strictEqual(formatTimeStr(12.0001), '12:00 PM');
  assert.strictEqual(formatTimeStr(12.9999), '1:00 PM');
  assert.strictEqual(formatCountdown(-10, false), 'In progress');
  assert.strictEqual(formatCountdown(100000, false), 'In 4166 days');
  console.log('   ✓ Extreme numerical time/countdown inputs handled robustly');

  console.log('\n=== ALL ADVERSARIAL STRESS CHECKS PASSED ===');
}

runAdversarialAudit().catch(err => {
  console.error('Adversarial stress error:', err);
  process.exit(1);
});
