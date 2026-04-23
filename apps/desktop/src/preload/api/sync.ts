import { ipcRenderer } from 'electron';
import type { PushResult, SyncChange } from './types';

export interface SyncAPI {
  pull: () => Promise<{
    success: boolean;
    changes?: SyncChange[];
    cursor?: number;
    hasMore?: boolean;
    conflicts?: Array<{
      noteId: string;
      localContent: string;
      remoteContent: string;
      localVersion: number;
      remoteVersion: number;
      timestamp: string;
    }>;
    error?: string;
  }>;
  push: (
    changes: Array<{
      noteId: string;
      operation: 'create' | 'update' | 'delete';
      content?: string;
      localVersion?: number;
    }>
  ) => Promise<{
    success: boolean;
    results?: PushResult[];
    error?: string;
  }>;
  syncNow: () => Promise<{
    success: boolean;
    changesApplied: number;
    changesPushed: number;
    conflicts: Array<{
      noteId: string;
      localContent: string;
      remoteContent: string;
      localVersion: number;
      remoteVersion: number;
      timestamp: string;
    }>;
    error?: string;
  }>;
  status: () => Promise<{
    success: boolean;
    cursor?: number;
    lastSyncAt?: number | null;
    isSyncing?: boolean;
    lastError?: string | null;
    consecutiveFailures?: number;
    error?: string;
  }>;
  onStatusChange: (callback: (event: unknown) => void) => () => void;
  resolveConflict: (
    noteId: string,
    resolution: 'local' | 'remote'
  ) => Promise<{ success: boolean; error?: string }>;
  startAutoSync: (intervalMs?: number) => Promise<{ success: boolean; error?: string }>;
  stopAutoSync: () => Promise<{ success: boolean; error?: string }>;
  triggerSync: () => Promise<void>;
  pullTags: () => Promise<{ success: boolean; applied: number; error?: string }>;
  pushTags: () => Promise<{ success: boolean; pushed: number; error?: string }>;
  pendingCount: () => Promise<{ success: boolean; count: number; error?: string }>;
  history: (limit?: number) => Promise<{
    success: boolean;
    history: Array<{
      id: string;
      startedAt: string;
      completedAt: string | null;
      status: 'running' | 'success' | 'partial' | 'error';
      notesPulled: number;
      notesPushed: number;
      notebooksPulled: number;
      notebooksPushed: number;
      tagsPulled: number;
      tagsPushed: number;
      conflicts: number;
      bytesSent: number;
      bytesReceived: number;
      errorMessage: string | null;
    }>;
    error?: string;
  }>;
}

export interface EncryptionAPI {
  exportKey: () => Promise<{ success: boolean; key?: string; error?: string }>;
  importKey: (keyHex: string) => Promise<{ success: boolean; error?: string }>;
  isReady: () => Promise<{ ready: boolean }>;
  getKeyStatus: () => Promise<{
    success: boolean;
    hasServerKeys?: boolean;
    hasLocalKey?: boolean;
    hasLegacyKey?: boolean;
    error?: string;
  }>;
  setupKeys: (passphrase: string) => Promise<{
    success: boolean;
    recoveryKey?: string | null;
    error?: string;
  }>;
  unlockWithPassphrase: (passphrase: string) => Promise<{
    success: boolean;
    wrongPassphrase?: boolean;
    error?: string;
  }>;
  unlockWithRecoveryKey: (recoveryKey: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  migrateLegacyKey: (passphrase: string) => Promise<{
    success: boolean;
    recoveryKey?: string | null;
    error?: string;
  }>;
  changePassphrase: (newPassphrase: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

export function createSyncApi(): SyncAPI {
  return {
    pull: () => ipcRenderer.invoke('sync:pull'),
    push: changes => ipcRenderer.invoke('sync:push', changes),
    syncNow: () => ipcRenderer.invoke('sync:syncNow'),
    status: () => ipcRenderer.invoke('sync:status'),
    resolveConflict: (noteId, resolution) =>
      ipcRenderer.invoke('sync:resolveConflict', noteId, resolution),
    startAutoSync: intervalMs => ipcRenderer.invoke('sync:startAutoSync', intervalMs),
    stopAutoSync: () => ipcRenderer.invoke('sync:stopAutoSync'),
    triggerSync: () => ipcRenderer.invoke('sync:trigger'),
    pullTags: () => ipcRenderer.invoke('sync:pullTags'),
    pushTags: () => ipcRenderer.invoke('sync:pushTags'),
    pendingCount: () => ipcRenderer.invoke('sync:pendingCount'),
    history: (limit?: number) => ipcRenderer.invoke('sync:history', limit),
    onStatusChange: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
        callback(data);
      };
      ipcRenderer.on('sync:status-changed', handler);
      return () => {
        ipcRenderer.removeListener('sync:status-changed', handler);
      };
    },
  };
}

export function createEncryptionApi(): EncryptionAPI {
  return {
    exportKey: () => ipcRenderer.invoke('encryption:exportKey'),
    importKey: (keyHex: string) => ipcRenderer.invoke('encryption:importKey', keyHex),
    isReady: () => ipcRenderer.invoke('encryption:isReady'),
    getKeyStatus: () => ipcRenderer.invoke('encryption:getKeyStatus'),
    setupKeys: (passphrase: string) => ipcRenderer.invoke('encryption:setupKeys', passphrase),
    unlockWithPassphrase: (passphrase: string) =>
      ipcRenderer.invoke('encryption:unlockWithPassphrase', passphrase),
    unlockWithRecoveryKey: (recoveryKey: string) =>
      ipcRenderer.invoke('encryption:unlockWithRecoveryKey', recoveryKey),
    migrateLegacyKey: (passphrase: string) =>
      ipcRenderer.invoke('encryption:migrateLegacyKey', passphrase),
    changePassphrase: (newPassphrase: string) =>
      ipcRenderer.invoke('encryption:changePassphrase', newPassphrase),
  };
}
