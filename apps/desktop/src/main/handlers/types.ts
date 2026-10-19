/**
 * Shared dependency types for IPC handler modules.
 */

import type {
  DataPaths,
  ExtendedNoteRepository,
  NoteSyncTrackingRepository,
  NotebookGitSettingsRepository,
  NotebookSyncTrackingRepository,
} from '@dripnex/storage-core';
import type { NotebookRepository } from '@dripnex/core';
import type { ApiClient } from '../services/apiClient.js';
import type { EncryptionService } from '../services/encryptionService.js';
import type { SyncService } from '../services/syncService.js';
import type { GitService } from '../services/gitService.js';
import type { TokenStorage } from '../services/tokenStorage.js';
import type { AiKeyStorage } from '../services/aiKeyStorage.js';
import type { McpClientConfigStorage } from '../services/mcpClientConfigStorage.js';
import type { McpClientManager } from '../ai/mcpClientManager.js';

/** Database instance type (better-sqlite3) */
export type Database = ReturnType<typeof import('@dripnex/storage-sqlite').createDatabase>;

/**
 * Storage ports consumed by IPC handlers. These are interfaces from
 * @dripnex/storage-core (or @dripnex/core), never the concrete SQLite
 * classes — only main/index.ts (the composition root) should know about
 * @dripnex/storage-sqlite's concrete repository classes.
 */
export type NoteRepositoryPort = ExtendedNoteRepository;
export type NotebookRepositoryPort = NotebookRepository & NotebookGitSettingsRepository;
export type SyncCapableNoteRepository = ExtendedNoteRepository & NoteSyncTrackingRepository;
export type SyncCapableNotebookRepository = NotebookRepository & NotebookSyncTrackingRepository;

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
  ApiClient,
  EncryptionService,
  SyncService,
  GitService,
  TokenStorage,
  AiKeyStorage,
  McpClientConfigStorage,
  McpClientManager,
};
