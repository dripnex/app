/**
 * SyncEngine Tests
 *
 * Tests for the sync engine that orchestrates push/pull operations,
 * conflict resolution, device registration, and status management.
 */

import { describe, it, expect, vi } from 'vitest';
import { SyncEngine, type SyncStorage, type SyncEngineConfig } from '../src/engine';
import type { SyncClient, NotePushPayload } from '../src/client';
import type { SyncQueue } from '../src/queue';
import type { DeviceId, SyncStatus, SyncConflict, SyncableNote, PushResult } from '../src/types';

// ============================================================================
// Test Helpers
// ============================================================================

const DEVICE_ID = 'device_abc123' as DeviceId;

function createMockClient(): {
  [K in keyof SyncClient]: ReturnType<typeof vi.fn>;
} {
  return {
    requestMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    pushNotes: vi.fn().mockResolvedValue({ synced: [], conflicts: [], errors: [] }),
    pullNotes: vi.fn().mockResolvedValue({ notes: [], cursor: 'cursor_0', hasMore: false }),
    resolveNoteConflict: vi.fn(),
    pushNotebooks: vi.fn(),
    pullNotebooks: vi.fn(),
    registerDevice: vi.fn().mockResolvedValue(DEVICE_ID),
    listDevices: vi.fn(),
    revokeDevice: vi.fn(),
  };
}

function createMockStorage(): {
  [K in keyof SyncStorage]: ReturnType<typeof vi.fn>;
} {
  return {
    getDeviceId: vi.fn().mockResolvedValue(DEVICE_ID),
    setDeviceId: vi.fn().mockResolvedValue(undefined),
    getCursor: vi.fn().mockResolvedValue(null),
    setCursor: vi.fn().mockResolvedValue(undefined),
    getModifiedNotes: vi.fn().mockResolvedValue([]),
    applyRemoteNotes: vi.fn().mockResolvedValue([]),
    markNotesSynced: vi.fn().mockResolvedValue(undefined),
    getLastSyncedAt: vi.fn().mockResolvedValue(null),
    setLastSyncedAt: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockQueue(): {
  [K in keyof InstanceType<typeof import('../src/queue').SyncQueue>]: ReturnType<typeof vi.fn>;
} {
  return {
    queueChange: vi.fn().mockResolvedValue(undefined),
    getPendingChanges: vi.fn().mockResolvedValue([]),
    markSynced: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    getPendingCount: vi.fn().mockResolvedValue(0),
    clear: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(0),
  };
}

function createEngine(overrides: Partial<SyncEngineConfig> = {}) {
  const client = createMockClient();
  const storage = createMockStorage();
  const queue = createMockQueue();
  const onStatusChange = vi.fn();
  const onConflict = vi.fn();

  const engine = new SyncEngine({
    client: client as unknown as SyncClient,
    storage: storage as unknown as SyncStorage,
    queue: queue as unknown as SyncQueue,
    onStatusChange,
    onConflict,
    platform: 'darwin',
    appVersion: '0.6.2',
    ...overrides,
  });

  return { engine, client, storage, queue, onStatusChange, onConflict };
}

function makeNote(id: string): NotePushPayload {
  return {
    id,
    title: `Note ${id}`,
    content: `Content of ${id}`,
    notebookId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    archivedAt: null,
    isPinned: false,
    isDeleted: false,
    status: 'active',
    wordCount: 10,
    localVersion: 1,
  };
}

function makeSyncableNote(id: string): SyncableNote {
  return {
    id,
    title: `Note ${id}`,
    content: `Content of ${id}`,
    notebookId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    archivedAt: null,
    isPinned: false,
    isDeleted: false,
    status: 'active',
    wordCount: 10,
    deviceId: DEVICE_ID,
    syncVersion: 1,
    lastSyncedAt: '2024-01-02T00:00:00Z',
  };
}

function makeConflict(entityId: string, localNewer = true): SyncConflict {
  return {
    entityType: 'note',
    entityId,
    conflictType: 'update-update',
    localVersion: { title: 'Local' },
    remoteVersion: { title: 'Remote' },
    localUpdatedAt: localNewer ? '2024-01-03T00:00:00Z' : '2024-01-01T00:00:00Z',
    remoteUpdatedAt: localNewer ? '2024-01-01T00:00:00Z' : '2024-01-03T00:00:00Z',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SyncEngine', () => {
  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('Lifecycle', () => {
    it('getStatus() returns disabled initially', () => {
      const { engine } = createEngine();
      expect(engine.getStatus()).toEqual({ status: 'disabled' });
    });

    it('enable() sets status to idle with lastSyncedAt from storage', async () => {
      const { engine, storage, onStatusChange } = createEngine();
      storage.getLastSyncedAt.mockResolvedValue('2024-01-07T12:00:00Z');

      await engine.enable();

      expect(engine.getStatus()).toEqual({
        status: 'idle',
        lastSyncedAt: '2024-01-07T12:00:00Z',
      });
      expect(onStatusChange).toHaveBeenCalledWith({
        status: 'idle',
        lastSyncedAt: '2024-01-07T12:00:00Z',
      });
    });

    it('enable() sets lastSyncedAt to null when never synced', async () => {
      const { engine, storage } = createEngine();
      storage.getLastSyncedAt.mockResolvedValue(null);

      await engine.enable();

      expect(engine.getStatus()).toEqual({ status: 'idle', lastSyncedAt: null });
    });

    it('disable() sets status to disabled and clears queue', async () => {
      const { engine, queue } = createEngine();

      await engine.enable();
      await engine.disable();

      expect(engine.getStatus()).toEqual({ status: 'disabled' });
      expect(queue.clear).toHaveBeenCalledOnce();
    });
  });

  // ==========================================================================
  // Sync Cycle — Happy Path
  // ==========================================================================

  describe('Sync Cycle — Happy Path', () => {
    it('sync() skips when disabled', async () => {
      const { engine, client } = createEngine();

      await engine.sync();

      expect(client.pushNotes).not.toHaveBeenCalled();
      expect(client.pullNotes).not.toHaveBeenCalled();
    });

    it('sync() skips when already syncing (reentrance guard)', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      // Make pushNotes slow so sync is still in progress
      let resolvePush!: (v: PushResult) => void;
      client.pushNotes.mockReturnValue(
        new Promise<PushResult>(resolve => {
          resolvePush = resolve;
        })
      );
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);

      // Start first sync
      const firstSync = engine.sync();

      // Start second sync while first is in progress
      const secondSync = engine.sync();

      // Resolve the push
      resolvePush({ synced: ['n1'], conflicts: [], errors: [] });

      await firstSync;
      await secondSync;

      // pushNotes should only be called once (second sync was skipped)
      expect(client.pushNotes).toHaveBeenCalledTimes(1);
    });

    it('sync() pushes then pulls with no conflicts', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: ['n1'],
        conflicts: [],
        errors: [],
      });
      client.pullNotes.mockResolvedValue({
        notes: [makeSyncableNote('n2')],
        cursor: 'cursor_1',
        hasMore: false,
      });

      await engine.sync();

      // Both push and pull were called
      expect(client.pushNotes).toHaveBeenCalled();
      expect(client.pullNotes).toHaveBeenCalled();

      // Pull applied notes
      expect(storage.applyRemoteNotes).toHaveBeenCalledWith([makeSyncableNote('n2')]);

      // Cursor stored
      expect(storage.setCursor).toHaveBeenCalledWith('note', 'cursor_1');

      // Final status is idle with updated lastSyncedAt
      const finalStatus = engine.getStatus();
      expect(finalStatus.status).toBe('idle');
    });

    it('sync() registers device if no deviceId', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getDeviceId.mockResolvedValue(null);
      const newDeviceId = 'new_device_xyz' as DeviceId;
      client.registerDevice.mockResolvedValue(newDeviceId);

      await engine.sync();

      expect(client.registerDevice).toHaveBeenCalledWith({
        name: 'Readied Desktop',
        platform: 'darwin',
        version: '0.6.2',
      });
      expect(storage.setDeviceId).toHaveBeenCalledWith(newDeviceId);
    });

    it('sync() reuses cached deviceId without registering', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getDeviceId.mockResolvedValue(DEVICE_ID);
      // Ensure push is called so we can verify the deviceId was passed
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({ synced: ['n1'], conflicts: [], errors: [] });

      await engine.sync();

      expect(client.registerDevice).not.toHaveBeenCalled();
      expect(client.pushNotes).toHaveBeenCalledWith(expect.anything(), DEVICE_ID);
    });

    it('sync() updates lastSyncedAt in storage on success', async () => {
      const { engine, storage } = createEngine();
      await engine.enable();

      await engine.sync();

      expect(storage.setLastSyncedAt).toHaveBeenCalledWith(expect.any(String));
      // Verify it's a valid ISO string
      const timestamp = storage.setLastSyncedAt.mock.calls[0][0];
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  // ==========================================================================
  // Push
  // ==========================================================================

  describe('Push', () => {
    it('push with no modified notes does not call pushNotes', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getModifiedNotes.mockResolvedValue([]);

      await engine.sync();

      expect(client.pushNotes).not.toHaveBeenCalled();
    });

    it('push marks synced notes in storage', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getModifiedNotes.mockResolvedValue([makeNote('n1'), makeNote('n2')]);
      client.pushNotes.mockResolvedValue({
        synced: ['n1', 'n2'],
        conflicts: [],
        errors: [],
      });

      await engine.sync();

      expect(storage.markNotesSynced).toHaveBeenCalledWith(['n1', 'n2'], expect.any(Number));
    });

    it('push does not mark synced when no notes were synced', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [],
        errors: [
          {
            entityId: 'n1',
            entityType: 'note',
            message: 'fail',
            code: 'SERVER_ERROR',
            retryable: true,
          },
        ],
      });

      await engine.sync();

      expect(storage.markNotesSynced).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Pull
  // ==========================================================================

  describe('Pull', () => {
    it('pull paginates until hasMore is false', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      // Page 1: hasMore = true
      client.pullNotes
        .mockResolvedValueOnce({
          notes: [makeSyncableNote('n1')],
          cursor: 'cursor_1',
          hasMore: true,
        })
        // Page 2: hasMore = true
        .mockResolvedValueOnce({
          notes: [makeSyncableNote('n2')],
          cursor: 'cursor_2',
          hasMore: true,
        })
        // Page 3: hasMore = false (done)
        .mockResolvedValueOnce({
          notes: [makeSyncableNote('n3')],
          cursor: 'cursor_3',
          hasMore: false,
        });

      await engine.sync();

      expect(client.pullNotes).toHaveBeenCalledTimes(3);
      expect(storage.applyRemoteNotes).toHaveBeenCalledTimes(3);
    });

    it('pull stores cursor after each page', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      client.pullNotes
        .mockResolvedValueOnce({
          notes: [makeSyncableNote('n1')],
          cursor: 'cursor_page1',
          hasMore: true,
        })
        .mockResolvedValueOnce({
          notes: [],
          cursor: 'cursor_page2',
          hasMore: false,
        });

      await engine.sync();

      expect(storage.setCursor).toHaveBeenCalledWith('note', 'cursor_page1');
      expect(storage.setCursor).toHaveBeenCalledWith('note', 'cursor_page2');
      expect(storage.setCursor).toHaveBeenCalledTimes(2);
    });

    it('pull uses existing cursor from storage', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getCursor.mockResolvedValue('existing_cursor');

      await engine.sync();

      expect(client.pullNotes).toHaveBeenCalledWith('existing_cursor', DEVICE_ID, 100);
    });

    it('pull skips applyRemoteNotes when page has no notes', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      client.pullNotes.mockResolvedValue({
        notes: [],
        cursor: 'cursor_0',
        hasMore: false,
      });

      await engine.sync();

      expect(storage.applyRemoteNotes).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Conflicts
  // ==========================================================================

  describe('Conflicts', () => {
    it('latest-wins strategy auto-resolves with local when local is newer', async () => {
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'latest-wins',
      });
      await engine.enable();

      const conflict = makeConflict('n1', true); // local newer
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });
      client.resolveNoteConflict.mockResolvedValue(makeSyncableNote('n1'));

      await engine.sync();

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('n1', {
        entityId: 'n1',
        strategy: 'local-wins',
      });
      // Should continue to pull phase, not stop at conflict
      expect(client.pullNotes).toHaveBeenCalled();
    });

    it('latest-wins strategy auto-resolves with remote when remote is newer', async () => {
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'latest-wins',
      });
      await engine.enable();

      const conflict = makeConflict('n1', false); // remote newer
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });
      client.resolveNoteConflict.mockResolvedValue(makeSyncableNote('n1'));

      await engine.sync();

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('n1', {
        entityId: 'n1',
        strategy: 'remote-wins',
      });
    });

    it('local-wins strategy resolves all conflicts as local-wins', async () => {
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'local-wins',
      });
      await engine.enable();

      const conflict = makeConflict('n1', false); // remote is newer, but strategy overrides
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });
      client.resolveNoteConflict.mockResolvedValue(makeSyncableNote('n1'));

      await engine.sync();

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('n1', {
        entityId: 'n1',
        strategy: 'local-wins',
      });
    });

    it('remote-wins strategy resolves all conflicts as remote-wins', async () => {
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'remote-wins',
      });
      await engine.enable();

      const conflict = makeConflict('n1', true); // local is newer, but strategy overrides
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });
      client.resolveNoteConflict.mockResolvedValue(makeSyncableNote('n1'));

      await engine.sync();

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('n1', {
        entityId: 'n1',
        strategy: 'remote-wins',
      });
    });

    it('manual strategy calls onConflict callback and sets conflict status', async () => {
      const { engine, client, storage, onConflict } = createEngine({
        defaultConflictStrategy: 'manual',
      });
      await engine.enable();

      const conflict = makeConflict('n1');
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });

      await engine.sync();

      expect(onConflict).toHaveBeenCalledWith([conflict]);
      expect(engine.getStatus()).toEqual({
        status: 'conflict',
        conflicts: [conflict],
      });
      // Should NOT proceed to pull phase
      expect(client.pullNotes).not.toHaveBeenCalled();
    });

    it('unresolved auto-resolve conflicts set conflict status', async () => {
      const { engine, client, storage } = createEngine({
        defaultConflictStrategy: 'latest-wins',
      });
      await engine.enable();

      const conflict = makeConflict('n1');
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });
      // resolveNoteConflict throws => conflict becomes unresolved
      client.resolveNoteConflict.mockRejectedValue(new Error('Resolution failed'));

      await engine.sync();

      expect(engine.getStatus()).toEqual({
        status: 'conflict',
        conflicts: [conflict],
      });
      expect(client.pullNotes).not.toHaveBeenCalled();
    });

    it('defaults to latest-wins when no strategy is configured', async () => {
      // No defaultConflictStrategy provided
      const { engine, client, storage } = createEngine();
      await engine.enable();

      const conflict = makeConflict('n1', true);
      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockResolvedValue({
        synced: [],
        conflicts: [conflict],
        errors: [],
      });
      client.resolveNoteConflict.mockResolvedValue(makeSyncableNote('n1'));

      await engine.sync();

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('n1', {
        entityId: 'n1',
        strategy: 'local-wins',
      });
    });
  });

  // ==========================================================================
  // resolveConflict()
  // ==========================================================================

  describe('resolveConflict()', () => {
    it('calls client.resolveNoteConflict with correct resolution and re-syncs', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      client.resolveNoteConflict.mockResolvedValue(makeSyncableNote('n1'));

      await engine.resolveConflict('n1', 'local');

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('n1', {
        entityId: 'n1',
        strategy: 'local-wins',
      });
      // Should trigger a sync after resolution
      expect(client.pullNotes).toHaveBeenCalled();
    });

    it('maps remote strategy correctly', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      client.resolveNoteConflict.mockResolvedValue(makeSyncableNote('n1'));

      await engine.resolveConflict('n1', 'remote');

      expect(client.resolveNoteConflict).toHaveBeenCalledWith('n1', {
        entityId: 'n1',
        strategy: 'remote-wins',
      });
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('network error during push sets error status', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getModifiedNotes.mockResolvedValue([makeNote('n1')]);
      client.pushNotes.mockRejectedValue(new Error('Network timeout'));

      await engine.sync();

      expect(engine.getStatus()).toEqual({
        status: 'error',
        message: 'Network timeout',
        lastSyncedAt: null,
      });
    });

    it('network error during pull sets error status', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      client.pullNotes.mockRejectedValue(new Error('Connection refused'));

      await engine.sync();

      expect(engine.getStatus()).toEqual({
        status: 'error',
        message: 'Connection refused',
        lastSyncedAt: null,
      });
    });

    it('error preserves lastSyncedAt from storage', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getLastSyncedAt.mockResolvedValue('2024-01-07T12:00:00Z');
      client.pullNotes.mockRejectedValue(new Error('Server error'));

      await engine.sync();

      expect(engine.getStatus()).toEqual({
        status: 'error',
        message: 'Server error',
        lastSyncedAt: '2024-01-07T12:00:00Z',
      });
    });

    it('non-Error thrown uses fallback message', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      client.pullNotes.mockRejectedValue('string error');

      await engine.sync();

      expect(engine.getStatus()).toEqual({
        status: 'error',
        message: 'Sync failed',
        lastSyncedAt: null,
      });
    });

    it('isSyncing is reset after error', async () => {
      const { engine, client } = createEngine();
      await engine.enable();

      client.pullNotes.mockRejectedValue(new Error('fail'));

      await engine.sync();

      // Should be able to sync again (not stuck in syncing state)
      client.pullNotes.mockResolvedValue({ notes: [], cursor: 'c', hasMore: false });
      await engine.sync();

      expect(client.pullNotes).toHaveBeenCalledTimes(2);
    });

    it('device registration failure sets error status', async () => {
      const { engine, client, storage } = createEngine();
      await engine.enable();

      storage.getDeviceId.mockResolvedValue(null);
      client.registerDevice.mockRejectedValue(new Error('Unauthorized'));

      await engine.sync();

      expect(engine.getStatus()).toEqual({
        status: 'error',
        message: 'Unauthorized',
        lastSyncedAt: null,
      });
    });
  });

  // ==========================================================================
  // Status Callback
  // ==========================================================================

  describe('Status callback', () => {
    it('fires on each status transition during successful sync', async () => {
      const { engine, onStatusChange } = createEngine();
      await engine.enable();

      onStatusChange.mockClear(); // clear the enable() call

      await engine.sync();

      const statuses = (onStatusChange.mock.calls as [SyncStatus][]).map(call => call[0].status);

      // syncing (progress 0) → syncing (progress 10) → syncing (progress 40) →
      // syncing (progress 50) → idle
      expect(statuses[0]).toBe('syncing');
      expect(statuses[statuses.length - 1]).toBe('idle');
    });

    it('fires with progress updates during pull pagination', async () => {
      const { engine, client, onStatusChange } = createEngine();
      await engine.enable();
      onStatusChange.mockClear();

      client.pullNotes
        .mockResolvedValueOnce({ notes: [makeSyncableNote('n1')], cursor: 'c1', hasMore: true })
        .mockResolvedValueOnce({ notes: [makeSyncableNote('n2')], cursor: 'c2', hasMore: false });

      await engine.sync();

      const progressCalls = (onStatusChange.mock.calls as [SyncStatus][])
        .filter(call => call[0].status === 'syncing')
        .map(call => (call[0] as { status: 'syncing'; progress: number }).progress);

      // Progress should be increasing
      for (let i = 1; i < progressCalls.length; i++) {
        expect(progressCalls[i]).toBeGreaterThanOrEqual(progressCalls[i - 1]);
      }
    });
  });

  // ==========================================================================
  // Queue
  // ==========================================================================

  describe('Queue', () => {
    it('queueChange delegates to queue', async () => {
      const { engine, queue } = createEngine();

      const data = { title: 'Updated' };
      await engine.queueChange('note', 'n1', 'update', data);

      expect(queue.queueChange).toHaveBeenCalledWith('note', 'n1', 'update', data);
    });
  });
});
