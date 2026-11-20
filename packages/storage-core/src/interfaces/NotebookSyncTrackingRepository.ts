/**
 * NotebookSyncTrackingRepository
 *
 * Sync bookkeeping for notebooks: dirty tracking (needs_sync, push cursors)
 * and pre-push tree validation. Separate port from core's NotebookRepository
 * because it's only meaningful to the desktop SyncService.
 */

import type { Notebook, NotebookId } from '@dripnex/core';

export interface PendingNotebookChange {
  notebook: Notebook;
  /** Local edit counter. Not the server sync-log version. */
  localVersion: number;
  /** Last sync-log version applied for this notebook. Zero means none recorded. */
  syncVersion: number;
}

export interface NotebookSyncTrackingRepository {
  getPendingChanges(limit?: number): PendingNotebookChange[];
  markAsSynced(notebookId: NotebookId, serverVersion?: number): void;
  markMultipleAsSynced(notebookIds: NotebookId[], serverVersions?: Record<string, number>): void;
  hasPendingEdits(notebookId: NotebookId): boolean;
  resetSyncTracking(notebookId: NotebookId): void;
  validateForSync(notebookId: NotebookId): { valid: boolean; error?: string };
}
