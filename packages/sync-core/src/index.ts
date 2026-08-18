/**
 * @dripnex/sync-core
 *
 * Shared contracts + notebook tree validation.
 * Live sync is desktop `SyncService`. Do not add an engine here.
 */

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

export { SyncChangeSchema, PushResultSchema, PullResultSchema } from './types.js';

export {
  validateNotebookTree,
  type TreeNode,
  type TreeValidationResult,
} from './treeValidation.js';
