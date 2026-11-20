/**
 * Sync types, events, and results.
 */

export interface SyncConflict {
  noteId: string;
  localContent: string;
  remoteContent: string;
  localVersion: number;
  remoteVersion: number;
  timestamp: string;
  /** Disk backup of the local body created before pull overwrote the note. */
  localCopyId?: string;
}

export type SyncFailureKind = 'needs-setup' | 'auth-expired' | 'offline' | 'error';

export interface SyncResult {
  success: boolean;
  changesApplied: number;
  changesPushed: number;
  conflicts: SyncConflict[];
  error?: string;
  /** Set by SyncService. The renderer must not reclassify this from error text. */
  failure?: SyncFailureKind;
}

export interface SyncState {
  cursor: number;
  tagCursor: number;
  notebookCursor: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
  lastError: string | null;
  consecutiveFailures: number;
}

export type SyncStatusEvent =
  | { type: 'sync-start' }
  | {
      type: 'sync-success';
      changesApplied: number;
      changesPushed: number;
      conflicts?: SyncConflict[];
    }
  | { type: 'sync-error'; error: string; isNetworkError: boolean; consecutiveFailures: number }
  | { type: 'needs-setup'; error: string }
  | { type: 'auth-expired' };

export type SyncStatusListener = (event: SyncStatusEvent) => void;
