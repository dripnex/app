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
}

export interface SyncResult {
  success: boolean;
  changesApplied: number;
  changesPushed: number;
  conflicts: SyncConflict[];
  error?: string;
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
  | { type: 'sync-success'; changesApplied: number; changesPushed: number }
  | { type: 'sync-error'; error: string; isNetworkError: boolean; consecutiveFailures: number }
  | { type: 'needs-setup'; error: string }
  | { type: 'auth-expired' };

export type SyncStatusListener = (event: SyncStatusEvent) => void;
