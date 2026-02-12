/**
 * SyncEngine Unit Tests
 *
 * Tests the core sync orchestration logic with mock implementations.
 */

import { describe, it, expect, vi } from 'vitest';
import { SyncEngine, type SyncStorage, type SyncEngineConfig } from '../src/engine';
import type { SyncClient, NotePushPayload, NotebookPushPayload } from '../src/client';
import { SyncQueue, type SyncQueueStorage } from '../src/queue';
import type { DeviceId, SyncableNote, SyncableNotebook, PushResult } from '../src/types';

// ============================================================================
// Mock Factories
// ============================================================================

const DEVICE_ID = 'device_test_123' as DeviceId;

function createMockStorage(): SyncStorage {
  const state = {
    deviceId: DEVICE_ID,
    cursors: new Map<string, string>(),
    lastSyncedAt: null as string | null,
    modifiedNotes: [] as NotePushPayload[],
  };

  return {
    getDeviceId: vi.fn(async () => state.deviceId),
    setDeviceId: vi.fn(async (id: DeviceId) => {
      state.deviceId = id;
    }),
    getCursor: vi.fn(async (entityType: string) => state.cursors.get(entityType) ?? null),
    setCursor: vi.fn(async (entityType: string, cursor: string) => {
      state.cursors.set(entityType, cursor);
    }),
    getModifiedNotes: vi.fn(async () => state.modifiedNotes),
    applyRemoteNotes: vi.fn(async (notes: unknown[]) => notes.map(() => 'applied')),
    markNotesSynced: vi.fn(async () => {}),
    getModifiedNotebooks: vi.fn(async () => []),
    applyRemoteNotebooks: vi.fn(async (notebooks: unknown[]) => notebooks.map(() => 'applied')),
    markNotebooksSynced: vi.fn(async () => {}),
    getLastSyncedAt: vi.fn(async () => state.lastSyncedAt),
    setLastSyncedAt: vi.fn(async (ts: string) => {
      state.lastSyncedAt = ts;
    }),
  };
}

function createMockClient(): SyncClient {
  return {
    requestMagicLink: vi.fn(async () => {}),
    verifyMagicLink: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(async () => {}),
    pushNotes: vi.fn(async (): Promise<PushResult> => ({
      synced: [],
      conflicts: [],
      errors: [],
    })),
    pullNotes: vi.fn(async () => ({
      notes: [] as SyncableNote[],
      cursor: '0',
      hasMore: false,
    })),
    resolveNoteConflict: vi.fn(async () => ({}) as SyncableNote),
    pushNotebooks: vi.fn(async (): Promise<PushResult> => ({
      synced: [],
      conflicts: [],
      errors: [],
    })),
    pullNotebooks: vi.fn(async () => ({
      notebooks: [],
      cursor: '0',
      hasMore: false,
    })),
    registerDevice: vi.fn(async () => DEVICE_ID),
    listDevices: vi.fn(async () => []),
    revokeDevice: vi.fn(async () => {}),
  };
}

function createMockQueueStorage(): SyncQueueStorage {
  return {
    enqueue: vi.fn(async (change) => ({ ...change, id: `sc_${Date.now()}` })),
    getPending: vi.fn(async () => []),
    markSynced: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    cleanup: vi.fn(async () => 0),
    clear: vi.fn(async () => {}),
    getPendingCount: vi.fn(async () => 0),
  };
}

function createEngine(overrides: Partial<SyncEngineConfig> = {}) {
  const storage = createMockStorage();
  const client = createMockClient();
  const queueStorage = createMockQueueStorage();
  const queue = new SyncQueue(queueStorage);

  const config: SyncEngineConfig = {
    client,
    storage,
    queue,
    ...overrides,
  };

  const engine = new SyncEngine(config);
  return { engine, storage, client, queue, queueStorage, config };
}

// ============================================================================
// Tests
// ============================================================================

describe('SyncEngine', () => {
  describe('getStatus', () => {
    it('starts with disabled status', () => {
      const { engine } = createEngine();
      expect(engine.getStatus()).toEqual({ status: 'disabled' });
    });
  });

  describe('enable / disable', () => {
    it('transitions to idle on enable', async () => {
      const { engine } = createEngine();
      await engine.enable();
      expect(engine.getStatus()).toEqual({ status: 'idle', lastSyncedAt: null });
    });

    it('restores lastSyncedAt from storage on enable', async () => {
      const { engine, storage } = createEngine();
      vi.mocked(storage.getLastSyncedAt).mockResolvedValue('2025-01-01T00:00:00Z');

      await engine.enable();
      expect(engine.getStatus()).toEqual({
        status: 'idle',
        lastSyncedAt: '2025-01-01T00:00:00Z',
      });
    });

    it('transitions to disabled and clears queue on disable', async () => {
      const { engine, queueStorage } = createEngine();
      await engine.enable();
      await engine.disable();

      expect(engine.getStatus()).toEqual({ status: 'disabled' });
      expect(queueStorage.clear).toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    it('does nothing if disabled', async () => {
      const { engine, client } = createEngine();
      await engine.sync();

      expect(client.pushNotes).not.toHaveBeenCalled();
      expect(client.pullNotes).not.toHaveBeenCalled();
    });

    it('does nothing if already syncing', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      // Make pullNotes block with a promise we control
      const pullPromise = new Promise<{ notes: SyncableNote[]; cursor: string; hasMore: boolean }>(
        (resolve) => {
          // Store resolver so we can resolve later
          setTimeout(() => resolve({ notes: [], cursor: '0', hasMore: false }), 50);
        }
      );
      vi.mocked(client.pullNotes).mockReturnValue(pullPromise);

      // Start first sync — will block on pullNotes
      const firstSync = engine.sync();

      // Wait a tick so first sync enters the syncing state
      await new Promise((r) => setTimeout(r, 10));

      // Second sync should bail because first is still in progress
      const secondSync = engine.sync();

      await firstSync;
      await secondSync;

      // pullNotes should only be called once (second sync was no-op)
      expect(client.pullNotes).toHaveBeenCalledTimes(1);
    });

    it('completes full push + pull cycle', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      const mockNote: NotePushPayload = {
        id: 'note_1',
        title: 'Test',
        content: '# Test',
        notebookId: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        archivedAt: null,
        isPinned: false,
        isDeleted: false,
        status: 'active',
        wordCount: 1,
        localVersion: 1,
      };

      vi.mocked(storage.getModifiedNotes).mockResolvedValue([mockNote]);
      vi.mocked(client.pushNotes).mockResolvedValue({
        synced: ['note_1'],
        conflicts: [],
        errors: [],
      });
      vi.mocked(client.pullNotes).mockResolvedValue({
        notes: [],
        cursor: '100',
        hasMore: false,
      });

      await engine.sync();

      expect(client.pushNotes).toHaveBeenCalledWith([mockNote], DEVICE_ID);
      expect(storage.markNotesSynced).toHaveBeenCalledWith(['note_1'], expect.any(Number));
      expect(client.pullNotes).toHaveBeenCalled();
      expect(storage.setCursor).toHaveBeenCalledWith('note', '100');
      expect(storage.setLastSyncedAt).toHaveBeenCalled();
      expect(engine.getStatus().status).toBe('idle');
    });

    it('pulls paginated results', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      vi.mocked(client.pullNotes)
        .mockResolvedValueOnce({ notes: [], cursor: '50', hasMore: true })
        .mockResolvedValueOnce({ notes: [], cursor: '100', hasMore: false });

      await engine.sync();

      expect(client.pullNotes).toHaveBeenCalledTimes(2);
      expect(storage.setCursor).toHaveBeenLastCalledWith('note', '100');
    });

    it('sets error status on failure', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      // pullNotes is always called (even with no local changes), so mock it to throw
      vi.mocked(client.pullNotes).mockRejectedValue(new Error('Network error'));

      await engine.sync();

      const status = engine.getStatus();
      expect(status.status).toBe('error');
      if (status.status === 'error') {
        expect(status.message).toBe('Network error');
      }
    });

    it('updates lastSyncedAt on successful sync', async () => {
      const { engine, storage } = createEngine();
      await engine.enable();

      await engine.sync();

      expect(storage.setLastSyncedAt).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('conflict handling', () => {
    it('auto-resolves with local-wins strategy', async () => {
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'local-wins',
      });
      const mockStorage = createMockStorage();
      // Rebuild engine with our mock
      Object.assign(storage, mockStorage);

      await engine.enable();

      vi.mocked(storage.getModifiedNotes).mockResolvedValue([
        {
          id: 'note_1',
          title: 'Test',
          content: '# Local',
          notebookId: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
          archivedAt: null,
          isPinned: false,
          isDeleted: false,
          status: 'active',
          wordCount: 1,
          localVersion: 2,
        },
      ]);

      vi.mocked(client.pushNotes).mockResolvedValue({
        synced: [],
        conflicts: [
          {
            entityType: 'note',
            entityId: 'note_1',
            conflictType: 'update-update',
            localVersion: { content: '# Local' },
            remoteVersion: { content: '# Remote' },
            localUpdatedAt: '2025-01-02T00:00:00Z',
            remoteUpdatedAt: '2025-01-01T12:00:00Z',
          },
        ],
        errors: [],
      });

      await engine.sync();

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('note_1', {
        entityId: 'note_1',
        strategy: 'local-wins',
      });
    });

    it('calls onConflict callback with manual strategy', async () => {
      const onConflict = vi.fn();
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'manual',
        onConflict,
      });
      await engine.enable();

      vi.mocked(storage.getModifiedNotes).mockResolvedValue([
        {
          id: 'note_1',
          title: 'Test',
          content: '# Test',
          notebookId: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          archivedAt: null,
          isPinned: false,
          isDeleted: false,
          status: 'active',
          wordCount: 1,
          localVersion: 1,
        },
      ]);

      const conflict = {
        entityType: 'note' as const,
        entityId: 'note_1',
        conflictType: 'update-update' as const,
        localVersion: {},
        remoteVersion: {},
        localUpdatedAt: '2025-01-01T00:00:00Z',
        remoteUpdatedAt: '2025-01-01T00:00:00Z',
      };

      vi.mocked(client.pushNotes).mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });

      await engine.sync();

      expect(onConflict).toHaveBeenCalledWith([conflict]);
      expect(engine.getStatus().status).toBe('conflict');
    });
  });

  describe('status callbacks', () => {
    it('fires onStatusChange during sync lifecycle', async () => {
      const onStatusChange = vi.fn();
      const { engine } = createEngine({ onStatusChange });

      await engine.enable();
      expect(onStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'idle' })
      );

      await engine.sync();

      const statuses = onStatusChange.mock.calls.map((call) => call[0].status);
      expect(statuses).toContain('syncing');
      expect(statuses).toContain('idle');
    });
  });

  describe('queueChange', () => {
    it('delegates to queue', async () => {
      const { engine, queueStorage } = createEngine();
      await engine.queueChange('note', 'note_1', 'update', { content: '# Test' });

      expect(queueStorage.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'note',
          entityId: 'note_1',
          operation: 'update',
        })
      );
    });
  });

  describe('resolveConflict', () => {
    it('calls client and re-syncs', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      await engine.resolveConflict('note_1', 'local');

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('note_1', {
        entityId: 'note_1',
        strategy: 'local-wins',
      });
    });
  });

  describe('device registration', () => {
    it('uses existing device ID', async () => {
      const { engine, storage, client } = createEngine();
      await engine.enable();

      await engine.sync();

      expect(storage.getDeviceId).toHaveBeenCalled();
      expect(client.registerDevice).not.toHaveBeenCalled();
    });

    it('registers new device if none exists', async () => {
      const { engine, storage, client } = createEngine();
      vi.mocked(storage.getDeviceId).mockResolvedValue(null);
      vi.mocked(client.registerDevice).mockResolvedValue('new_device' as DeviceId);

      await engine.enable();
      await engine.sync();

      expect(client.registerDevice).toHaveBeenCalled();
      expect(storage.setDeviceId).toHaveBeenCalledWith('new_device');
    });
  });

  describe('notebook sync', () => {
    it('pushes modified notebooks', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      const mockNotebook: NotebookPushPayload = {
        id: 'nb_1',
        name: 'Work',
        parentId: null,
        depth: 0,
        order: 0,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        localVersion: 1,
      };

      vi.mocked(storage.getModifiedNotebooks).mockResolvedValue([mockNotebook]);
      vi.mocked(client.pushNotebooks).mockResolvedValue({
        synced: ['nb_1'],
        conflicts: [],
        errors: [],
      });

      await engine.sync();

      expect(client.pushNotebooks).toHaveBeenCalledWith([mockNotebook], DEVICE_ID);
      expect(storage.markNotebooksSynced).toHaveBeenCalledWith(['nb_1'], expect.any(Number));
    });

    it('skips push when no modified notebooks', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      vi.mocked(storage.getModifiedNotebooks).mockResolvedValue([]);

      await engine.sync();

      expect(client.pushNotebooks).not.toHaveBeenCalled();
    });

    it('pulls remote notebooks', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      const remoteNotebook: SyncableNotebook = {
        id: 'nb_2',
        name: 'Personal',
        parentId: null,
        depth: 0,
        order: 1,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        deviceId: 'other_device' as DeviceId,
        syncVersion: 5,
        lastSyncedAt: '2025-01-02T00:00:00Z',
      };

      vi.mocked(client.pullNotebooks).mockResolvedValue({
        notebooks: [remoteNotebook],
        cursor: '5',
        hasMore: false,
      });

      await engine.sync();

      expect(client.pullNotebooks).toHaveBeenCalled();
      expect(storage.applyRemoteNotebooks).toHaveBeenCalledWith([remoteNotebook]);
      expect(storage.setCursor).toHaveBeenCalledWith('notebook', '5');
    });

    it('pulls notebooks before notes', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      const callOrder: string[] = [];

      vi.mocked(client.pullNotebooks).mockImplementation(async () => {
        callOrder.push('pullNotebooks');
        return { notebooks: [], cursor: '0', hasMore: false };
      });

      vi.mocked(client.pullNotes).mockImplementation(async () => {
        callOrder.push('pullNotes');
        return { notes: [], cursor: '0', hasMore: false };
      });

      await engine.sync();

      expect(callOrder).toEqual(['pullNotebooks', 'pullNotes']);
    });

    it('handles paginated notebook pull', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      vi.mocked(client.pullNotebooks)
        .mockResolvedValueOnce({ notebooks: [], cursor: '10', hasMore: true })
        .mockResolvedValueOnce({ notebooks: [], cursor: '20', hasMore: false });

      await engine.sync();

      expect(client.pullNotebooks).toHaveBeenCalledTimes(2);
      expect(storage.setCursor).toHaveBeenCalledWith('notebook', '20');
    });

    it('handles notebook push conflicts', async () => {
      const onConflict = vi.fn();
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'manual',
        onConflict,
      });
      await engine.enable();

      vi.mocked(storage.getModifiedNotebooks).mockResolvedValue([
        {
          id: 'nb_1',
          name: 'Work',
          parentId: null,
          depth: 0,
          order: 0,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
          localVersion: 2,
        },
      ]);

      const conflict = {
        entityType: 'notebook' as const,
        entityId: 'nb_1',
        conflictType: 'update-update' as const,
        localVersion: { name: 'Work' },
        remoteVersion: { name: 'Work Projects' },
        localUpdatedAt: '2025-01-02T00:00:00Z',
        remoteUpdatedAt: '2025-01-01T12:00:00Z',
      };

      vi.mocked(client.pushNotebooks).mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });

      await engine.sync();

      expect(onConflict).toHaveBeenCalledWith(expect.arrayContaining([conflict]));
      expect(engine.getStatus().status).toBe('conflict');
    });
  });
});
