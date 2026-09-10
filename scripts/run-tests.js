import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// `services/supabaseClient.js` refuses to construct a client without real
// config, so that a misconfigured build fails instead of quietly reaching
// production. Node has no .env, and the auth suite imports the real module to
// assert its shape — never to make a request — so give it inert placeholders.
// This has to live on the main thread: module hooks run on their own thread,
// and process.env set inside the loader does not propagate back here.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'http://localhost/supabase-test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

// Register test-loader for ES module aliases (@/*) and react-native mock
register('./test-loader.js', import.meta.url);

if (typeof globalThis.require === 'undefined') {
  globalThis.require = (specifier) => specifier;
}

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalSuites = 0;
let passedSuites = 0;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

const startTime = Date.now();

function createHarness() {
  let currentSuiteName = '';
  // Suites register synchronously but a test body may be async. Everything is
  // queued onto one chain and awaited in order, so an async test's assertions
  // actually run, and its result prints under its own suite heading instead of
  // resolving into the void after the summary.
  let chain = Promise.resolve();

  const describe = (suiteName, suiteFn) => {
    totalSuites++;
    currentSuiteName = suiteName;
    chain = chain.then(() => {
      console.log(`\n${BOLD}${CYAN}=== ${suiteName} ===${RESET}`);
    });
    try {
      suiteFn();
      passedSuites++;
    } catch (err) {
      console.log(`  ${RED}✖ Suite "${suiteName}" failed: ${err.message}${RESET}`);
    }
  };

  const test = (testName, testFn) => {
    totalTests++;
    const suiteName = currentSuiteName;
    chain = chain.then(async () => {
      try {
        await testFn();
        passedTests++;
        console.log(`  ${GREEN}✓${RESET} ${testName}`);
      } catch (err) {
        failedTests++;
        failures.push({ suite: suiteName, test: testName, error: err });
        console.log(`  ${RED}✖${RESET} ${testName}`);
        console.log(`    ${RED}${err.message}${RESET}`);
        if (err.stack) {
          const stackLines = err.stack.split('\n').slice(1, 4).join('\n    ');
          console.log(`    ${YELLOW}${stackLines}${RESET}`);
        }
      }
    });
  };

  /** Resolves once every queued suite and test has run. */
  const flush = () => chain;

  return { describe, test, flush };
}

async function run() {
  console.log(`\n${BOLD}====================================================${RESET}`);
  console.log(`${BOLD}    FinScholar App Dashboard Redesign Test Runner   ${RESET}`);
  console.log(`${BOLD}====================================================${RESET}`);

  const harness = createHarness();

  try {
    const { runTier1Tests } = await import('../__tests__/tier1-feature-coverage.test.js');
    runTier1Tests(harness.describe, harness.test);

    const { runTier2Tests } = await import('../__tests__/tier2-boundary-edge-cases.test.js');
    runTier2Tests(harness.describe, harness.test);

    const { runTier3Tests } = await import('../__tests__/tier3-cross-feature-interactions.test.js');
    runTier3Tests(harness.describe, harness.test);

    const { runTier4Tests } = await import('../__tests__/tier4-real-world-theme.test.js');
    runTier4Tests(harness.describe, harness.test);

    const { runAdversarialTests } = await import('../__tests__/adversarial-stress.test.js');
    runAdversarialTests(harness.describe, harness.test);

    const { runLedgerTests } = await import('../__tests__/ledger.test.js');
    runLedgerTests(harness.describe, harness.test);

    const { runStateMutationStressTests } = await import('../__tests__/state-mutation-stress.test.js');
    runStateMutationStressTests(harness.describe, harness.test);

    const { runScheduleRedesignTests } = await import('../__tests__/schedule-redesign-stress.test.js');
    runScheduleRedesignTests(harness.describe, harness.test);

    const { runScheduleTests } = await import('../__tests__/schedule.test.js');
    runScheduleTests(harness.describe, harness.test);

    const { runChallengerReverificationTests } = await import('../__tests__/challenger-gate2-reverification.test.js');
    runChallengerReverificationTests(harness.describe, harness.test);

    const { runSubjectUtilsTests } = await import('../__tests__/subjectUtils.test.js');
    runSubjectUtilsTests(harness.describe, harness.test);

    const { runWidgetTests } = await import('../__tests__/widget.test.js');
    runWidgetTests(harness.describe, harness.test);

    const { runWidgetTaskHandlerTests } = await import('../__tests__/widgetTaskHandler.test.js');
    runWidgetTaskHandlerTests(harness.describe, harness.test);

    const { runEmpiricalStressHarness } = await import('../__tests__/challenger-stress-harness.js');
    runEmpiricalStressHarness(harness.describe, harness.test);

    const { runChallengerAuthAdversarialTests } = await import('../__tests__/challenger-auth-adversarial.test.js');
    runChallengerAuthAdversarialTests(harness.describe, harness.test);

    const { runTasksRedesignTests } = await import('../__tests__/tasks-redesign.test.js');
    runTasksRedesignTests(harness.describe, harness.test);

    const { runStudyRedesignTests } = await import('../__tests__/study.test.js');
    runStudyRedesignTests(harness.describe, harness.test);

    const { runChallengerStudyAdversarialTests } = await import('../__tests__/challenger-study-adversarial.test.js');
    runChallengerStudyAdversarialTests(harness.describe, harness.test);

    const { runGamificationPersistenceStressTests } = await import('../__tests__/challenger-gamification-persistence-stress.test.js');
    runGamificationPersistenceStressTests(harness.describe, harness.test);

    const { runGoogleAuthProductionTests } = await import('../__tests__/google-auth-production.test.js');
    runGoogleAuthProductionTests(harness.describe, harness.test);

    const { runBentoDashboardTests } = await import('../__tests__/bento-dashboard-redesign.test.js');
    runBentoDashboardTests(harness.describe, harness.test);

    const { runOnboardingTests } = await import('../__tests__/onboarding.test.js');
    runOnboardingTests(harness.describe, harness.test);

    const { runSpotlightTests } = await import('../__tests__/spotlight.test.js');
    runSpotlightTests(harness.describe, harness.test);

    const { runScannerErrorTests } = await import('../__tests__/scanner-errors.test.js');
    runScannerErrorTests(harness.describe, harness.test);

    const { runScheduleParsingTests } = await import('../__tests__/schedule-parsing.test.js');
    runScheduleParsingTests(harness.describe, harness.test);

    const { runOcrScheduleTests } = await import('../__tests__/ocr-schedule.test.js');
    runOcrScheduleTests(harness.describe, harness.test);

    const { runGradeTierTests } = await import('../__tests__/grade-tiers.test.js');
    runGradeTierTests(harness.describe, harness.test);

    const { runQuickEditTests } = await import('../__tests__/quick-edit.test.js');
    runQuickEditTests(harness.describe, harness.test);

    const { runReleaseTests } = await import('../__tests__/release.test.js');
    runReleaseTests(harness.describe, harness.test);

    const { runCalendarTests } = await import('../__tests__/calendar.test.js');
    runCalendarTests(harness.describe, harness.test);

  } catch (err) {
    console.error(`\n${RED}Fatal runner error:${RESET}`, err);
    process.exit(1);
  }

  // Drain the queue before reporting: async bodies finish here.
  await harness.flush();

  const durationMs = Date.now() - startTime;

  console.log(`\n${BOLD}====================================================${RESET}`);
  console.log(`${BOLD}                   TEST RESULTS SUMMARY             ${RESET}`);
  console.log(`${BOLD}====================================================${RESET}`);
  console.log(`Test Suites: ${passedSuites === totalSuites ? GREEN : RED}${passedSuites} passed${RESET}, ${totalSuites} total`);
  console.log(`Tests:       ${failedTests === 0 ? GREEN : RED}${passedTests} passed${RESET}, ${failedTests} failed, ${totalTests} total`);
  console.log(`Time:        ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`${BOLD}====================================================${RESET}\n`);

  if (failures.length > 0) {
    console.log(`${BOLD}${RED}FAILED TESTS:${RESET}`);
    failures.forEach((f, idx) => {
      console.log(`\n${idx + 1}) [${f.suite}] ${f.test}`);
      console.log(`   ${RED}${f.error.stack || f.error.message}${RESET}`);
    });
    process.exit(1);
  } else {
    console.log(`${BOLD}${GREEN}✔ ALL TEST SUITES PASSED SUCCESSFULLY!${RESET}\n`);
    process.exit(0);
  }
}

run();
