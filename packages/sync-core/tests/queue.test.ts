/**
 * SyncQueue Unit Tests
 *
 * Tests the offline sync queue with mock storage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncQueue, createSyncChangeId, type SyncQueueStorage } from '../src/queue';
import type { SyncChange } from '../src/types';

// ============================================================================
// Mock Factory
// ============================================================================

function createMockStorage(): SyncQueueStorage & {
  _pending: SyncChange[];
} {
  const pending: SyncChange[] = [];

  return {
    _pending: pending,

    enqueue: vi.fn(async (change) => {
      const full: SyncChange = { ...change, id: createSyncChangeId() };
      pending.push(full);
      return full;
    }),

    getPending: vi.fn(async () => pending.filter((c) => !c.synced)),

    markSynced: vi.fn(async (ids: string[]) => {
      for (const change of pending) {
        if (ids.includes(change.id)) {
          change.synced = true;
        }
      }
    }),

    markFailed: vi.fn(async (id: string, error: string) => {
      const change = pending.find((c) => c.id === id);
      if (change) {
        change.retryCount++;
        change.lastError = error;
      }
    }),

    cleanup: vi.fn(async (before: Date) => {
      const initialLen = pending.length;
      const toRemove = pending.filter(
        (c) => c.synced && new Date(c.timestamp) < before
      );
      for (const r of toRemove) {
        const idx = pending.indexOf(r);
        if (idx >= 0) pending.splice(idx, 1);
      }
      return initialLen - pending.length;
    }),

    clear: vi.fn(async () => {
      pending.length = 0;
    }),

    getPendingCount: vi.fn(async () => pending.filter((c) => !c.synced).length),
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

  describe('queueChange', () => {
    it('enqueues a note change', async () => {
      await queue.queueChange('note', 'note_1', 'update', { content: '# Hello' });

      expect(storage.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'note',
          entityId: 'note_1',
          operation: 'update',
          data: { content: '# Hello' },
          synced: false,
          retryCount: 0,
          lastError: null,
        })
      );
    });

    it('enqueues a notebook change', async () => {
      await queue.queueChange('notebook', 'nb_1', 'create', { name: 'Work' });

      expect(storage.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'notebook',
          entityId: 'nb_1',
          operation: 'create',
        })
      );
    });

    it('enqueues a tag change', async () => {
      await queue.queueChange('tag', 'tag_1', 'delete', null);

      expect(storage.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'tag',
          entityId: 'tag_1',
          operation: 'delete',
          data: null,
        })
      );
    });

    it('sets timestamp on enqueue', async () => {
      const before = new Date().toISOString();
      await queue.queueChange('note', 'note_1', 'update', {});
      const after = new Date().toISOString();

      const call = vi.mocked(storage.enqueue).mock.calls[0][0];
      expect(call.timestamp >= before).toBe(true);
      expect(call.timestamp <= after).toBe(true);
    });
  });

  describe('getPendingChanges', () => {
    it('returns pending changes', async () => {
      await queue.queueChange('note', 'note_1', 'update', {});
      await queue.queueChange('note', 'note_2', 'create', {});

      const pending = await queue.getPendingChanges();
      expect(pending).toHaveLength(2);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await queue.queueChange('note', `note_${i}`, 'update', {});
      }

      const pending = await queue.getPendingChanges(3);
      expect(pending).toHaveLength(3);
    });

    it('uses default limit of 50', async () => {
      await queue.getPendingChanges();
      expect(storage.getPending).toHaveBeenCalled();
    });
  });

  describe('markSynced', () => {
    it('marks changes as synced', async () => {
      await queue.queueChange('note', 'note_1', 'update', {});
      const pending = await queue.getPendingChanges();
      const ids = pending.map((c) => c.id);

      await queue.markSynced(ids);

      expect(storage.markSynced).toHaveBeenCalledWith(ids);
    });

    it('does nothing for empty array', async () => {
      await queue.markSynced([]);
      expect(storage.markSynced).not.toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('records error on change', async () => {
      await queue.queueChange('note', 'note_1', 'update', {});
      const pending = await queue.getPendingChanges();
      const id = pending[0].id;

      await queue.markFailed(id, 'Network timeout');

      expect(storage.markFailed).toHaveBeenCalledWith(id, 'Network timeout');
    });
  });

  describe('getPendingCount', () => {
    it('returns count of unsynced changes', async () => {
      await queue.queueChange('note', 'note_1', 'update', {});
      await queue.queueChange('note', 'note_2', 'update', {});

      const count = await queue.getPendingCount();
      expect(count).toBe(2);
    });
  });

  describe('clear', () => {
    it('removes all pending changes', async () => {
      await queue.queueChange('note', 'note_1', 'update', {});
      await queue.queueChange('note', 'note_2', 'update', {});

      await queue.clear();

      expect(storage.clear).toHaveBeenCalled();
      const count = await queue.getPendingCount();
      expect(count).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('removes synced changes older than N days', async () => {
      await queue.queueChange('note', 'note_1', 'update', {});
      const pending = await queue.getPendingChanges();
      await queue.markSynced(pending.map((c) => c.id));

      await queue.cleanup(7);

      expect(storage.cleanup).toHaveBeenCalledWith(expect.any(Date));
    });

    it('defaults to 7 days', async () => {
      await queue.cleanup();

      const callDate = vi.mocked(storage.cleanup).mock.calls[0][0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Should be approximately 7 days ago (within 1 second tolerance)
      expect(Math.abs(callDate.getTime() - sevenDaysAgo.getTime())).toBeLessThan(1000);
    });
  });
});

describe('createSyncChangeId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createSyncChangeId()));
    expect(ids.size).toBe(100);
  });

  it('starts with sc_ prefix', () => {
    const id = createSyncChangeId();
    expect(id).toMatch(/^sc_/);
  });
});
