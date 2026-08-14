# TEST_INFRA.md — FinScholar App Test Infrastructure

## Overview
FinScholar App Dashboard Redesign testing infrastructure provides headless, fast, zero-network-dependency unit and state verification tests.

## Test Runner Command
```bash
npm test
# Or directly via Node:
node --experimental-strip-types scripts/run-tests.js
```

## Architecture
- **Engine**: Node.js 24+ native ES module runner with `--experimental-strip-types` for fast type-stripping without compilation overhead.
- **Module Loader**: `scripts/test-loader.js` resolves path aliases (`@/*` -> `./*`) and intercepts UI framework imports (`react-native` -> `scripts/mocks/react-native.js`).
- **Mocks**: `scripts/mocks/react-native.js` provides lightweight mocks for React Native primitives (`Platform`).
- **Calculation Helpers**: `__tests__/helpers/dashboardCalculations.js` exposes pure state calculation functions for Semester Progress, Attendance Stats, Subject Task Completion, Pending Tasks Count, and Hero Card Summary.

## Directory Layout
```
c:\Projects\FinScholarApp\
├── package.json                   # Updated with "test": "node --experimental-strip-types scripts/run-tests.js"
├── scripts/
│   ├── run-tests.js               # Main test runner & colorized reporter
│   ├── test-loader.js             # ES Module loader for aliases and react-native mock
│   └── mocks/
│       └── react-native.js        # React Native mock layer
├── __tests__/
│   ├── helpers/
│   │   └── dashboardCalculations.js   # Calculation helpers for dashboard metrics
│   ├── tier1-feature-coverage.test.js # Tier 1 test suite
│   ├── tier2-boundary-edge-cases.test.js # Tier 2 test suite
│   ├── tier3-cross-feature-interactions.test.js # Tier 3 test suite
│   └── tier4-real-world-theme.test.js # Tier 4 test suite
├── TEST_INFRA.md                  # Testing infrastructure documentation
└── TEST_READY.md                  # Test suite readiness certification
```
