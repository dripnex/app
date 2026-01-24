/**
 * Sync Queue
 *
 * Manages offline changes queue for eventual sync.
 * Pure interface - storage implementation provided by platform.
 */

import type { SyncChange, EntityType, SyncOperation } from './types.js';

/**
 * Interface for sync queue storage.
 * Platform-specific implementations (SQLite, IndexedDB, etc.)
 */
export interface SyncQueueStorage {
  /** Add a change to the queue */
  enqueue(change: Omit<SyncChange, 'id'>): Promise<SyncChange>;

  /** Get all pending (unsynced) changes */
  getPending(): Promise<SyncChange[]>;

  /** Mark changes as synced */
  markSynced(ids: string[]): Promise<void>;

  /** Update retry count and error for a change */
  markFailed(id: string, error: string): Promise<void>;

  /** Remove synced changes older than given date */
  cleanup(before: Date): Promise<number>;

  /** Clear all pending changes (for logout) */
  clear(): Promise<void>;

  /** Get count of pending changes */
  getPendingCount(): Promise<number>;
}

/**
 * Sync queue manager.
 * Handles queuing changes and preparing batches for sync.
 */
export class SyncQueue {
  constructor(private storage: SyncQueueStorage) {}

  /**
   * Queue a change for sync.
   * Deduplicates: if entity already queued, updates existing entry.
   */
  async queueChange(
    entityType: EntityType,
    entityId: string,
    operation: SyncOperation,
    data: unknown
  ): Promise<void> {
    await this.storage.enqueue({
      entityType,
      entityId,
      operation,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0,
      lastError: null,
    });
  }

  /**
   * Get pending changes for sync.
   * Returns oldest first, limited to batch size.
   */
  async getPendingChanges(limit: number = 50): Promise<SyncChange[]> {
    const pending = await this.storage.getPending();
    return pending.slice(0, limit);
  }

  /**
   * Mark changes as successfully synced.
   */
  async markSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.storage.markSynced(ids);
  }

  /**
   * Mark a change as failed (increment retry, store error).
   */
  async markFailed(id: string, error: string): Promise<void> {
    await this.storage.markFailed(id, error);
  }

  /**
   * Get count of pending changes.
   */
  async getPendingCount(): Promise<number> {
    return this.storage.getPendingCount();
  }

  /**
   * Clear all pending changes (for logout).
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Cleanup old synced changes.
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const before = new Date();
    before.setDate(before.getDate() - olderThanDays);
    return this.storage.cleanup(before);
  }
}

/**
 * Create unique ID for sync change.
 */
export function createSyncChangeId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
