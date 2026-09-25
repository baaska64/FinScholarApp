import { AppState } from 'react-native';
import { supabase } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from './NotificationService';
import { widgetTaskHandler } from '../widget/WidgetTaskHandler';
import {
  PushOutcome, PushQueue, beginPush, cancelPush, decidePush, emptyPushQueue,
  enqueuePush, planLedgerFetch, readRemoteStamp, requestFlush, settlePush,
} from '../utils/syncPlan';

export type SyncState = 'offline' | 'syncing' | 'saved' | 'conflict';
export type ConflictResolution = 'keep_local' | 'keep_remote';

class SyncServiceClass {
  private listeners: ((state: SyncState) => void)[] = [];
  private conflictListeners: ((localData: any, remoteData: any) => void)[] = [];
  private dataChangeListeners: (() => void)[] = [];
  private currentState: SyncState = 'offline';
  private isPremiumUser: boolean = false;
  private premiumLoaded: boolean = false;
  
  /**
   * Guards remote pushes until the first sync() after login completes.
   * This prevents guest data from silently overwriting cloud data.
   */
  private initialSyncComplete: boolean = false;
  private syncInProgress: boolean = false;

  /** Throttled remote pushes; the decisions live in utils/syncPlan.ts. */
  private pushQueue: PushQueue<any> = emptyPushQueue();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pushInFlight: Promise<void> | null = null;

  constructor() {
    this.loadLocalPremium();
    this.listenForAuthChanges();
    // The OS may suspend or kill a backgrounded app before the throttle
    // window ends, so anything queued goes now.
    AppState.addEventListener('change', (next) => {
      if (next !== 'active') this.flushPendingPush().catch(console.error);
    });
  }

  private async loadLocalPremium() {
    try {
      const val = await AsyncStorage.getItem('@is_premium');
      if (val === 'true') {
        this.isPremiumUser = true;
      }
    } catch(e) {}
    this.premiumLoaded = true;
    this.emitDataChange();
  }

  /**
   * Listen for auth state changes. When user signs in, reset the
   * sync guard and immediately run sync() to detect conflicts
   * BEFORE any pushLocalChanges can overwrite cloud data.
   */
  private listenForAuthChanges() {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Reset guard — block all remote pushes until sync() finishes
        this.initialSyncComplete = false;
        this.cancelPendingPush();
        // Run sync to compare local vs cloud and detect conflicts
        this.sync();
      } else if (event === 'SIGNED_OUT') {
        this.initialSyncComplete = false;
        this.cancelPendingPush();
      }
    });
  }

  public getIsPremium() {
    return this.isPremiumUser;
  }

  public async setPremiumUser(status: boolean) {
    this.isPremiumUser = status;
    await AsyncStorage.setItem('@is_premium', status ? 'true' : 'false');
    this.emitDataChange();
  }

  /**
   * Check Supabase for premium status and restore it locally.
   * Call this on app launch and after login to ensure premium persists.
   */
  public async checkAndRestorePremium() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: profileData } = await supabase.from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();

      if (profileData) {
        const remotePremium = !!profileData.is_premium;
        if (remotePremium !== this.isPremiumUser) {
          await this.setPremiumUser(remotePremium);
        }
      }
    } catch (e) {
      console.error('Failed to check premium status from Supabase', e);
    }
  }

  public subscribe(listener: (state: SyncState) => void) {
    this.listeners.push(listener);
    listener(this.currentState);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  public subscribeConflict(listener: (localData: any, remoteData: any) => void) {
    this.conflictListeners.push(listener);
    return () => { this.conflictListeners = this.conflictListeners.filter(l => l !== listener); };
  }

  public subscribeDataChange(listener: () => void) {
    this.dataChangeListeners.push(listener);
    return () => { this.dataChangeListeners = this.dataChangeListeners.filter(l => l !== listener); };
  }

  public getState() {
    return this.currentState;
  }

  private setState(state: SyncState) {
    this.currentState = state;
    this.listeners.forEach(l => l(state));
  }

  private emitConflict(localData: any, remoteData: any) {
    this.setState('conflict');
    // Notify listeners (SyncProvider will show the conflict modal)
    this.conflictListeners.forEach(l => l(localData, remoteData));
  }

  private async emitDataChange() {
    this.dataChangeListeners.forEach(l => l());
    await new Promise(resolve => setTimeout(resolve, 50));
    await this.triggerSideEffects();
  }

  private async triggerSideEffects() {
    try {
      const dataStr = await AsyncStorage.getItem('grade_ledger_v2_data');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        await NotificationService.scheduleNextClassNotification(data);
        await NotificationService.scheduleStudyNotification(data);
      }
      await widgetTaskHandler();
    } catch (e) {
      console.error('Failed side effects', e);
    }
  }

  async pushLocalChanges(newData: any) {
    newData.last_updated = Date.now();
    await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(newData));
    
    // Notify listeners so they can update state
    this.dataChangeListeners.forEach(l => l());

    // YIELD THE EVENT LOOP (50ms delay): 
    // This allows React to immediately repaint the UI (e.g. show the checkmark) 
    // before we freeze the JS thread generating the native widget image.
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Now we can do heavy side effects (widget generation) safely.
    // We still await this so if the OS suspends the app, it waits for the widget.
    await this.triggerSideEffects();
    
    // Only push to remote if initial sync has completed.
    // This prevents guest data from silently overwriting the user's cloud data
    // before the conflict check has run.
    if (this.initialSyncComplete) {
      this.pushQueue = enqueuePush(this.pushQueue, newData);
      this.drivePushQueue();
    }
  }

  /**
   * Sends the queued ledger now instead of at the end of the throttle window,
   * and resolves once nothing is in flight. Await it before anything that
   * wipes the local ledger or ends the session.
   */
  public async flushPendingPush() {
    this.pushQueue = requestFlush(this.pushQueue);
    this.drivePushQueue();
    while (this.pushInFlight) await this.pushInFlight;
  }

  private cancelPendingPush() {
    this.pushQueue = cancelPush(this.pushQueue);
    this.drivePushQueue();
  }

  private drivePushQueue() {
    const decision = decidePush(this.pushQueue, Date.now(), {
      canPush: this.initialSyncComplete,
      appActive: AppState.currentState === 'active',
    });
    if (decision.kind === 'wait') {
      // An armed timer already targets this moment: lastPushAt only moves when a push starts.
      if (!this.pushTimer) {
        this.pushTimer = setTimeout(() => {
          this.pushTimer = null;
          this.drivePushQueue();
        }, decision.delayMs);
      }
      return;
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    if (decision.kind !== 'push') return;

    const { queue, ledger, epoch } = beginPush(this.pushQueue, Date.now());
    this.pushQueue = queue;
    this.pushInFlight = this._syncRemote(ledger)
      .catch((e): PushOutcome => {
        console.error('Failed to push local changes', e);
        return 'failed';
      })
      .then((outcome) => {
        this.pushQueue = settlePush(this.pushQueue, { ledger, epoch }, outcome);
        this.pushInFlight = null;
        this.drivePushQueue();
      });
  }

  private async _syncRemote(newData: any): Promise<PushOutcome> {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      this.setState('offline');
      return 'no-user';
    }

    this.setState('syncing');
    try {
      // supabase-js reports a failed request in `error` instead of throwing.
      // Unchecked, a push that never arrived still advanced
      // @last_synced_timestamp, so no later sync() would re-send it.
      const { error } = await supabase.from('user_ledgers').upsert({ id: user.id, ledger_data: newData });
      if (error) throw error;
      await AsyncStorage.setItem('@last_synced_timestamp', newData.last_updated.toString());
      this.setState('saved');
      return 'sent';
    } catch (e) {
      console.error('Failed to push local changes', e);
      this.setState('offline');
      return 'failed';
    }
  }

  async sync() {
    // Prevent concurrent syncs
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      this.syncInProgress = false;
      // If no user (guest mode), mark sync complete so local saves work normally
      this.initialSyncComplete = true;
      this.setState('offline');
      return;
    }

    this.setState('syncing');

    try {
      // Always restore premium from Supabase on sync
      await this.checkAndRestorePremium();

      const localDataStr = await AsyncStorage.getItem('grade_ledger_v2_data');
      const localData = localDataStr ? JSON.parse(localDataStr) : null;

      const lastSyncedStr = await AsyncStorage.getItem('@last_synced_timestamp');
      const lastSynced = lastSyncedStr ? parseInt(lastSyncedStr, 10) : 0;

      // Probe the timestamp first: the whole ledger is the app's largest
      // download, and most launches have nothing new to fetch.
      const stamp = await supabase.from('user_ledgers')
        .select('last_updated:ledger_data->last_updated')
        .eq('id', user.id)
        .single();
      const plan = planLedgerFetch(readRemoteStamp(stamp), localData?.last_updated || 0, lastSynced);

      if (plan === 'up-to-date' || plan === 'push-local') {
        // The cloud still holds what this device last synced, so neither
        // branch reads the remote ledger and it is never downloaded.
        this.initialSyncComplete = true;
        if (plan === 'push-local') {
          await this.pushLocalChanges(localData);
        } else {
          this.setState('saved');
        }
        this.syncInProgress = false;
        return;
      }

      let remoteData: any = null;
      if (plan === 'download') {
        const { data: dbData } = await supabase.from('user_ledgers').select('ledger_data').eq('id', user.id).single();
        remoteData = dbData?.ledger_data;
      }

      if (!remoteData) {
        // No cloud data — safe to push local (even guest data) to the new account
        this.initialSyncComplete = true;
        if (localData) {
          await this.pushLocalChanges(localData);
        } else {
          this.setState('saved');
        }
        this.syncInProgress = false;
        return;
      }

      const remoteUpdated = remoteData.last_updated || 0;
      const localUpdated = localData?.last_updated || 0;

      // Both local and remote have unseen changes → CONFLICT
      if (localData && remoteData && localUpdated > lastSynced && remoteUpdated > lastSynced && remoteUpdated !== localUpdated) {
        // Do NOT set initialSyncComplete — block pushes until user resolves
        // (and drop a queued one: it must not land while the user is choosing)
        this.cancelPendingPush();
        this.emitConflict(localData, remoteData);
        this.syncInProgress = false;
        return;
      } else if (remoteUpdated > lastSynced && remoteUpdated > localUpdated) {
        // Remote is newer — download cloud data
        this.cancelPendingPush();
        await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(remoteData));
        await AsyncStorage.setItem('@last_synced_timestamp', remoteUpdated.toString());
        await this.emitDataChange();
        this.initialSyncComplete = true;
        this.setState('saved');
      } else if (localUpdated > lastSynced) {
        // Local is newer — push to cloud
        this.initialSyncComplete = true;
        await this.pushLocalChanges(localData);
      } else {
        this.initialSyncComplete = true;
        this.setState('saved');
      }
    } catch (e) {
      console.error('Sync failed', e);
      // On error, allow pushes to prevent the app from being stuck
      this.initialSyncComplete = true;
      this.setState('offline');
    }
    this.syncInProgress = false;
  }

  async resolveConflict(resolution: ConflictResolution, localData: any, remoteData: any) {
    // Unlock remote pushes now that the user has made their choice
    this.initialSyncComplete = true;
    
    if (resolution === 'keep_local') {
        localData.last_updated = Date.now();
        await this.pushLocalChanges(localData);
    } else {
        await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(remoteData));
        await AsyncStorage.setItem('@last_synced_timestamp', (remoteData.last_updated || 0).toString());
        await this.emitDataChange();
        this.setState('saved');
    }
  }
}

export const SyncService = new SyncServiceClass();

