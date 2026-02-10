/**
 * Sync Engine
 *
 * Orchestrates sync operations between local storage and remote server.
 * Handles offline queue, conflict resolution, and sync state.
 */

import type { SyncStatus, SyncConflict, ConflictStrategy, PushResult, DeviceId } from './types.js';
import type { SyncClient, NotePushPayload } from './client.js';
import type { SyncQueue } from './queue.js';

/**
 * Local storage interface for sync engine.
 * Implementations provide platform-specific storage.
 */
export interface SyncStorage {
  /** Get device ID (or null if not registered) */
  getDeviceId(): Promise<DeviceId | null>;

  /** Store device ID */
  setDeviceId(id: DeviceId): Promise<void>;

  /** Get last sync cursor for entity type */
  getCursor(entityType: 'note' | 'notebook'): Promise<string | null>;

  /** Store sync cursor */
  setCursor(entityType: 'note' | 'notebook', cursor: string): Promise<void>;

  /** Get notes that have local changes since last sync */
  getModifiedNotes(): Promise<NotePushPayload[]>;

  /** Apply remote note changes to local storage */
  applyRemoteNotes(
    notes: Array<{
      id: string;
      title: string;
      content: string;
      notebookId: string | null;
      createdAt: string;
      updatedAt: string;
      archivedAt: string | null;
      isPinned: boolean;
      isDeleted: boolean;
      status: string;
      wordCount: number;
      syncVersion: number;
    }>
  ): Promise<string[]>;

  /** Mark notes as synced (update sync metadata) */
  markNotesSynced(ids: string[], syncVersion: number): Promise<void>;

  /** Get last sync timestamp */
  getLastSyncedAt(): Promise<string | null>;

  /** Set last sync timestamp */
  setLastSyncedAt(timestamp: string): Promise<void>;
}

/**
 * Sync engine configuration.
 */
export interface SyncEngineConfig {
  /** Sync client for API calls */
  client: SyncClient;
  /** Local storage for sync state */
  storage: SyncStorage;
  /** Offline change queue */
  queue: SyncQueue;
  /** Default conflict resolution strategy */
  defaultConflictStrategy?: ConflictStrategy;
  /** Callback for status changes */
  onStatusChange?: (status: SyncStatus) => void;
  /** Callback for conflicts that need manual resolution */
  onConflict?: (conflicts: SyncConflict[]) => void;
}

/**
 * Sync engine - orchestrates sync between local and remote.
 */
export class SyncEngine {
  private status: SyncStatus = { status: 'disabled' };
  private isSyncing = false;

  constructor(private config: SyncEngineConfig) {}

  /**
   * Get current sync status.
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Enable sync (user logged in with Pro subscription).
   */
  async enable(): Promise<void> {
    const lastSyncedAt = await this.config.storage.getLastSyncedAt();
    this.updateStatus({ status: 'idle', lastSyncedAt });
  }

  /**
   * Disable sync (user logged out or downgraded).
   */
  async disable(): Promise<void> {
    this.updateStatus({ status: 'disabled' });
    await this.config.queue.clear();
  }

  /**
   * Run a full sync cycle: push local changes, then pull remote changes.
   */
  async sync(): Promise<void> {
    if (this.isSyncing) return;
    if (this.status.status === 'disabled') return;

    this.isSyncing = true;
    const lastSyncedAt = await this.config.storage.getLastSyncedAt();
    this.updateStatus({ status: 'syncing', progress: 0 });

    try {
      const deviceId = await this.ensureDeviceId();

      // Phase 1: Push local changes (40% of progress)
      this.updateStatus({ status: 'syncing', progress: 10 });
      const pushResult = await this.pushChanges(deviceId);

      if (pushResult.conflicts.length > 0) {
        // Handle conflicts based on strategy
        const unresolved = await this.handleConflicts(pushResult.conflicts);
        if (unresolved.length > 0) {
          this.updateStatus({ status: 'conflict', conflicts: unresolved });
          this.isSyncing = false;
          return;
        }
      }

      this.updateStatus({ status: 'syncing', progress: 40 });

      // Phase 2: Pull remote changes (60% of progress)
      await this.pullChanges(deviceId);

      // Done
      const now = new Date().toISOString();
      await this.config.storage.setLastSyncedAt(now);
      this.updateStatus({ status: 'idle', lastSyncedAt: now });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      this.updateStatus({ status: 'error', message, lastSyncedAt });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Queue a local change for sync.
   */
  async queueChange(
    entityType: 'note' | 'notebook' | 'tag',
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    data: unknown
  ): Promise<void> {
    await this.config.queue.queueChange(entityType, entityId, operation, data);
  }

  /**
   * Resolve a conflict manually.
   */
  async resolveConflict(entityId: string, strategy: 'local' | 'remote'): Promise<void> {
    await this.config.client.resolveNoteConflict(entityId, {
      entityId,
      strategy: strategy === 'local' ? 'local-wins' : 'remote-wins',
    });

    // Re-sync after resolution
    await this.sync();
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private updateStatus(status: SyncStatus): void {
    this.status = status;
    this.config.onStatusChange?.(status);
  }

  private async ensureDeviceId(): Promise<DeviceId> {
    let deviceId = await this.config.storage.getDeviceId();
    if (!deviceId) {
      deviceId = await this.config.client.registerDevice({
        name: 'Readied Desktop',
        platform: process.platform ?? 'unknown',
        version: '0.1.0', // TODO: get from package
      });
      await this.config.storage.setDeviceId(deviceId);
    }
    return deviceId;
  }

  private async pushChanges(deviceId: DeviceId): Promise<PushResult> {
    const modifiedNotes = await this.config.storage.getModifiedNotes();
    if (modifiedNotes.length === 0) {
      return { synced: [], conflicts: [], errors: [] };
    }

    const result = await this.config.client.pushNotes(modifiedNotes, deviceId);

    // Mark synced notes
    if (result.synced.length > 0) {
      await this.config.storage.markNotesSynced(result.synced, Date.now());
    }

    return result;
  }

  private async pullChanges(deviceId: DeviceId): Promise<void> {
    let cursor = await this.config.storage.getCursor('note');
    let hasMore = true;
    let progress = 40;

    while (hasMore) {
      const result = await this.config.client.pullNotes(cursor, deviceId, 100);

      if (result.notes.length > 0) {
        await this.config.storage.applyRemoteNotes(result.notes);
      }

      cursor = result.cursor;
      hasMore = result.hasMore;

      // Update progress
      progress = Math.min(progress + 10, 90);
      this.updateStatus({ status: 'syncing', progress });

      await this.config.storage.setCursor('note', cursor);
    }
  }

  private async handleConflicts(conflicts: SyncConflict[]): Promise<SyncConflict[]> {
    const strategy = this.config.defaultConflictStrategy ?? 'latest-wins';

    if (strategy === 'manual') {
      this.config.onConflict?.(conflicts);
      return conflicts;
    }

    // Auto-resolve based on strategy
    const unresolved: SyncConflict[] = [];

    for (const conflict of conflicts) {
      try {
        const resolution: 'local-wins' | 'remote-wins' =
          strategy === 'local-wins'
            ? 'local-wins'
            : strategy === 'remote-wins'
              ? 'remote-wins'
              : // latest-wins: compare timestamps
                conflict.localUpdatedAt > conflict.remoteUpdatedAt
                ? 'local-wins'
                : 'remote-wins';

        await this.config.client.resolveNoteConflict(conflict.entityId, {
          entityId: conflict.entityId,
          strategy: resolution,
        });
      } catch {
        unresolved.push(conflict);
      }
    }

    return unresolved;
  }
}
