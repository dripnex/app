/**
 * Sync Service
 *
 * Orchestrates bidirectional sync between local database and server.
 * Handles conflict detection, resolution, and auto-sync.
 *
 * @module SyncService
 */

import type { ApiClient, SyncChange, NotebookSyncChange } from './apiClient.js';
import type { EncryptionService } from './encryptionService.js';
import type { SQLiteNoteRepository, SQLiteNotebookRepository } from '@readied/storage-sqlite';
import { createNoteId, createNotebookId, createTimestamp, type NoteStatus } from '@readied/core';

// ============================================================================
// Types
// ============================================================================

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

interface SyncState {
  cursor: number;
  notebookCursor: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

// ============================================================================
// SyncService Class
// ============================================================================

export class SyncService {
  private apiClient: ApiClient;
  private encryptionService: EncryptionService;
  private noteRepository: SQLiteNoteRepository;
  private notebookRepository: SQLiteNotebookRepository | null;
  private state: SyncState;
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private autoSyncInterval: number = 5 * 60 * 1000; // 5 minutes

  constructor(
    apiClient: ApiClient,
    encryptionService: EncryptionService,
    noteRepository: SQLiteNoteRepository,
    notebookRepository?: SQLiteNotebookRepository,
    initialCursor = 0
  ) {
    this.apiClient = apiClient;
    this.encryptionService = encryptionService;
    this.noteRepository = noteRepository;
    this.notebookRepository = notebookRepository ?? null;
    this.state = {
      cursor: initialCursor,
      notebookCursor: 0,
      lastSyncAt: null,
      isSyncing: false,
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Pull changes from server and apply to local database
   */
  async pull(): Promise<{
    success: boolean;
    changes: SyncChange[];
    conflicts: SyncConflict[];
    cursor: number;
    hasMore: boolean;
    error?: string;
  }> {
    try {
      // Pull changes from server
      const result = await this.apiClient.pullChanges(this.state.cursor, 50);

      const conflicts: SyncConflict[] = [];
      let appliedCount = 0;
      let lastAppliedCursor = this.state.cursor;

      // Apply each change to local database
      for (const change of result.changes) {
        try {
          await this.applyRemoteChange(change, conflicts);
          appliedCount++;
          // Only advance cursor past successfully applied changes
          lastAppliedCursor = change.version ?? lastAppliedCursor;
        } catch (error) {
          console.error(`Failed to apply change ${change.id}:`, error);
          // Stop processing — don't skip over failed changes
          break;
        }
      }

      // Only advance cursor to the last successfully applied change
      // If all succeeded, use server cursor; otherwise use last successful version
      this.state.cursor =
        appliedCount === result.changes.length ? result.cursor : lastAppliedCursor;
      this.state.lastSyncAt = Date.now();

      return {
        success: true,
        changes: result.changes,
        conflicts,
        cursor: result.cursor,
        hasMore: result.hasMore,
      };
    } catch (error) {
      return {
        success: false,
        changes: [],
        conflicts: [],
        cursor: this.state.cursor,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Failed to pull changes',
      };
    }
  }

  /**
   * Push local changes to server
   */
  async push(
    changes: Array<{
      noteId: string;
      operation: 'create' | 'update' | 'delete';
      content?: string;
      localVersion?: number;
    }>
  ): Promise<{
    success: boolean;
    results: Array<{
      noteId: string;
      status: 'applied' | 'conflict';
      serverVersion?: number;
    }>;
    error?: string;
  }> {
    try {
      // Encrypt content for each change
      const encryptedChanges = await Promise.all(
        changes.map(async change => ({
          noteId: change.noteId,
          operation: change.operation,
          encryptedData:
            change.content && change.operation !== 'delete'
              ? await this.encryptionService.encrypt(change.content)
              : null,
          localVersion: change.localVersion,
        }))
      );

      // Push to server
      const result = await this.apiClient.pushChanges(encryptedChanges);

      // Update cursor
      this.state.cursor = result.cursor;

      return {
        success: true,
        results: result.results,
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : 'Failed to push changes',
      };
    }
  }

  /**
   * Perform full sync cycle (pull + push)
   */
  async syncNow(): Promise<SyncResult> {
    if (this.state.isSyncing) {
      return {
        success: false,
        changesApplied: 0,
        changesPushed: 0,
        conflicts: [],
        error: 'Sync already in progress',
      };
    }

    this.state.isSyncing = true;

    try {
      // Step 1: Pull changes from server
      const pullResult = await this.pull();

      if (!pullResult.success) {
        return {
          success: false,
          changesApplied: 0,
          changesPushed: 0,
          conflicts: [],
          error: pullResult.error,
        };
      }

      // Step 2: Pull notebook changes (before notes for referential integrity)
      if (this.notebookRepository) {
        await this.pullNotebooks();
      }

      // Step 3: Push local note changes
      let changesPushed = 0;
      const pendingChanges = this.noteRepository.getPendingChanges(50);

      if (pendingChanges.length > 0) {
        const changesToPush = pendingChanges.map(({ note, localVersion }) => ({
          noteId: note.id,
          operation: (note.isDeleted ? 'delete' : 'update') as 'create' | 'update' | 'delete',
          content: !note.isDeleted ? note.content : undefined,
          localVersion,
        }));

        const pushResult = await this.push(changesToPush);

        if (pushResult.success) {
          const successfulNoteIds = pushResult.results
            .filter(r => r.status === 'applied')
            .map(r => createNoteId(r.noteId));

          this.noteRepository.markMultipleAsSynced(successfulNoteIds);
          changesPushed = successfulNoteIds.length;

          const pushConflicts = pushResult.results.filter(r => r.status === 'conflict');
          if (pushConflicts.length > 0) {
            console.warn(
              `Push conflicts detected for ${pushConflicts.length} notes:`,
              pushConflicts
            );
          }
        } else {
          console.error('Failed to push changes:', pushResult.error);
        }
      }

      // Step 4: Push local notebook changes
      if (this.notebookRepository) {
        await this.pushNotebooks();
      }

      return {
        success: true,
        changesApplied: pullResult.changes.length,
        changesPushed,
        conflicts: pullResult.conflicts,
      };
    } catch (error) {
      return {
        success: false,
        changesApplied: 0,
        changesPushed: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    } finally {
      this.state.isSyncing = false;
    }
  }

  /**
   * Resolve a conflict by choosing local or remote version
   */
  async resolveConflict(noteId: string, resolution: 'local' | 'remote'): Promise<void> {
    const note = await this.noteRepository.get(createNoteId(noteId));
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    if (resolution === 'local') {
      // Keep local version, mark for push to server
      this.noteRepository.resetSyncTracking(createNoteId(noteId));
      console.log(`Conflict resolved: keeping local version for ${noteId}, marked for sync`);
    } else {
      // Keep remote version (already applied during pull)
      // Just mark as synced to clear the conflict state
      this.noteRepository.markAsSynced(createNoteId(noteId));
      console.log(`Conflict resolved: keeping remote version for ${noteId}`);
    }
  }

  /**
   * Start auto-sync timer
   */
  startAutoSync(intervalMs?: number): void {
    if (intervalMs) {
      this.autoSyncInterval = intervalMs;
    }

    // Clear existing timer
    this.stopAutoSync();

    // Start new timer
    this.autoSyncTimer = setInterval(() => {
      this.syncNow().catch(error => {
        console.error('Auto-sync failed:', error);
      });
    }, this.autoSyncInterval);

    console.log(`Auto-sync started (interval: ${this.autoSyncInterval}ms)`);
  }

  /**
   * Stop auto-sync timer
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Pull notebook changes from server and apply locally
   */
  private async pullNotebooks(): Promise<void> {
    if (!this.notebookRepository) return;

    try {
      const result = await this.apiClient.pullNotebookChanges(this.state.notebookCursor, 50);

      for (const change of result.changes) {
        await this.applyRemoteNotebookChange(change);
      }

      this.state.notebookCursor = result.cursor;
    } catch (error) {
      console.error('Failed to pull notebook changes:', error);
    }
  }

  /**
   * Push local notebook changes to server
   */
  private async pushNotebooks(): Promise<void> {
    if (!this.notebookRepository) return;

    const pendingNotebooks = this.notebookRepository.getPendingChanges(50);
    if (pendingNotebooks.length === 0) return;

    try {
      const encryptedChanges = await Promise.all(
        pendingNotebooks.map(async ({ notebook, localVersion }) => {
          const data = JSON.stringify({
            name: notebook.name,
            parentId: notebook.parentId,
            depth: notebook.depth,
            order: notebook.order,
          });
          return {
            notebookId: notebook.id,
            operation: 'update' as const,
            encryptedData: await this.encryptionService.encrypt(data),
            localVersion,
          };
        })
      );

      const result = await this.apiClient.pushNotebookChanges(encryptedChanges);

      const successfulIds = result.results
        .filter(r => r.status === 'applied')
        .map(r => createNotebookId(r.notebookId));

      if (successfulIds.length > 0) {
        this.notebookRepository.markMultipleAsSynced(successfulIds);
      }
    } catch (error) {
      console.error('Failed to push notebook changes:', error);
    }
  }

  /**
   * Apply a remote notebook change to local database
   */
  private async applyRemoteNotebookChange(change: NotebookSyncChange): Promise<void> {
    if (!this.notebookRepository) return;

    const notebookId = createNotebookId(change.notebookId);

    if (change.operation === 'delete') {
      const existing = await this.notebookRepository.get(notebookId);
      if (existing) {
        await this.notebookRepository.delete(notebookId);
      }
      return;
    }

    // Decrypt notebook data
    if (!change.encryptedData) return;

    const decrypted = await this.encryptionService.decrypt(change.encryptedData);
    const data = JSON.parse(decrypted) as {
      name: string;
      parentId: string | null;
      depth: number;
      order: number;
    };

    const existing = await this.notebookRepository.get(notebookId);

    if (existing) {
      // Update existing notebook
      await this.notebookRepository.save({
        ...existing,
        name: data.name,
        parentId: data.parentId ? createNotebookId(data.parentId) : null,
        depth: data.depth,
        order: data.order,
        updatedAt: createTimestamp(new Date(change.createdAt)),
      });
    } else {
      // Create new notebook
      const { createNotebook } = await import('@readied/core');
      await this.notebookRepository.save(
        createNotebook({
          id: notebookId,
          name: data.name,
          parentId: data.parentId ? createNotebookId(data.parentId) : null,
          parentDepth: data.depth > 0 ? data.depth - 1 : undefined,
          order: data.order,
        })
      );
    }

    // Mark as synced to avoid re-pushing
    this.notebookRepository.markAsSynced(notebookId);
  }

  /**
   * Apply a remote change to local database
   */
  private async applyRemoteChange(change: SyncChange, conflicts: SyncConflict[]): Promise<void> {
    const noteId = createNoteId(change.noteId);

    // Decrypt content if present
    const decryptedContent = change.encryptedData
      ? await this.encryptionService.decrypt(change.encryptedData)
      : null;

    switch (change.operation) {
      case 'create':
      case 'update': {
        if (!decryptedContent) {
          throw new Error(`No content for ${change.operation} operation`);
        }

        // Check for existing note
        const existingNote = await this.noteRepository.get(noteId);

        if (existingNote) {
          // Conflict detection:
          // A conflict only occurs when the local note has unsynced edits (needs_sync=1)
          // AND the remote change is from a different device.
          // If the local note is clean (no pending edits), the remote change can be
          // applied safely without conflict.
          const hasLocalEdits = this.noteRepository.hasPendingEdits(noteId);
          const isConflict =
            hasLocalEdits && change.deviceId !== this.apiClient['deviceInfo'].deviceId;

          if (isConflict) {
            // Store conflict for user resolution
            conflicts.push({
              noteId: change.noteId,
              localContent: existingNote.content,
              remoteContent: decryptedContent,
              localVersion: change.version - 1, // Estimate
              remoteVersion: change.version,
              timestamp: new Date().toISOString(),
            });

            // Create a conflict copy
            const conflictTitle = `${existingNote.title} (Conflict ${new Date().toLocaleString()})`;
            await this.noteRepository.save({
              ...existingNote,
              id: createNoteId(`${change.noteId}-conflict-${Date.now()}`),
              title: conflictTitle,
              metadata: {
                ...existingNote.metadata,
                updatedAt: createTimestamp(new Date()),
              },
            });
          }

          // Apply remote change (overwrite local)
          const remoteTitle = this.extractTitle(decryptedContent);
          await this.noteRepository.save({
            ...existingNote,
            content: decryptedContent,
            title: remoteTitle,
            metadata: {
              ...existingNote.metadata,
              title: remoteTitle,
              updatedAt: createTimestamp(new Date(change.createdAt)),
            },
          });

          // Mark as synced to avoid re-pushing
          this.noteRepository.markAsSynced(noteId);
        } else {
          // Create new note
          const newTitle = this.extractTitle(decryptedContent);
          await this.noteRepository.save({
            id: noteId,
            notebookId: createNotebookId('inbox'), // Default to inbox
            content: decryptedContent,
            title: newTitle,
            isPinned: false,
            isDeleted: false,
            status: 'active' as NoteStatus,
            metadata: {
              title: newTitle,
              createdAt: createTimestamp(new Date(change.createdAt)),
              updatedAt: createTimestamp(new Date(change.createdAt)),
              tags: [],
              wordCount: decryptedContent.split(/\s+/).length,
              archivedAt: null,
            },
          });

          // Mark as synced to avoid re-pushing
          this.noteRepository.markAsSynced(noteId);
        }
        break;
      }

      case 'delete': {
        const existingNote = await this.noteRepository.get(noteId);
        if (existingNote) {
          await this.noteRepository.delete(noteId);
        }
        break;
      }

      default:
        console.warn(`Unknown operation: ${change.operation}`);
    }
  }

  /**
   * Extract title from note content (first line)
   */
  private extractTitle(content: string): string {
    const firstLine = content.split('\n')[0]?.trim() || '';
    // Remove markdown heading syntax
    return firstLine.replace(/^#+\s*/, '') || 'Untitled';
  }
}
