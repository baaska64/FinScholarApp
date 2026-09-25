import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  PUSH_INTERVAL_MS,
  NO_ROW_CODE,
  readRemoteStamp,
  planLedgerFetch,
  emptyPushQueue,
  enqueuePush,
  requestFlush,
  cancelPush,
  beginPush,
  settlePush,
  decidePush,
} from '../utils/syncPlan.ts';

/**
 * sync()'s branch logic as it stood before the timestamp probe, given the
 * whole remote ledger. The probe may only skip the download when this could
 * not have needed it.
 */
function legacySyncDecision(remoteData, localData, lastSynced) {
  if (!remoteData) return 'no-remote';
  const remoteUpdated = remoteData.last_updated || 0;
  const localUpdated = localData?.last_updated || 0;
  if (localData && remoteData && localUpdated > lastSynced && remoteUpdated > lastSynced && remoteUpdated !== localUpdated) return 'conflict';
  if (remoteUpdated > lastSynced && remoteUpdated > localUpdated) return 'download';
  if (localUpdated > lastSynced) return 'push-local';
  return 'saved';
}

/**
 * Drives the push queue exactly as SyncService.drivePushQueue does, against a
 * fake clock, a fake timer and a fake server that takes `latencyMs` to answer.
 */
function createPushSim({ latencyMs = 400 } = {}) {
  const sim = {
    t0: 1_700_000_000_000,
    now: 1_700_000_000_000,
    queue: emptyPushQueue(),
    timerAt: null,
    job: null,
    online: true,
    appActive: true,
    canPush: true,
    attempts: [],
    saves: [],
    remote: null,
  };
  const drive = () => {
    const d = decidePush(sim.queue, sim.now, { canPush: sim.canPush, appActive: sim.appActive });
    if (d.kind === 'wait') {
      if (sim.timerAt === null) sim.timerAt = sim.now + d.delayMs;
      return;
    }
    sim.timerAt = null;
    if (d.kind !== 'push') return;
    const { queue, ledger, epoch } = beginPush(sim.queue, sim.now);
    sim.queue = queue;
    sim.attempts.push({ at: sim.now, ledger, ok: sim.online, newestSaved: sim.saves.at(-1)?.ledger });
    if (sim.attempts.length > 10_000) throw new Error('push loop');
    sim.job = { doneAt: sim.now + latencyMs, ledger, epoch, ok: sim.online };
  };
  sim.save = (ledger) => {
    sim.saves.push({ at: sim.now, ledger });
    sim.queue = enqueuePush(sim.queue, ledger);
    drive();
  };
  sim.flush = () => { sim.queue = requestFlush(sim.queue); drive(); };
  sim.cancel = () => { sim.queue = cancelPush(sim.queue); drive(); };
  sim.background = () => { sim.appActive = false; sim.flush(); };
  sim.advance = (ms) => {
    const end = sim.now + ms;
    for (;;) {
      const next = Math.min(sim.timerAt ?? Infinity, sim.job?.doneAt ?? Infinity);
      if (next > end) break;
      sim.now = next;
      if (sim.job && sim.job.doneAt === next) {
        const job = sim.job;
        sim.job = null;
        if (job.ok) sim.remote = job.ledger;
        sim.queue = settlePush(sim.queue, job, job.ok ? 'sent' : 'failed');
        drive();
      } else {
        sim.timerAt = null;
        drive();
      }
    }
    sim.now = end;
  };
  return sim;
}

const readSource = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

export function runSyncPlanTests(describe, test) {
  describe('Sync Plan Suite 1: Timestamp probe before download', () => {
    test('SP1.1 Classifies the probe response: row, no row, failed request', () => {
      assert.deepStrictEqual(readRemoteStamp({ data: { last_updated: 123 }, error: null }), { kind: 'found', lastUpdated: 123 });
      assert.deepStrictEqual(readRemoteStamp({ data: { last_updated: null }, error: null }), { kind: 'found', lastUpdated: null });
      // The live 406 PostgREST returns for `.single()` with no matching row.
      assert.deepStrictEqual(
        readRemoteStamp({ data: null, error: { code: NO_ROW_CODE, details: 'The result contains 0 rows', hint: null, message: 'Cannot coerce the result to a single JSON object' } }),
        { kind: 'missing' },
      );
      assert.deepStrictEqual(readRemoteStamp({ data: null, error: { code: '', message: 'FetchError: Network request failed' } }), { kind: 'unknown' });
      assert.deepStrictEqual(readRemoteStamp(null), { kind: 'unknown' });
    });

    test('SP1.2 Skips the download only when nothing changed on either side', () => {
      const found = (lastUpdated) => ({ kind: 'found', lastUpdated });
      assert.strictEqual(planLedgerFetch({ kind: 'missing' }, 500, 100), 'no-remote');
      assert.strictEqual(planLedgerFetch(found(100), 100, 100), 'up-to-date');
      assert.strictEqual(planLedgerFetch(found(100), 0, 100), 'up-to-date', 'no local ledger: sync() already left it alone');
      assert.strictEqual(planLedgerFetch(found(100), 150, 100), 'download', 'local changed: the existing path decides');
      assert.strictEqual(planLedgerFetch(found(200), 100, 100), 'download', 'remote changed');
      assert.strictEqual(planLedgerFetch({ kind: 'unknown' }, 100, 100), 'download', 'probe failed: fall back to the existing path');
    });

    test('SP1.3 A ledger without a numeric last_updated always downloads', () => {
      // Four of the seven production ledgers had no last_updated when this shipped.
      assert.strictEqual(planLedgerFetch({ kind: 'found', lastUpdated: null }, 0, 0), 'download');
      assert.strictEqual(planLedgerFetch({ kind: 'found', lastUpdated: undefined }, 0, 0), 'download');
      assert.strictEqual(planLedgerFetch({ kind: 'found', lastUpdated: '100' }, 100, 100), 'download');
    });

    test('SP1.4 Never skips a download the old sync() would have used, across every state combination', () => {
      const stamps = [0, 100, 200, 300];
      const remotes = [null, {}, ...stamps.map((v) => ({ last_updated: v }))];
      const locals = [null, {}, ...stamps.map((v) => ({ last_updated: v }))];
      let checked = 0;
      for (const remote of remotes) {
        for (const local of locals) {
          for (const lastSynced of stamps) {
            const stamp = remote
              ? { kind: 'found', lastUpdated: remote.last_updated ?? null }
              : { kind: 'missing' };
            const plan = planLedgerFetch(stamp, local?.last_updated || 0, lastSynced);
            const legacy = legacySyncDecision(remote, local, lastSynced);
            const label = JSON.stringify({ remote, local, lastSynced, plan, legacy });
            if (plan === 'up-to-date') assert.strictEqual(legacy, 'saved', label);
            if (plan === 'no-remote') assert.strictEqual(legacy, 'no-remote', label);
            if (legacy === 'conflict' || legacy === 'download') assert.strictEqual(plan, 'download', label);
            checked++;
          }
        }
      }
      assert.strictEqual(checked, 6 * 6 * 4);
    });
  });

  describe('Sync Plan Suite 2: Push decisions', () => {
    const at = 1_000_000;
    const active = { canPush: true, appActive: true };

    test('SP2.1 Nothing queued, nothing to do', () => {
      assert.deepStrictEqual(decidePush(emptyPushQueue(), at, active), { kind: 'idle' });
    });

    test('SP2.2 The first change after a quiet spell pushes at once; later ones wait out the window', () => {
      const q = enqueuePush(emptyPushQueue(), { v: 1 });
      assert.deepStrictEqual(decidePush(q, at, active), { kind: 'push' });
      const pushed = beginPush(q, at);
      const settled = settlePush(pushed.queue, pushed, 'sent');
      const again = enqueuePush(settled, { v: 2 });
      assert.deepStrictEqual(decidePush(again, at + 5_000, active), { kind: 'wait', delayMs: PUSH_INTERVAL_MS - 5_000 });
      assert.deepStrictEqual(decidePush(again, at + PUSH_INTERVAL_MS, active), { kind: 'push' });
    });

    test('SP2.3 The login guard blocks every push, flushed or backgrounded', () => {
      const q = requestFlush(enqueuePush(emptyPushQueue(), { v: 1 }));
      assert.deepStrictEqual(decidePush(q, at, { canPush: false, appActive: true }), { kind: 'idle' });
      assert.deepStrictEqual(decidePush(q, at, { canPush: false, appActive: false }), { kind: 'idle' });
    });

    test('SP2.4 Only one push is ever in flight, even when flushed', () => {
      const first = beginPush(enqueuePush(emptyPushQueue(), { v: 1 }), at);
      const q = requestFlush(enqueuePush(first.queue, { v: 2 }));
      assert.deepStrictEqual(decidePush(q, at + 100, active), { kind: 'idle' });
      assert.deepStrictEqual(decidePush(q, at + 100, { canPush: true, appActive: false }), { kind: 'idle' });
    });

    test('SP2.5 A flush or the background skips the window', () => {
      const pushed = beginPush(enqueuePush(emptyPushQueue(), { v: 1 }), at);
      const q = enqueuePush(settlePush(pushed.queue, pushed, 'sent'), { v: 2 });
      assert.deepStrictEqual(decidePush(requestFlush(q), at + 1_000, active), { kind: 'push' });
      assert.deepStrictEqual(decidePush(q, at + 1_000, { canPush: true, appActive: false }), { kind: 'push' });
    });

    test('SP2.6 A parked (failed) push waits for a flush, even in the background', () => {
      const pushed = beginPush(enqueuePush(emptyPushQueue(), { v: 1 }), at);
      const q = settlePush(pushed.queue, pushed, 'failed');
      assert.strictEqual(q.parked, true);
      assert.deepStrictEqual(q.pending, { v: 1 }, 'the failed ledger is kept');
      assert.deepStrictEqual(decidePush(q, at + 10 * PUSH_INTERVAL_MS, active), { kind: 'idle' });
      assert.deepStrictEqual(decidePush(q, at + 10 * PUSH_INTERVAL_MS, { canPush: true, appActive: false }), { kind: 'idle' });
      assert.deepStrictEqual(decidePush(requestFlush(q), at + 1, active), { kind: 'push' });
    });

    test('SP2.7 A guest push (no session) is not a failure and is not retried', () => {
      const pushed = beginPush(enqueuePush(emptyPushQueue(), { v: 1 }), at);
      const q = settlePush(pushed.queue, pushed, 'no-user');
      assert.strictEqual(q.pending, null);
      assert.strictEqual(q.inFlight, false);
    });

    test('SP2.8 A wall clock set backwards never stalls the queue past one interval', () => {
      const pushed = beginPush(enqueuePush(emptyPushQueue(), { v: 1 }), at);
      const q = enqueuePush(settlePush(pushed.queue, pushed, 'sent'), { v: 2 });
      const d = decidePush(q, at - 3_600_000, active);
      assert.strictEqual(d.kind, 'wait');
      assert.ok(d.delayMs <= PUSH_INTERVAL_MS, `waited ${d.delayMs} ms`);
    });

    test('SP2.9 Flushing an empty queue asks for nothing', () => {
      assert.strictEqual(requestFlush(emptyPushQueue()).flushRequested, false);
    });
  });

  describe('Sync Plan Suite 3: Push queue over time (fake clock)', () => {
    test('SP3.1 A 3-minute study session: pushes >= 25 s apart, each one the newest ledger', () => {
      const sim = createPushSim();
      for (let i = 0; i < 90; i++) {
        sim.save({ v: i });
        sim.advance(2_000);
      }
      sim.advance(PUSH_INTERVAL_MS + 1_000);

      assert.strictEqual(sim.attempts[0].at, sim.t0, 'the first answer pushes at once');
      for (let i = 1; i < sim.attempts.length; i++) {
        assert.ok(sim.attempts[i].at - sim.attempts[i - 1].at >= PUSH_INTERVAL_MS, `push ${i} came too soon`);
      }
      assert.ok(sim.attempts.length <= Math.ceil(180_000 / PUSH_INTERVAL_MS) + 1, `${sim.attempts.length} pushes for 90 saves`);
      for (const a of sim.attempts) {
        assert.strictEqual(a.ledger, a.newestSaved, `push at +${a.at - sim.t0} ms sent a stale ledger`);
      }
      assert.deepStrictEqual(sim.remote, { v: 89 }, 'the last answer reached the server');
      assert.strictEqual(sim.queue.pending, null);
    });

    test('SP3.2 Backgrounding mid-window sends the newest ledger immediately', () => {
      const sim = createPushSim();
      sim.save({ v: 1 });
      sim.advance(1_000);
      sim.save({ v: 2 });
      sim.save({ v: 3 });
      sim.advance(1_000);
      assert.strictEqual(sim.attempts.length, 1);
      sim.background();
      assert.strictEqual(sim.attempts.length, 2);
      assert.strictEqual(sim.attempts[1].at, sim.t0 + 2_000);
      sim.advance(1_000);
      assert.deepStrictEqual(sim.remote, { v: 3 });
    });

    test('SP3.3 A save landing after the app is backgrounded is not left on a timer', () => {
      const sim = createPushSim();
      sim.save({ v: 1 });
      sim.advance(1_000);
      sim.background();
      sim.save({ v: 2 });
      assert.strictEqual(sim.attempts.at(-1).ledger.v, 2);
    });

    test('SP3.4 A flush while a push is in flight sends the queued ledger right after it', () => {
      const sim = createPushSim({ latencyMs: 400 });
      sim.save({ v: 1 });
      sim.advance(100);
      sim.save({ v: 2 });
      sim.flush();
      assert.strictEqual(sim.attempts.length, 1, 'never two pushes at once');
      sim.advance(300);
      assert.strictEqual(sim.attempts.length, 2);
      assert.strictEqual(sim.attempts[1].at, sim.t0 + 400, 'did not wait out the interval');
      sim.advance(400);
      assert.deepStrictEqual(sim.remote, { v: 2 });
    });

    test('SP3.5 Offline: a failed push is kept, never retried in a loop, and sent by the next flush', () => {
      const sim = createPushSim();
      sim.online = false;
      sim.save({ v: 1 });
      sim.advance(10 * 60_000);
      assert.strictEqual(sim.attempts.length, 1, 'no retry loop while offline');
      assert.deepStrictEqual(sim.queue.pending, { v: 1 }, 'not dropped');
      sim.online = true;
      sim.flush();
      sim.advance(1_000);
      assert.deepStrictEqual(sim.remote, { v: 1 });
      assert.strictEqual(sim.queue.pending, null);
    });

    test('SP3.6 Offline in the background: one attempt per flush, no loop', () => {
      const sim = createPushSim();
      sim.online = false;
      sim.appActive = false;
      sim.save({ v: 1 });
      sim.advance(1_000);
      sim.save({ v: 2 });
      sim.advance(10 * 60_000);
      assert.strictEqual(sim.attempts.length, 2);
      assert.deepStrictEqual(sim.queue.pending, { v: 2 });
    });

    test('SP3.7 A newer save supersedes a failed push and still respects the window', () => {
      const sim = createPushSim({ latencyMs: 400 });
      sim.online = false;
      sim.save({ v: 1 });
      sim.advance(100);
      sim.save({ v: 2 }); // arrives while v1 is failing in flight
      sim.advance(300);
      assert.deepStrictEqual(sim.queue.pending, { v: 2 }, 'the failed v1 is not re-queued over v2');
      assert.strictEqual(sim.queue.parked, false);
      sim.online = true;
      sim.advance(PUSH_INTERVAL_MS);
      assert.strictEqual(sim.attempts.length, 2);
      assert.strictEqual(sim.attempts[1].at, sim.t0 + PUSH_INTERVAL_MS);
      assert.deepStrictEqual(sim.remote, { v: 2 });
    });

    test('SP3.8 Signing in cancels the queue, and a push failing in flight is not re-queued', () => {
      const sim = createPushSim({ latencyMs: 400 });
      sim.online = false;
      sim.save({ v: 1 });
      sim.advance(100);
      sim.save({ v: 2 });
      sim.canPush = false; // SIGNED_IN: initialSyncComplete = false
      sim.cancel();
      sim.advance(PUSH_INTERVAL_MS * 4);
      assert.strictEqual(sim.queue.pending, null, 'the old session\'s ledger must not reach the new one');
      assert.strictEqual(sim.attempts.length, 1);
      sim.flush();
      sim.background();
      assert.strictEqual(sim.attempts.length, 1);
    });
  });

  describe('Sync Plan Suite 4: SyncService wiring', () => {
    const sync = readSource('services/SyncService.ts');

    test('SP4.1 Every remote push goes through the throttled queue', () => {
      assert.strictEqual((sync.match(/this\._syncRemote\(/g) || []).length, 1, '_syncRemote must be called only from drivePushQueue');
      assert.ok(sync.includes('enqueuePush(this.pushQueue'), 'pushLocalChanges queues instead of pushing');
      assert.ok(sync.includes("AppState.addEventListener('change'"), 'the background flush is wired');
    });

    test('SP4.2 sync() probes the timestamp before downloading the ledger', () => {
      const probe = sync.indexOf("select('last_updated:ledger_data->last_updated')");
      const full = sync.indexOf("select('ledger_data')");
      assert.ok(probe > 0 && full > probe);
    });

    test('SP4.3 Logout flushes before wiping, and leaving the Study tab flushes', () => {
      const profile = readSource('app/(tabs)/profile.tsx');
      const logout = profile.slice(profile.indexOf('async function handleLogout'));
      assert.ok(logout.indexOf('flushPendingPush') > 0);
      assert.ok(logout.indexOf('flushPendingPush') < logout.indexOf("removeItem('grade_ledger_v2_data')"));
      assert.ok(readSource('app/(tabs)/flashcards.tsx').includes('SyncService.flushPendingPush()'));
    });
  });
}
