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

/** Helper to convert a Note to a snapshot for IPC */
export type NoteToSnapshotFn = (note: {
  id: string;
  notebookId: string;
  content: string;
  title: string;
  isPinned: boolean;
  isDeleted: boolean;
  status: import('@dripnex/core').NoteStatus;
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: readonly string[];
    wordCount: number;
    archivedAt: string | null;
  };
}) => {
  id: string;
  notebookId: string;
  content: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  wordCount: number;
  archivedAt: string | null;
  isArchived: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  status: import('@dripnex/core').NoteStatus;
};

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
