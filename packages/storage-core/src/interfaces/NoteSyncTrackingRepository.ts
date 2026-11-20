/**
 * NoteSyncTrackingRepository
 *
 * Sync bookkeeping for notes and tags: dirty tracking (needs_sync, push
 * cursors), remote tag upserts, and sync-cycle history. This is a separate
 * port from ExtendedNoteRepository because it's only meaningful to the
 * desktop SyncService, not to the rest of the app.
 */

import type { Note, NoteId } from '@dripnex/core';

export interface SyncHistoryEntry {
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
}

export interface SyncHistoryMetrics {
  notesPulled: number;
  notesPushed: number;
  notebooksPulled: number;
  notebooksPushed: number;
  tagsPulled: number;
  tagsPushed: number;
  conflicts: number;
  bytesSent: number;
  bytesReceived: number;
  errorMessage?: string;
}

export interface PendingNoteChange {
  note: Note;
  /** Local edit counter. Not the server sync-log version. */
  localVersion: number;
  /** Last sync-log version applied for this note. Zero means none recorded. */
  syncVersion: number;
  lastSyncedAt: string | null;
}

export interface PendingTagChange {
  tag: { id: number; uuid: string; name: string; color: string | null };
  localVersion: number;
  /** Last sync-log version applied for this tag. Zero means none recorded. */
  syncVersion: number;
}

export interface NoteSyncTrackingRepository {
  getPendingChanges(limit?: number): PendingNoteChange[];
  markAsSynced(noteId: NoteId, serverVersion?: number): void;
  markMultipleAsSynced(noteIds: NoteId[], serverVersions?: Record<string, number>): void;
  hasPendingEdits(noteId: NoteId): boolean;
  resetSyncTracking(noteId: NoteId): void;

  getTagsPendingSync(limit: number): PendingTagChange[];
  markMultipleTagsAsSynced(tagUuids: string[], serverVersions?: Record<string, number>): void;
  upsertTagFromRemote(
    uuid: string,
    name: string,
    color: string | null,
    serverVersion?: number
  ): number;
  deleteTagByUuid(uuid: string): void;

  createSyncHistoryEntry(id: string): void;
  completeSyncHistoryEntry(
    id: string,
    status: 'success' | 'partial' | 'error',
    metrics: SyncHistoryMetrics
  ): void;
  getSyncHistory(limit?: number): SyncHistoryEntry[];
}
