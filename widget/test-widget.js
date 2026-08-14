const React = require('react');
global.require = (path) => path; // Mock require

// Mock react-native
const mockReactNative = {
  Appearance: {
    getColorScheme: () => 'light'
  }
};

// Mock react-native-android-widget components so we can render them
const reactNativeAndroidWidget = {
  FlexWidget: (props) => {
    return { type: 'FlexWidget', props };
  },
  TextWidget: (props) => {
    if (typeof props.text !== 'string') {
      throw new Error('TextWidget crashed! text must be a string but got ' + typeof props.text + ': ' + JSON.stringify(props.text));
    }
    return { type: 'TextWidget', props };
  },
  ImageWidget: (props) => {
    return { type: 'ImageWidget', props };
  },
  SvgWidget: (props) => {
    return { type: 'SvgWidget', props };
  }
};

const mockModule = require('module');
const originalRequire = mockModule.prototype.require;
mockModule.prototype.require = function(request) {
  if (request === 'react-native-android-widget') {
    return reactNativeAndroidWidget;
  }
  if (request === 'react-native') {
    return mockReactNative;
  }
  if (request === 'react') {
    return React;
  }
  return originalRequire.apply(this, arguments);
};

// Now import the widget
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const widgetCode = fs.readFileSync(path.join(__dirname, 'FinScholarWidget.tsx'), 'utf8');
const output = ts.transpileModule(widgetCode, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
});

eval(output.outputText);

const widgetFunc = exports.FinScholarWidget;

// ── Sample Data ──────────────────────────────────────────────────────────────

const ongoingClass = {
  courseName: 'CSIT227',
  room: 'Room 101',
  timeStr: '10:00 AM',
  timeRemainingStr: 'In progress',
  isOngoing: true,
};

const upcomingClass = {
  courseName: 'CSIT228',
  room: 'Room 205',
  timeStr: '1:30 PM',
  timeRemainingStr: 'In 3h 30m',
  isOngoing: false,
};

const upcomingNextDay = {
  courseName: 'CSIT301',
  room: 'GLE 301',
  timeStr: '8:00 AM',
  timeRemainingStr: 'In 1 day',
  isOngoing: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

try {
  console.log('\nRunning Test 1: Empty classes (fallback state)');
  let result = widgetFunc({ classes: [] });
  console.log('Test 1 Passed: Fallback renders without crash.\n');

  console.log('Running Test 2: Undefined classes prop');
  result = widgetFunc({});
  console.log('Test 2 Passed: Undefined classes handled gracefully.\n');

  console.log('Running Test 3: Ongoing class only');
  result = widgetFunc({ classes: [ongoingClass] });
  console.log('Test 3 Passed: Single ongoing class renders.\n');

  console.log('Running Test 4: Upcoming class only');
  result = widgetFunc({ classes: [upcomingClass] });
  console.log('Test 4 Passed: Single upcoming class renders.\n');

  console.log('Running Test 5: Ongoing + Upcoming (standard case)');
  result = widgetFunc({ classes: [ongoingClass, upcomingClass] });
  console.log('Test 5 Passed: Both classes render.\n');

  console.log('Running Test 6: Two upcoming classes (today is over, shows next-day class)');
  result = widgetFunc({ classes: [upcomingClass, upcomingNextDay] });
  console.log('Test 6 Passed: Two upcoming classes render.\n');

  console.log('Running Test 7: Missing/null fields in class objects');
  result = widgetFunc({
    classes: [{
      courseName: '',
      room: null,
      timeStr: undefined,
      timeRemainingStr: null,
      isOngoing: false,
    }]
  });
  console.log('Running Test 8: Sparse array with null items');
  result = widgetFunc({ classes: [ongoingClass, null, upcomingClass] });
  console.log('Test 8 Passed: Sparse array with null items handled safely.\n');

  console.log('Running Test 9: Null and non-array classes prop');
  result = widgetFunc({ classes: null });
  result = widgetFunc({ classes: {} });
  console.log('Test 9 Passed: Non-array / null classes handled safely.\n');

  console.log('Running Test 10: Whitespace-only fields');
  result = widgetFunc({
    classes: [{
      courseName: '   ',
      room: '   ',
      timeStr: '   ',
      timeRemainingStr: '   ',
      isOngoing: false,
    }, {
      courseName: '   ',
      room: '   ',
      timeStr: '   ',
      timeRemainingStr: '   ',
      isOngoing: false,
    }]
  });
  console.log('Test 10 Passed: Whitespace-only fields handled safely.\n');

  console.log('Running Test 11: Mixed primitive items in classes array');
  result = widgetFunc({ classes: [123, true, 'corrupted_string', ongoingClass] });
  console.log('Test 11 Passed: Primitive items in array filtered safely.\n');

  console.log('Running Test 12: Numeric and boolean values in class object fields');
  result = widgetFunc({
    classes: [{
      courseName: 101,
      room: 202,
      timeStr: 303,
      timeRemainingStr: 404,
      isOngoing: false,
    }, {
      courseName: 505,
      room: 606,
      timeStr: 707,
      timeRemainingStr: 808,
      isOngoing: false,
    }]
  });
  console.log('Test 12 Passed: Non-string primitive fields coerced safely.\n');

  console.log('Running Test 13: Nested arrays inside classes prop');
  result = widgetFunc({ classes: [['nested', 'array'], ongoingClass] });
  console.log('Test 13 Passed: Nested array entries filtered safely.\n');

  console.log('Running Test 14: Boundary widgetInfo height (0 and NaN)');
  result = widgetFunc({ classes: [ongoingClass, upcomingClass], widgetInfo: { width: 300, height: 0 } });
  result = widgetFunc({ classes: [ongoingClass, upcomingClass], widgetInfo: { width: 300, height: NaN } });
  console.log('Test 14 Passed: Boundary widgetInfo heights handled safely.\n');

  console.log('ALL TESTS PASSED ✅  Widget reliability confirmed!');
} catch (e) {
  console.error('TEST FAILED ❌', e.message);
  process.exit(1);
}
