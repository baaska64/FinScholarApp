import assert from 'node:assert';
import {
  isTransientFailure,
  friendlyScanError,
  scanBackoffMs,
  SCANNER_BUSY_MESSAGE,
  MAX_SCAN_ATTEMPTS,
  SCAN_BACKOFF_MS,
} from '../utils/scannerErrors.ts';

/** The exact text the provider returned in the field. */
const REAL_OVERLOAD =
  'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.';

export function runScannerErrorTests(describe, test) {
  describe('Scanner Errors Suite 1: Transient Failure Classification', () => {
    test('SE1.1 The provider overload message the user actually hit is transient', () => {
      assert.strictEqual(isTransientFailure(REAL_OVERLOAD), true);
    });

    test('SE1.2 Overload, rate limit and timeout wordings are transient', () => {
      [
        'Overloaded',
        'overloaded_error',
        'The service is temporarily unavailable',
        'Rate limit exceeded',
        'rate-limit reached',
        'Too Many Requests',
        'Request timed out',
        'request timeout',
        'Network request failed',
        'Please try again later',
      ].forEach((msg) => {
        assert.strictEqual(isTransientFailure(msg), true, `expected transient: ${msg}`);
      });
    });

    test('SE1.3 Retryable HTTP status codes are recognised standalone', () => {
      ['429', 'HTTP 503', 'status 529', 'Edge function returned 502', 'gateway 504'].forEach((msg) => {
        assert.strictEqual(isTransientFailure(msg), true, `expected transient: ${msg}`);
      });
    });

    test('SE1.4 A status code embedded in a longer number is NOT a rate limit', () => {
      // Word boundaries matter: a request id or timestamp must not trigger retries.
      ['request 1429 failed', 'id 5029', 'trace 45021', 'code 4290'].forEach((msg) => {
        assert.strictEqual(isTransientFailure(msg), false, `expected permanent: ${msg}`);
      });
    });

    test('SE1.5 Real user-error cases are permanent and must not retry', () => {
      [
        'Could not extract schedule. Make sure the image clearly shows times and days.',
        'You must be logged in to use AI FinSights.',
        'Could not extract image data.',
        'Invalid API key',
        'Your credit balance is too low',
        'image exceeds maximum allowed size',
      ].forEach((msg) => {
        assert.strictEqual(isTransientFailure(msg), false, `expected permanent: ${msg}`);
      });
    });

    test('SE1.6 Missing or empty messages are not treated as transient', () => {
      assert.strictEqual(isTransientFailure(undefined), false);
      assert.strictEqual(isTransientFailure(null), false);
      assert.strictEqual(isTransientFailure(''), false);
    });
  });

  describe('Scanner Errors Suite 2: User-Facing Message Mapping', () => {
    test('SE2.1 Provider overload text never reaches the user verbatim', () => {
      const shown = friendlyScanError(REAL_OVERLOAD);
      assert.strictEqual(shown, SCANNER_BUSY_MESSAGE);
      assert.ok(!/model/i.test(shown), 'must not leak the word "model" to a student');
    });

    test('SE2.2 Actionable errors are passed through unchanged', () => {
      const msg = 'Could not extract schedule. Make sure the image clearly shows times and days.';
      assert.strictEqual(friendlyScanError(msg), msg);
    });

    test('SE2.3 Empty and whitespace messages fall back to a generic line', () => {
      assert.strictEqual(friendlyScanError(''), 'An unexpected error occurred.');
      assert.strictEqual(friendlyScanError('   '), 'An unexpected error occurred.');
      assert.strictEqual(friendlyScanError(undefined), 'An unexpected error occurred.');
    });
  });

  describe('Scanner Errors Suite 3: Retry Budget', () => {
    test('SE3.1 Backoff grows and is defined for every retry the loop can make', () => {
      // The loop retries after every failed attempt except the last.
      for (let i = 0; i < MAX_SCAN_ATTEMPTS - 1; i++) {
        assert.strictEqual(typeof scanBackoffMs(i), 'number');
        assert.ok(scanBackoffMs(i) > 0, `backoff ${i} must be positive`);
      }
      assert.ok(scanBackoffMs(1) > scanBackoffMs(0), 'backoff must increase');
    });

    test('SE3.2 Overrunning the backoff table clamps instead of returning undefined', () => {
      const last = SCAN_BACKOFF_MS[SCAN_BACKOFF_MS.length - 1];
      assert.strictEqual(scanBackoffMs(99), last);
    });

    test('SE3.3 The retry budget stays bounded and small', () => {
      assert.ok(MAX_SCAN_ATTEMPTS >= 2 && MAX_SCAN_ATTEMPTS <= 4);
      const totalWait = SCAN_BACKOFF_MS.slice(0, MAX_SCAN_ATTEMPTS - 1).reduce((a, b) => a + b, 0);
      assert.ok(totalWait <= 8000, 'a student should not wait more than ~8s on retries');
    });
  });
}
