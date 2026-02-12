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
  order: number;
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

/** A change record in the sync queue */
export interface SyncChange {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  data: unknown;
  timestamp: string;
  synced: boolean;
  retryCount: number;
  lastError: string | null;
}

/** Result of a push operation */
export interface PushResult {
  /** IDs of successfully synced entities */
  synced: string[];
  /** Conflicts that need resolution */
  conflicts: SyncConflict[];
  /** Errors that occurred */
  errors: SyncError[];
}

/** Result of a pull operation */
export interface PullResult {
  /** Entities that were updated locally */
  updated: string[];
  /** New cursor for next pull */
  cursor: string;
  /** Whether there are more changes to pull */
  hasMore: boolean;
}

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
// Zod Schemas (for validation)
// ============================================================================

export const SyncChangeSchema = z.object({
  id: z.string(),
  entityType: z.enum(['note', 'notebook', 'tag']),
  entityId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  data: z.unknown(),
  timestamp: z.string(),
  synced: z.boolean(),
  retryCount: z.number(),
  lastError: z.string().nullable(),
});

export const PushResultSchema = z.object({
  synced: z.array(z.string()),
  conflicts: z.array(
    z.object({
      entityType: z.enum(['note', 'notebook', 'tag']),
      entityId: z.string(),
      conflictType: z.enum(['update-update', 'delete-update', 'update-delete']),
      localVersion: z.unknown(),
      remoteVersion: z.unknown(),
      localUpdatedAt: z.string(),
      remoteUpdatedAt: z.string(),
    })
  ),
  errors: z.array(
    z.object({
      entityId: z.string(),
      entityType: z.enum(['note', 'notebook', 'tag']),
      message: z.string(),
      code: z.string(),
      retryable: z.boolean(),
    })
  ),
});

export const PullResultSchema = z.object({
  updated: z.array(z.string()),
  cursor: z.string(),
  hasMore: z.boolean(),
});
