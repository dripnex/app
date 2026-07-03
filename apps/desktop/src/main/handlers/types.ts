/**
 * Shared dependency types for IPC handler modules.
 */

import type { DataPaths } from '@dripnex/storage-core';
import type { SQLiteNoteRepository, SQLiteNotebookRepository } from '@dripnex/storage-sqlite';
import type { ApiClient } from '../services/apiClient.js';
import type { EncryptionService } from '../services/encryptionService.js';
import type { SyncService } from '../services/syncService.js';
import type { GitService } from '../services/gitService.js';
import type { TokenStorage } from '../services/tokenStorage.js';
import type { AiKeyStorage } from '../services/aiKeyStorage.js';

/** Database instance type (better-sqlite3) */
export type Database = ReturnType<typeof import('@dripnex/storage-sqlite').createDatabase>;

/** Broadcast helper signature */
export type BroadcastFn = (channel: string, ...args: unknown[]) => void;

/**
 * Helper to convert a domain Note to a snapshot for IPC. This is exactly
 * @dripnex/core's `toSnapshot`, so the shape lives in one place (core) instead
 * of being hand-mirrored here.
 */
export type NoteToSnapshotFn = typeof import('@dripnex/core').toSnapshot;

export type {
  DataPaths,
  SQLiteNoteRepository,
  SQLiteNotebookRepository,
  ApiClient,
  EncryptionService,
  SyncService,
  GitService,
  TokenStorage,
  AiKeyStorage,
};
