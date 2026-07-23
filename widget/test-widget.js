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
          throw new Error('TextWidget crashed! text must be a string but got ' + typeof props.text + ': ' + props.text);
      }
      return { type: 'TextWidget', props };
  },
  ImageWidget: (props) => {
      return { type: 'ImageWidget', props };
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
  return originalRequire.apply(this, arguments);
};

// Now import the widget
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const widgetCode = fs.readFileSync(path.join(__dirname, 'FinScholarWidget.tsx'), 'utf8');
const transformed = babel.transformSync(widgetCode, {
    filename: 'FinScholarWidget.tsx',
    presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript']
});

eval(transformed.code);

const widgetFunc = exports.FinScholarWidget;

try {
    console.log("Running Test 1: Undefined className");
    let result = widgetFunc({ className: undefined, room: undefined, timeStr: undefined, timeRemainingStr: undefined });
    console.log("Test 1 Passed: Did not crash!");
    
    console.log("Running Test 2: Invalid text data types");
    result = widgetFunc({ className: { object: true }, room: null, timeStr: 123, timeRemainingStr: [] });
    console.log("Test 2 Passed: Did not crash!");
    
    console.log("Running Test 3: Normal data");
    result = widgetFunc({ className: "CSIT227", room: "Room 101", timeStr: "2:30 PM", timeRemainingStr: "In 14m" });
    console.log("Test 3 Passed: Did not crash!");

    console.log("\nALL TESTS PASSED: Widget reliability confirmed!");
} catch (e) {
    console.error("TEST FAILED:", e.message);
    process.exit(1);
}
