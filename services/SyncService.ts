import { supabase } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from './NotificationService';
import { widgetTaskHandler } from '../widget/WidgetTaskHandler';

export type SyncState = 'offline' | 'syncing' | 'saved' | 'conflict';
export type ConflictResolution = 'keep_local' | 'keep_remote';

class SyncServiceClass {
  private listeners: ((state: SyncState) => void)[] = [];
  private conflictListeners: ((localData: any, remoteData: any) => void)[] = [];
  private dataChangeListeners: (() => void)[] = [];
  private currentState: SyncState = 'offline';
  private isPremiumUser: boolean = false;

  public getIsPremium() {
    return this.isPremiumUser;
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
    
    // Fire and forget remote sync so UI doesn't block
    this._syncRemote(newData).catch(console.error);
  }

  private async _syncRemote(newData: any) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    this.setState('syncing');
    try {
      await supabase.from('user_ledgers').upsert({ id: user.id, ledger_data: newData });
      await AsyncStorage.setItem('@last_synced_timestamp', newData.last_updated.toString());
      this.setState('saved');
    } catch (e) {
      console.error('Failed to push local changes', e);
      this.setState('offline');
    }
  }

  async sync() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    this.setState('syncing');

    try {
      const { data: profileData } = await supabase.from('profiles').select('is_premium').eq('id', user.id).single();
      if (profileData) {
          this.isPremiumUser = profileData.is_premium;
      }

      const { data: dbData } = await supabase.from('user_ledgers').select('ledger_data').eq('id', user.id).single();
      const remoteData = dbData?.ledger_data;
      
      const localDataStr = await AsyncStorage.getItem('grade_ledger_v2_data');
      const localData = localDataStr ? JSON.parse(localDataStr) : null;
      
      const lastSyncedStr = await AsyncStorage.getItem('@last_synced_timestamp');
      const lastSynced = lastSyncedStr ? parseInt(lastSyncedStr, 10) : 0;

      if (!remoteData) {
        if (localData) {
          await this.pushLocalChanges(localData);
        } else {
          this.setState('saved');
        }
        return;
      }

      const remoteUpdated = remoteData.last_updated || 0;
      const localUpdated = localData?.last_updated || 0;

      if (remoteUpdated > lastSynced && localUpdated > lastSynced && remoteUpdated !== localUpdated) {
        this.emitConflict(localData, remoteData);
        return;
      } else if (remoteUpdated > lastSynced && remoteUpdated > localUpdated) {
        await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(remoteData));
        await AsyncStorage.setItem('@last_synced_timestamp', remoteUpdated.toString());
        await this.emitDataChange();
        this.setState('saved');
      } else if (localUpdated > lastSynced) {
        await this.pushLocalChanges(localData);
      } else {
        this.setState('saved');
      }
    } catch (e) {
      console.error('Sync failed', e);
      this.setState('offline');
    }
  }

  async resolveConflict(resolution: ConflictResolution, localData: any, remoteData: any) {
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
