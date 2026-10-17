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
  localVersion: number;
}

export interface NotebookSyncTrackingRepository {
  getPendingChanges(limit?: number): PendingNotebookChange[];
  markAsSynced(notebookId: NotebookId): void;
  markMultipleAsSynced(notebookIds: NotebookId[]): void;
  hasPendingEdits(notebookId: NotebookId): boolean;
  resetSyncTracking(notebookId: NotebookId): void;
  validateForSync(notebookId: NotebookId): { valid: boolean; error?: string };
}
