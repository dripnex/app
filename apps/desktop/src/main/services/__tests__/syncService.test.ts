/**
 * SyncService Integration Tests
 *
 * Tests the full sync orchestration with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../syncService';
import type { ApiClient, SyncChange, NotebookSyncChange } from '../apiClient';
import type { EncryptionService } from '../encryptionService';
import type { SQLiteNoteRepository, SQLiteNotebookRepository } from '@readied/storage-sqlite';
import { createNoteId, createNotebookId } from '@readied/core';

// ============================================================================
// Mocks
// ============================================================================

function createMockApiClient() {
  return {
    pullChanges: vi.fn(async () => ({
      changes: [],
      cursor: 0,
      hasMore: false,
    })),
    pushChanges: vi.fn(async () => ({
      results: [],
      cursor: 0,
    })),
    pullNotebookChanges: vi.fn(async () => ({
      changes: [],
      cursor: 0,
      hasMore: false,
    })),
    pushNotebookChanges: vi.fn(async () => ({
      results: [],
      cursor: 0,
    })),
    deviceInfo: { deviceId: 'test-device-id' },
  } as unknown as ApiClient;
}

function createMockEncryption() {
  return {
    encrypt: vi.fn(async (data: string) => `encrypted:${data}`),
    decrypt: vi.fn(async (data: string) => data.replace('encrypted:', '')),
  } as unknown as EncryptionService;
}

function createMockNoteRepo() {
  return {
    get: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    getPendingChanges: vi.fn(() => []),
    markAsSynced: vi.fn(),
    markMultipleAsSynced: vi.fn(),
    hasPendingEdits: vi.fn(() => false),
    resetSyncTracking: vi.fn(),
  } as unknown as SQLiteNoteRepository;
}

function createMockNotebookRepo() {
  return {
    get: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    getPendingChanges: vi.fn(() => []),
    markAsSynced: vi.fn(),
    markMultipleAsSynced: vi.fn(),
    hasPendingEdits: vi.fn(() => false),
  } as unknown as SQLiteNotebookRepository;
}

function createService(opts?: { withNotebooks?: boolean; cursor?: number }) {
  const apiClient = createMockApiClient();
  const encryption = createMockEncryption();
  const noteRepo = createMockNoteRepo();
  const notebookRepo = opts?.withNotebooks ? createMockNotebookRepo() : undefined;
  const service = new SyncService(
    apiClient,
    encryption,
    noteRepo,
    notebookRepo,
    opts?.cursor ?? 0
  );
  return { service, apiClient, encryption, noteRepo, notebookRepo };
}

// ============================================================================
// Tests
// ============================================================================

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Pull
  // ==========================================================================

  describe('pull', () => {
    it('pulls changes from server and advances cursor', async () => {
      const { service, apiClient } = createService();
      const remoteChanges: SyncChange[] = [
        {
          id: 'c1',
          noteId: 'note_1',
          version: 5,
          operation: 'create',
          encryptedData: 'encrypted:# Hello World',
          deviceId: 'other-device',
          createdAt: '2025-06-01T00:00:00Z',
        },
      ];

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: remoteChanges,
        cursor: 5,
        hasMore: false,
      });

      const result = await service.pull();

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.cursor).toBe(5);
      expect(result.hasMore).toBe(false);
      expect(service.getState().cursor).toBe(5);
    });

    it('creates new notes from remote changes', async () => {
      const { service, apiClient, noteRepo, encryption } = createService();

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [
          {
            id: 'c1',
            noteId: 'note_1',
            version: 1,
            operation: 'create',
            encryptedData: 'encrypted:# New Note\nContent here',
            deviceId: 'other-device',
            createdAt: '2025-06-01T00:00:00Z',
          },
        ],
        cursor: 1,
        hasMore: false,
      });

      await service.pull();

      expect(encryption.decrypt).toHaveBeenCalledWith('encrypted:# New Note\nContent here');
      expect(noteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: createNoteId('note_1'),
          content: '# New Note\nContent here',
          title: 'New Note',
        })
      );
      expect(noteRepo.markAsSynced).toHaveBeenCalledWith(createNoteId('note_1'));
    });

    it('detects conflicts when local note has pending edits', async () => {
      const { service, apiClient, noteRepo } = createService();

      // Existing note with pending edits
      (noteRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: createNoteId('note_1'),
        content: '# Local Version',
        title: 'Local Version',
        notebookId: createNotebookId('inbox'),
        isPinned: false,
        isDeleted: false,
        status: 'active',
        metadata: {
          title: 'Local Version',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-06-01T00:00:00.000Z',
          tags: [],
          wordCount: 2,
          archivedAt: null,
        },
      });
      (noteRepo.hasPendingEdits as ReturnType<typeof vi.fn>).mockReturnValue(true);

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [
          {
            id: 'c1',
            noteId: 'note_1',
            version: 5,
            operation: 'update',
            encryptedData: 'encrypted:# Remote Version',
            deviceId: 'other-device',
            createdAt: '2025-06-02T00:00:00Z',
          },
        ],
        cursor: 5,
        hasMore: false,
      });

      const result = await service.pull();

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]!.localContent).toBe('# Local Version');
      expect(result.conflicts[0]!.remoteContent).toBe('# Remote Version');
      // Should create a conflict copy
      expect(noteRepo.save).toHaveBeenCalledTimes(2); // conflict copy + apply remote
    });

    it('applies remote update without conflict when no local edits', async () => {
      const { service, apiClient, noteRepo } = createService();

      (noteRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: createNoteId('note_1'),
        content: '# Old Content',
        title: 'Old Content',
        notebookId: createNotebookId('inbox'),
        isPinned: false,
        isDeleted: false,
        status: 'active',
        metadata: {
          title: 'Old Content',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-06-01T00:00:00.000Z',
          tags: [],
          wordCount: 2,
          archivedAt: null,
        },
      });
      (noteRepo.hasPendingEdits as ReturnType<typeof vi.fn>).mockReturnValue(false);

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [
          {
            id: 'c1',
            noteId: 'note_1',
            version: 3,
            operation: 'update',
            encryptedData: 'encrypted:# Updated Content',
            deviceId: 'other-device',
            createdAt: '2025-06-02T00:00:00Z',
          },
        ],
        cursor: 3,
        hasMore: false,
      });

      const result = await service.pull();

      expect(result.conflicts).toHaveLength(0);
      expect(noteRepo.save).toHaveBeenCalledTimes(1); // only apply remote, no conflict copy
      expect(noteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ content: '# Updated Content' })
      );
    });

    it('handles delete operations', async () => {
      const { service, apiClient, noteRepo } = createService();

      (noteRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: createNoteId('note_1'),
        content: '# Will Be Deleted',
        title: 'Will Be Deleted',
      });

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [
          {
            id: 'c1',
            noteId: 'note_1',
            version: 10,
            operation: 'delete',
            encryptedData: null,
            deviceId: 'other-device',
            createdAt: '2025-06-01T00:00:00Z',
          },
        ],
        cursor: 10,
        hasMore: false,
      });

      const result = await service.pull();

      expect(result.success).toBe(true);
      expect(noteRepo.delete).toHaveBeenCalledWith(createNoteId('note_1'));
    });

    it('stops processing on error and preserves cursor', async () => {
      const { service, apiClient, encryption } = createService({ cursor: 5 });

      // First change succeeds, second fails during decrypt
      (encryption.decrypt as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('# Good Note')
        .mockRejectedValueOnce(new Error('Decryption failed'));

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [
          {
            id: 'c1',
            noteId: 'note_1',
            version: 6,
            operation: 'create',
            encryptedData: 'enc1',
            deviceId: 'other',
            createdAt: '2025-06-01T00:00:00Z',
          },
          {
            id: 'c2',
            noteId: 'note_2',
            version: 7,
            operation: 'create',
            encryptedData: 'enc2',
            deviceId: 'other',
            createdAt: '2025-06-02T00:00:00Z',
          },
        ],
        cursor: 7,
        hasMore: false,
      });

      const result = await service.pull();

      expect(result.success).toBe(true);
      // Cursor should be at 6 (last successfully applied), not 7 (server cursor)
      expect(service.getState().cursor).toBe(6);
    });

    it('returns error on API failure', async () => {
      const { service, apiClient } = createService();

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.pull();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  // ==========================================================================
  // Push
  // ==========================================================================

  describe('push', () => {
    it('encrypts content and pushes to server', async () => {
      const { service, apiClient, encryption } = createService();

      (apiClient.pushChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [{ noteId: 'note_1', version: 2, status: 'applied' }],
        cursor: 2,
      });

      const result = await service.push([
        {
          noteId: 'note_1',
          operation: 'update',
          content: '# My Note',
          localVersion: 1,
        },
      ]);

      expect(encryption.encrypt).toHaveBeenCalledWith('# My Note');
      expect(result.success).toBe(true);
      expect(result.results[0]!.status).toBe('applied');
      expect(service.getState().cursor).toBe(2);
    });

    it('skips encryption for delete operations', async () => {
      const { service, apiClient, encryption } = createService();

      (apiClient.pushChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [{ noteId: 'note_1', version: 3, status: 'applied' }],
        cursor: 3,
      });

      await service.push([
        {
          noteId: 'note_1',
          operation: 'delete',
          content: '# Should not encrypt this',
          localVersion: 2,
        },
      ]);

      expect(encryption.encrypt).not.toHaveBeenCalled();
    });

    it('returns error on push failure', async () => {
      const { service, apiClient } = createService();

      (apiClient.pushChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Server error')
      );

      const result = await service.push([
        { noteId: 'note_1', operation: 'update', content: 'data' },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });
  });

  // ==========================================================================
  // Full sync cycle (syncNow)
  // ==========================================================================

  describe('syncNow', () => {
    it('performs pull then push in sequence', async () => {
      const { service, apiClient, noteRepo } = createService();
      const callOrder: string[] = [];

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('pullNotes');
        return { changes: [], cursor: 0, hasMore: false };
      });
      (noteRepo.getPendingChanges as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('getPending');
        return [];
      });

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(callOrder).toEqual(['pullNotes', 'getPending']);
    });

    it('pushes pending note changes after pull', async () => {
      const { service, apiClient, noteRepo } = createService();

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [],
        cursor: 0,
        hasMore: false,
      });

      (noteRepo.getPendingChanges as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          note: {
            id: 'note_1',
            content: '# Pending',
            isDeleted: false,
          },
          localVersion: 1,
        },
      ]);

      (apiClient.pushChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [{ noteId: 'note_1', version: 1, status: 'applied' }],
        cursor: 1,
      });

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(result.changesPushed).toBe(1);
      expect(noteRepo.markMultipleAsSynced).toHaveBeenCalled();
    });

    it('prevents concurrent sync calls', async () => {
      const { service, apiClient } = createService();

      // Make pull slow
      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 50, { changes: [], cursor: 0, hasMore: false }))
      );

      // Start two syncs concurrently
      const [result1, result2] = await Promise.all([
        service.syncNow(),
        service.syncNow(),
      ]);

      // One should succeed, one should be rejected
      const failed = [result1, result2].find(r => !r.success);
      expect(failed?.error).toBe('Sync already in progress');
    });

    it('resets isSyncing flag even on error', async () => {
      const { service, apiClient } = createService();

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Crash')
      );

      const result = await service.syncNow();

      expect(result.success).toBe(false);
      expect(service.getState().isSyncing).toBe(false);
    });

    it('handles deleted notes in push', async () => {
      const { service, apiClient, noteRepo, encryption } = createService();

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [],
        cursor: 0,
        hasMore: false,
      });

      (noteRepo.getPendingChanges as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          note: {
            id: 'note_1',
            content: '',
            isDeleted: true,
          },
          localVersion: 3,
        },
      ]);

      (apiClient.pushChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [{ noteId: 'note_1', version: 4, status: 'applied' }],
        cursor: 4,
      });

      await service.syncNow();

      // Should push with operation 'delete'
      expect(apiClient.pushChanges).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            noteId: 'note_1',
            operation: 'delete',
          }),
        ])
      );
      // Should not encrypt content for deletes
      expect(encryption.encrypt).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Notebook sync
  // ==========================================================================

  describe('notebook sync', () => {
    it('pulls and applies notebook changes during syncNow', async () => {
      const { service, apiClient, notebookRepo } = createService({ withNotebooks: true });

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [],
        cursor: 0,
        hasMore: false,
      });

      const nbChange: NotebookSyncChange = {
        id: 'nbc1',
        notebookId: 'nb_1',
        version: 1,
        operation: 'create',
        encryptedData: 'encrypted:' + JSON.stringify({
          name: 'Work Notes',
          parentId: null,
          depth: 0,
          order: 0,
        }),
        deviceId: 'other-device',
        createdAt: '2025-06-01T00:00:00Z',
      };

      (apiClient.pullNotebookChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [nbChange],
        cursor: 1,
        hasMore: false,
      });

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(apiClient.pullNotebookChanges).toHaveBeenCalled();
      expect(notebookRepo!.save).toHaveBeenCalled();
      expect(notebookRepo!.markAsSynced).toHaveBeenCalledWith(createNotebookId('nb_1'));
    });

    it('pushes pending notebook changes during syncNow', async () => {
      const { service, apiClient, notebookRepo } = createService({ withNotebooks: true });

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [],
        cursor: 0,
        hasMore: false,
      });
      (apiClient.pullNotebookChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [],
        cursor: 0,
        hasMore: false,
      });

      (notebookRepo!.getPendingChanges as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          notebook: {
            id: 'nb_1',
            name: 'My Notebook',
            parentId: null,
            depth: 0,
            order: 0,
          },
          localVersion: 1,
        },
      ]);

      (apiClient.pushNotebookChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [{ notebookId: 'nb_1', version: 1, status: 'applied' }],
        cursor: 1,
      });

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(apiClient.pushNotebookChanges).toHaveBeenCalled();
      expect(notebookRepo!.markMultipleAsSynced).toHaveBeenCalled();
    });

    it('handles notebook delete operations', async () => {
      const { service, apiClient, notebookRepo } = createService({ withNotebooks: true });

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [],
        cursor: 0,
        hasMore: false,
      });

      (notebookRepo!.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: createNotebookId('nb_1'),
        name: 'Old Notebook',
      });

      (apiClient.pullNotebookChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [
          {
            id: 'nbc1',
            notebookId: 'nb_1',
            version: 5,
            operation: 'delete',
            encryptedData: null,
            deviceId: 'other-device',
            createdAt: '2025-06-01T00:00:00Z',
          },
        ],
        cursor: 5,
        hasMore: false,
      });

      await service.syncNow();

      expect(notebookRepo!.delete).toHaveBeenCalledWith(createNotebookId('nb_1'));
    });

    it('skips notebook sync when no notebook repository', async () => {
      const { service, apiClient } = createService({ withNotebooks: false });

      (apiClient.pullChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
        changes: [],
        cursor: 0,
        hasMore: false,
      });

      await service.syncNow();

      expect(apiClient.pullNotebookChanges).not.toHaveBeenCalled();
      expect(apiClient.pushNotebookChanges).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Conflict resolution
  // ==========================================================================

  describe('resolveConflict', () => {
    it('keeps local version and marks for re-sync', async () => {
      const { service, noteRepo } = createService();

      (noteRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: createNoteId('note_1'),
        content: '# Local',
        title: 'Local',
      });

      await service.resolveConflict('note_1', 'local');

      expect(noteRepo.resetSyncTracking).toHaveBeenCalledWith(createNoteId('note_1'));
    });

    it('keeps remote version and marks as synced', async () => {
      const { service, noteRepo } = createService();

      (noteRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: createNoteId('note_1'),
        content: '# Remote Applied',
        title: 'Remote Applied',
      });

      await service.resolveConflict('note_1', 'remote');

      expect(noteRepo.markAsSynced).toHaveBeenCalledWith(createNoteId('note_1'));
    });

    it('throws if note not found', async () => {
      const { service, noteRepo } = createService();

      (noteRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.resolveConflict('note_999', 'local')).rejects.toThrow(
        'Note note_999 not found'
      );
    });
  });

  // ==========================================================================
  // Auto-sync
  // ==========================================================================

  describe('autoSync', () => {
    it('starts and stops auto-sync timer', () => {
      vi.useFakeTimers();
      const { service } = createService();

      service.startAutoSync(1000);
      expect(service.getState().isSyncing).toBe(false);

      service.stopAutoSync();
      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // State
  // ==========================================================================

  describe('getState', () => {
    it('returns a copy of the state', () => {
      const { service } = createService({ cursor: 42 });

      const state = service.getState();

      expect(state.cursor).toBe(42);
      expect(state.notebookCursor).toBe(0);
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncAt).toBe(null);
    });
  });
});
