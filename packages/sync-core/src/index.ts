/**
 * @readied/sync-core
 *
 * Core sync logic for Readied. Pure TypeScript, no platform dependencies.
 *
 * This package provides:
 * - Type definitions for sync entities and operations
 * - Sync queue management for offline changes
 * - Sync engine to orchestrate push/pull operations
 * - Interfaces for platform-specific implementations
 *
 * Platform-specific code (API client, SQLite storage) should implement
 * the interfaces defined here.
 */

// Types
export type {
  DeviceId,
  SyncVersion,
  UserId,
  SyncStatus,
  ConnectionStatus,
  SyncableFields,
  SyncableNote,
  SyncableNotebook,
  EntityType,
  SyncOperation,
  SyncChange,
  PushResult,
  PullResult,
  ConflictType,
  SyncConflict,
  ConflictStrategy,
  ConflictResolution,
  SyncError,
  SyncErrorCode,
  SyncUser,
  SubscriptionStatus,
  AuthTokens,
} from './types.js';

// Zod schemas for validation
export { SyncChangeSchema, PushResultSchema, PullResultSchema } from './types.js';

// Queue
export type { SyncQueueStorage } from './queue.js';
export { SyncQueue, createSyncChangeId } from './queue.js';

// Client interface
export type { SyncClient, SyncClientConfig, NotePushPayload } from './client.js';

// Engine
export type { SyncStorage, SyncEngineConfig } from './engine.js';
export { SyncEngine } from './engine.js';

// Tree validation
export {
  validateNotebookTree,
  type TreeNode,
  type TreeValidationResult,
} from './treeValidation.js';
