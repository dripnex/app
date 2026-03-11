/**
 * SyncQueue Tests
 *
 * Tests for the SyncQueue class using an in-memory mock storage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncQueue, type SyncQueueStorage } from '../src/queue.js';
import type { SyncChange } from '../src/types.js';

// ============================================================================
// In-memory mock implementation of SyncQueueStorage
// ============================================================================

function createMockStorage(): SyncQueueStorage & { changes: SyncChange[] } {
  const changes: SyncChange[] = [];
  let nextId = 1;

  return {
    changes,

    async enqueue(change: Omit<SyncChange, 'id'>): Promise<SyncChange> {
      const full: SyncChange = { ...change, id: `sc_${nextId++}` };
      changes.push(full);
      return full;
    },

    async getPending(): Promise<SyncChange[]> {
      return changes.filter((c) => !c.synced);
    },

    async markSynced(ids: string[]): Promise<void> {
      for (const c of changes) {
        if (ids.includes(c.id)) {
          c.synced = true;
        }
      }
    },

    async markFailed(id: string, error: string): Promise<void> {
      const change = changes.find((c) => c.id === id);
      if (change) {
        change.retryCount += 1;
        change.lastError = error;
      }
    },

    async cleanup(before: Date): Promise<number> {
      const initial = changes.length;
      const remaining = changes.filter(
        (c) => !(c.synced && new Date(c.timestamp) < before)
      );
      changes.length = 0;
      changes.push(...remaining);
      return initial - remaining.length;
    },

    async clear(): Promise<void> {
      changes.length = 0;
    },

    async getPendingCount(): Promise<number> {
      return changes.filter((c) => !c.synced).length;
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SyncQueue', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let queue: SyncQueue;

  beforeEach(() => {
    storage = createMockStorage();
    queue = new SyncQueue(storage);
  });

  // --------------------------------------------------------------------------
  // queueChange
  // --------------------------------------------------------------------------

  describe('queueChange', () => {
    it('enqueues a change with correct fields', async () => {
      await queue.queueChange('note', 'note_1', 'create', { title: 'Hello' });

      expect(storage.changes).toHaveLength(1);
      const change = storage.changes[0];
      expect(change.entityType).toBe('note');
      expect(change.entityId).toBe('note_1');
      expect(change.operation).toBe('create');
      expect(change.data).toEqual({ title: 'Hello' });
      expect(change.synced).toBe(false);
      expect(change.retryCount).toBe(0);
      expect(change.lastError).toBeNull();
    });

    it('sets a valid ISO timestamp', async () => {
      const before = new Date().toISOString();
      await queue.queueChange('notebook', 'nb_1', 'update', {});
      const after = new Date().toISOString();

      const ts = storage.changes[0].timestamp;
      expect(ts >= before).toBe(true);
      expect(ts <= after).toBe(true);
    });

    it('enqueues multiple changes independently', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      await queue.queueChange('note', 'n2', 'update', null);
      await queue.queueChange('notebook', 'nb1', 'delete', null);

      expect(storage.changes).toHaveLength(3);
      expect(storage.changes.map((c) => c.entityId)).toEqual(['n1', 'n2', 'nb1']);
    });
  });

  // --------------------------------------------------------------------------
  // getPendingChanges
  // --------------------------------------------------------------------------

  describe('getPendingChanges', () => {
    it('returns all pending changes when under limit', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      await queue.queueChange('note', 'n2', 'update', null);

      const pending = await queue.getPendingChanges(10);
      expect(pending).toHaveLength(2);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await queue.queueChange('note', `n${i}`, 'create', null);
      }

      const pending = await queue.getPendingChanges(3);
      expect(pending).toHaveLength(3);
    });

    it('uses default limit of 50', async () => {
      // Enqueue 60 changes
      for (let i = 0; i < 60; i++) {
        await queue.queueChange('note', `n${i}`, 'create', null);
      }

      const pending = await queue.getPendingChanges();
      expect(pending).toHaveLength(50);
    });

    it('returns empty array when no pending changes', async () => {
      const pending = await queue.getPendingChanges();
      expect(pending).toEqual([]);
    });

    it('excludes synced changes', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      await queue.queueChange('note', 'n2', 'create', null);
      // Mark first as synced directly in storage
      storage.changes[0].synced = true;

      const pending = await queue.getPendingChanges();
      expect(pending).toHaveLength(1);
      expect(pending[0].entityId).toBe('n2');
    });
  });

  // --------------------------------------------------------------------------
  // markSynced
  // --------------------------------------------------------------------------

  describe('markSynced', () => {
    it('delegates to storage', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      const id = storage.changes[0].id;

      await queue.markSynced([id]);
      expect(storage.changes[0].synced).toBe(true);
    });

    it('marks multiple changes as synced', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      await queue.queueChange('note', 'n2', 'create', null);
      const ids = storage.changes.map((c) => c.id);

      await queue.markSynced(ids);
      expect(storage.changes.every((c) => c.synced)).toBe(true);
    });

    it('is a no-op with empty array', async () => {
      const spy = vi.spyOn(storage, 'markSynced');

      await queue.markSynced([]);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // markFailed
  // --------------------------------------------------------------------------

  describe('markFailed', () => {
    it('delegates to storage with id and error', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      const id = storage.changes[0].id;

      await queue.markFailed(id, 'Network timeout');

      expect(storage.changes[0].retryCount).toBe(1);
      expect(storage.changes[0].lastError).toBe('Network timeout');
    });

    it('increments retryCount on successive failures', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      const id = storage.changes[0].id;

      await queue.markFailed(id, 'Error 1');
      await queue.markFailed(id, 'Error 2');

      expect(storage.changes[0].retryCount).toBe(2);
      expect(storage.changes[0].lastError).toBe('Error 2');
    });
  });

  // --------------------------------------------------------------------------
  // getPendingCount
  // --------------------------------------------------------------------------

  describe('getPendingCount', () => {
    it('returns 0 when queue is empty', async () => {
      expect(await queue.getPendingCount()).toBe(0);
    });

    it('returns correct count of pending changes', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      await queue.queueChange('note', 'n2', 'update', null);

      expect(await queue.getPendingCount()).toBe(2);
    });

    it('does not count synced changes', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      await queue.queueChange('note', 'n2', 'create', null);
      storage.changes[0].synced = true;

      expect(await queue.getPendingCount()).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // clear
  // --------------------------------------------------------------------------

  describe('clear', () => {
    it('delegates to storage and removes all changes', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      await queue.queueChange('note', 'n2', 'update', null);

      await queue.clear();

      expect(storage.changes).toHaveLength(0);
      expect(await queue.getPendingCount()).toBe(0);
    });

    it('is safe to call on empty queue', async () => {
      await queue.clear();
      expect(storage.changes).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // cleanup
  // --------------------------------------------------------------------------

  describe('cleanup', () => {
    it('calculates correct date threshold and delegates to storage', async () => {
      const spy = vi.spyOn(storage, 'cleanup');

      const before = new Date();
      before.setDate(before.getDate() - 7);

      await queue.cleanup(7);

      expect(spy).toHaveBeenCalledOnce();
      const arg = spy.mock.calls[0][0] as Date;
      // The threshold should be approximately 7 days ago (within 1 second)
      expect(Math.abs(arg.getTime() - before.getTime())).toBeLessThan(1000);
    });

    it('uses default of 7 days', async () => {
      const spy = vi.spyOn(storage, 'cleanup');

      const before = new Date();
      before.setDate(before.getDate() - 7);

      await queue.cleanup();

      const arg = spy.mock.calls[0][0] as Date;
      expect(Math.abs(arg.getTime() - before.getTime())).toBeLessThan(1000);
    });

    it('removes old synced changes', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      // Make it synced and old
      storage.changes[0].synced = true;
      storage.changes[0].timestamp = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      // Add a recent pending change
      await queue.queueChange('note', 'n2', 'create', null);

      const removed = await queue.cleanup(7);

      expect(removed).toBe(1);
      expect(storage.changes).toHaveLength(1);
      expect(storage.changes[0].entityId).toBe('n2');
    });

    it('does not remove pending (unsynced) changes', async () => {
      await queue.queueChange('note', 'n1', 'create', null);
      // Old but not synced
      storage.changes[0].timestamp = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const removed = await queue.cleanup(7);
      expect(removed).toBe(0);
      expect(storage.changes).toHaveLength(1);
    });

    it('accepts custom olderThanDays', async () => {
      const spy = vi.spyOn(storage, 'cleanup');

      const before = new Date();
      before.setDate(before.getDate() - 30);

      await queue.cleanup(30);

      const arg = spy.mock.calls[0][0] as Date;
      expect(Math.abs(arg.getTime() - before.getTime())).toBeLessThan(1000);
    });
  });
});
