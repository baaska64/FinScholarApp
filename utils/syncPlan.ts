/**
 * Remote-sync decisions, kept pure so the harness can drive them with a fake
 * clock. `services/SyncService.ts` owns every side effect (timers, Supabase,
 * AsyncStorage); what is decided here is *whether* to download the ledger and
 * *when* to push it.
 */

/**
 * A push uploads the whole ledger, and the Study tab saves on every answer, so
 * pushes are throttled: the first change after a quiet spell goes at once and
 * everything inside the window coalesces into one push of the newest ledger.
 */
export const PUSH_INTERVAL_MS = 25_000;

/** PostgREST's code for `.single()` matching no row. */
export const NO_ROW_CODE = 'PGRST116';

// ─── Download: probe the timestamp before fetching the ledger ──────────────

export type RemoteStamp =
  | { kind: 'missing' }                       // the user has no ledger row
  | { kind: 'found'; lastUpdated: unknown }   // `ledger_data->last_updated`, possibly null
  | { kind: 'unknown' };                      // the probe itself failed

/** Classifies the `{ data, error }` of the timestamp-only `.single()` query. */
export function readRemoteStamp(res: { data?: any; error?: any } | null | undefined): RemoteStamp {
  if (res?.data) return { kind: 'found', lastUpdated: res.data.last_updated };
  if (res?.error?.code === NO_ROW_CODE) return { kind: 'missing' };
  return { kind: 'unknown' };
}

export type FetchPlan =
  | 'no-remote'    // no row: take sync()'s "no cloud data" branch without downloading
  | 'up-to-date'   // nothing changed on either side since the last sync
  | 'download';    // anything else: the existing full-download path decides

/**
 * Skips the download only when the answer cannot depend on the ledger's
 * contents. A ledger without a numeric `last_updated` (older builds wrote
 * some) always downloads, so it goes through exactly the path it did before.
 */
export function planLedgerFetch(remote: RemoteStamp, localUpdated: number, lastSynced: number): FetchPlan {
  if (remote.kind === 'missing') return 'no-remote';
  if (
    remote.kind === 'found' &&
    typeof remote.lastUpdated === 'number' &&
    remote.lastUpdated === lastSynced &&
    localUpdated <= lastSynced
  ) {
    return 'up-to-date';
  }
  return 'download';
}

// ─── Upload: the throttled push queue ─────────────────────────────────────

export interface PushQueue<T> {
  /** Newest ledger not yet handed to Supabase. Always the whole ledger, so a newer one supersedes it. */
  pending: T | null;
  /** `pending` already failed once: hold it for a flush or a newer ledger rather than retry on a timer. */
  parked: boolean;
  /** Send `pending` as soon as nothing is in flight, ignoring the interval. */
  flushRequested: boolean;
  inFlight: boolean;
  /** When the last push started, ms. 0 = never, so the first push is immediate. */
  lastPushAt: number;
  /** Bumped by `cancelPush`, so a push that fails after a cancel is not re-queued. */
  epoch: number;
}

export type PushOutcome = 'sent' | 'failed' | 'no-user';

export type PushDecision =
  | { kind: 'idle' }
  | { kind: 'push' }
  | { kind: 'wait'; delayMs: number };

export function emptyPushQueue<T>(): PushQueue<T> {
  return { pending: null, parked: false, flushRequested: false, inFlight: false, lastPushAt: 0, epoch: 0 };
}

export function enqueuePush<T>(q: PushQueue<T>, ledger: T): PushQueue<T> {
  return { ...q, pending: ledger, parked: false };
}

export function requestFlush<T>(q: PushQueue<T>): PushQueue<T> {
  return { ...q, flushRequested: q.pending !== null };
}

/** Drops the queued ledger. The data is still in AsyncStorage, unsynced, so the next `sync()` reconciles it. */
export function cancelPush<T>(q: PushQueue<T>): PushQueue<T> {
  return { ...q, pending: null, parked: false, flushRequested: false, epoch: q.epoch + 1 };
}

export function beginPush<T>(q: PushQueue<T>, now: number): { queue: PushQueue<T>; ledger: T; epoch: number } {
  return {
    queue: { ...q, pending: null, parked: false, flushRequested: false, inFlight: true, lastPushAt: now },
    ledger: q.pending as T,
    epoch: q.epoch,
  };
}

/**
 * A failed push goes back in the queue unless a newer ledger replaced it
 * meanwhile (the newer one carries the same changes) or the queue was
 * cancelled. `no-user` is not a failure: a guest has nowhere to push to.
 */
export function settlePush<T>(
  q: PushQueue<T>,
  sent: { ledger: T; epoch: number },
  outcome: PushOutcome,
): PushQueue<T> {
  const settled = { ...q, inFlight: false };
  if (outcome === 'failed' && sent.epoch === q.epoch && q.pending === null) {
    return { ...settled, pending: sent.ledger, parked: true };
  }
  return settled;
}

/**
 * `canPush` is SyncService's `initialSyncComplete` login guard. Only one push
 * is ever in flight: two concurrent upserts could land out of order and leave
 * the server on the older ledger. In the background there is no waiting — the
 * OS may suspend the app before a timer fires.
 */
export function decidePush<T>(
  q: PushQueue<T>,
  now: number,
  opts: { canPush: boolean; appActive: boolean; interval?: number },
): PushDecision {
  const interval = opts.interval ?? PUSH_INTERVAL_MS;
  if (q.pending === null || !opts.canPush || q.inFlight) return { kind: 'idle' };
  if (q.flushRequested) return { kind: 'push' };
  // Parked is checked before the background rule, or a failing push would
  // retry in a tight loop while the app sits offline in the background.
  if (q.parked) return { kind: 'idle' };
  if (!opts.appActive) return { kind: 'push' };
  const readyAt = q.lastPushAt + interval;
  if (now >= readyAt) return { kind: 'push' };
  // Clamped so a wall clock set backwards cannot stall the queue past one interval.
  return { kind: 'wait', delayMs: Math.min(interval, readyAt - now) };
}
