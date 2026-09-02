/**
 * Failure classification for the AI schedule scanner.
 *
 * The scanner calls a Supabase edge function, which relays the model
 * provider's own error text. Some of those are explicitly temporary — the
 * provider says so itself ("Spikes in demand are usually temporary") — and are
 * worth retrying before bothering the student. Everything else (a bad image,
 * an auth problem) will fail again no matter how many times we ask.
 *
 * Kept out of the modal so the matching is testable: getting this wrong either
 * hammers an already-overloaded provider or gives up on a request that would
 * have succeeded a second later.
 */

/** Total attempts, including the first. */
export const MAX_SCAN_ATTEMPTS = 3;

/** Pause before the next try, indexed by the attempt that just failed. */
export const SCAN_BACKOFF_MS = [1200, 3000];

export const SCANNER_BUSY_MESSAGE =
  "Fin's scanner is busy right now. Give it a minute and try again — your image is still here.";

/**
 * Word boundaries around the status codes are load-bearing: without them a
 * request id or timestamp containing "429" would look like a rate limit and
 * send us into a pointless retry loop.
 */
const TRANSIENT =
  /overload|high demand|spikes in demand|try again later|temporarily unavailable|rate.?limit|too many requests|\b(?:429|502|503|504|529)\b|timed? ?out|network request failed/i;

export function isTransientFailure(message?: string | null): boolean {
  return TRANSIENT.test(message || '');
}

/**
 * The provider's wording talks about "this model", which means nothing to a
 * student. Callers should log the raw text and show this instead.
 */
export function friendlyScanError(raw?: string | null): string {
  if (isTransientFailure(raw)) return SCANNER_BUSY_MESSAGE;
  const trimmed = (raw || '').trim();
  return trimmed || 'An unexpected error occurred.';
}

/** Pause before retrying after `failedAttempt` (0-indexed). */
export function scanBackoffMs(failedAttempt: number): number {
  return SCAN_BACKOFF_MS[failedAttempt] ?? SCAN_BACKOFF_MS[SCAN_BACKOFF_MS.length - 1];
}
