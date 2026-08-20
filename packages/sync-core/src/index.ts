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
  LocalNotePush,
  EncryptedNotePush,
  EncryptedNotePushRequest,
  RemoteNoteChange,
  NotePushResult,
  NotePushResponse,
  NotePullResponse,
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

export {
  NoteOperationSchema,
  LocalNotePushSchema,
  EncryptedNotePushSchema,
  EncryptedNotePushRequestSchema,
  RemoteNoteChangeSchema,
  NotePushResultSchema,
  NotePushResponseSchema,
  NotePullResponseSchema,
} from './types.js';

export {
  validateNotebookTree,
  type TreeNode,
  type TreeValidationResult,
} from './treeValidation.js';
