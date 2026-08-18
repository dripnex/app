/**
 * Sync Core Types
 *
 * Core types for the sync system. Platform-agnostic, pure TypeScript.
 */

import { z } from 'zod';

// ============================================================================
// Branded Types
// ============================================================================

/** Unique device identifier */
export type DeviceId = string & { readonly __brand: 'DeviceId' };

/** Sync version number (monotonically increasing per entity) */
export type SyncVersion = number;

/** User ID from auth system */
export type UserId = string & { readonly __brand: 'UserId' };

// ============================================================================
// Sync Status
// ============================================================================

/** Overall sync status for UI display */
export type SyncStatus =
  | { status: 'disabled' }
  | { status: 'idle'; lastSyncedAt: string | null }
  | { status: 'syncing'; progress: number }
  | { status: 'error'; message: string; lastSyncedAt: string | null }
  | { status: 'conflict'; conflicts: SyncConflict[] };

/** Connection status */
export type ConnectionStatus = 'online' | 'offline' | 'connecting';

// ============================================================================
// Syncable Entities
// ============================================================================

/** Base fields required for sync on any entity */
export interface SyncableFields {
  /** Device that last modified this entity */
  deviceId: DeviceId | null;
  /** Sync version (increments on each remote update) */
  syncVersion: SyncVersion;
  /** Last time this entity was synced with server */
  lastSyncedAt: string | null;
}

/** A note with sync metadata */
export interface SyncableNote extends SyncableFields {
  id: string;
  title: string;
  content: string;
  notebookId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  isPinned: boolean;
  isDeleted: boolean;
  status: string;
  wordCount: number;
}

/** A notebook with sync metadata */
export interface SyncableNotebook extends SyncableFields {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Sync Operations
// ============================================================================

/** Type of entity being synced */
export type EntityType = 'note' | 'notebook' | 'tag';

/** Type of sync operation */
export type SyncOperation = 'create' | 'update' | 'delete';

// ============================================================================
// Conflicts
// ============================================================================

/** Type of conflict */
export type ConflictType = 'update-update' | 'delete-update' | 'update-delete';

/** A sync conflict requiring resolution */
export interface SyncConflict {
  entityType: EntityType;
  entityId: string;
  conflictType: ConflictType;
  localVersion: unknown;
  remoteVersion: unknown;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
}

/** Strategy for resolving conflicts */
export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'latest-wins' | 'manual';

/** Resolution for a conflict */
export interface ConflictResolution {
  entityId: string;
  strategy: ConflictStrategy;
  /** If manual, the resolved data */
  resolvedData?: unknown;
}

// ============================================================================
// Errors
// ============================================================================

/** A sync error */
export interface SyncError {
  entityId: string;
  entityType: EntityType;
  message: string;
  code: SyncErrorCode;
  retryable: boolean;
}

/** Error codes for sync operations */
export type SyncErrorCode =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

// ============================================================================
// Auth
// ============================================================================

/** User info from auth */
export interface SyncUser {
  id: UserId;
  email: string;
  createdAt: string;
  /** Subscription status */
  subscription: SubscriptionStatus;
}

/** Subscription status */
export interface SubscriptionStatus {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive';
  plan: 'free' | 'pro';
  /** For trialing: when trial ends */
  trialEndsAt?: string;
  /** For active: when subscription renews/ends */
  currentPeriodEnd?: string;
}

/** Auth tokens */
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

// ============================================================================
// Zod Schemas — live wire contracts
// ============================================================================

export const NoteOperationSchema = z.enum(['create', 'update', 'delete']);

/** Renderer → main. Content is still plaintext. */
export const LocalNotePushSchema = z.object({
  noteId: z.string().min(1).max(128),
  operation: NoteOperationSchema,
  content: z
    .string()
    .max(10 * 1024 * 1024)
    .optional(),
  localVersion: z.number().int().nonnegative().optional(),
});

/** Main → API. Content is already encrypted. */
export const EncryptedNotePushSchema = z.object({
  noteId: z.string().min(1).max(128),
  operation: NoteOperationSchema,
  encryptedData: z.string().nullable().optional(),
  localVersion: z.number().int().optional(),
});

export const EncryptedNotePushRequestSchema = z.object({
  changes: z.array(EncryptedNotePushSchema).min(1).max(100),
  deviceId: z.string().uuid(),
});

/** API → client pull item. */
export const RemoteNoteChangeSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  version: z.number().int(),
  operation: NoteOperationSchema,
  encryptedData: z.string().nullable(),
  deviceId: z.string(),
  createdAt: z.string(),
});

export const NotePushResultSchema = z.object({
  noteId: z.string(),
  version: z.number().int(),
  status: z.enum(['applied', 'conflict']),
  serverVersion: z.number().int().optional(),
});

export const NotePushResponseSchema = z.object({
  results: z.array(NotePushResultSchema),
  cursor: z.number().int(),
});

export const NotePullResponseSchema = z.object({
  changes: z.array(RemoteNoteChangeSchema),
  cursor: z.number().int(),
  hasMore: z.boolean(),
});

export type LocalNotePush = z.infer<typeof LocalNotePushSchema>;
export type EncryptedNotePush = z.infer<typeof EncryptedNotePushSchema>;
export type EncryptedNotePushRequest = z.infer<typeof EncryptedNotePushRequestSchema>;
export type RemoteNoteChange = z.infer<typeof RemoteNoteChangeSchema>;
export type NotePushResult = z.infer<typeof NotePushResultSchema>;
export type NotePushResponse = z.infer<typeof NotePushResponseSchema>;
export type NotePullResponse = z.infer<typeof NotePullResponseSchema>;
