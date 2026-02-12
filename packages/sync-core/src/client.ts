/**
 * Sync Client Interface
 *
 * Platform-agnostic interface for sync operations.
 * Implementations connect to the backend API.
 */

import type {
  SyncableNote,
  SyncableNotebook,
  PushResult,
  AuthTokens,
  SyncUser,
  ConflictResolution,
  DeviceId,
} from './types.js';

// Re-export for consumers
export type { SyncableNotebook };

/**
 * Payload for pushing notes to server.
 */
export interface NotePushPayload {
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
  localVersion: number;
}

/**
 * Payload for pushing notebooks to server.
 */
export interface NotebookPushPayload {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  order: number;
  createdAt: string;
  updatedAt: string;
  localVersion: number;
}

/**
 * Interface for sync API client.
 * Implementations handle HTTP requests to the sync server.
 */
export interface SyncClient {
  // =========================================================================
  // Auth
  // =========================================================================

  /**
   * Request magic link email.
   */
  requestMagicLink(email: string): Promise<void>;

  /**
   * Verify magic link token and get auth tokens.
   */
  verifyMagicLink(token: string): Promise<{
    tokens: AuthTokens;
    user: SyncUser;
  }>;

  /**
   * Refresh access token using refresh token.
   */
  refreshToken(refreshToken: string): Promise<AuthTokens>;

  /**
   * Get current user info.
   */
  getCurrentUser(): Promise<SyncUser>;

  /**
   * Logout (revoke tokens).
   */
  logout(): Promise<void>;

  // =========================================================================
  // Sync - Notes
  // =========================================================================

  /**
   * Push local note changes to server.
   */
  pushNotes(notes: NotePushPayload[], deviceId: DeviceId): Promise<PushResult>;

  /**
   * Pull note changes from server.
   */
  pullNotes(
    cursor: string | null,
    deviceId: DeviceId,
    limit?: number
  ): Promise<{
    notes: SyncableNote[];
    cursor: string;
    hasMore: boolean;
  }>;

  /**
   * Resolve a note conflict.
   */
  resolveNoteConflict(noteId: string, resolution: ConflictResolution): Promise<SyncableNote>;

  // =========================================================================
  // Sync - Notebooks
  // =========================================================================

  /**
   * Push local notebook changes to server.
   */
  pushNotebooks(notebooks: NotebookPushPayload[], deviceId: DeviceId): Promise<PushResult>;

  /**
   * Pull notebook changes from server.
   */
  pullNotebooks(
    cursor: string | null,
    deviceId: DeviceId,
    limit?: number
  ): Promise<{
    notebooks: SyncableNotebook[];
    cursor: string;
    hasMore: boolean;
  }>;

  // =========================================================================
  // Device Management
  // =========================================================================

  /**
   * Register this device for sync.
   */
  registerDevice(deviceInfo: {
    name: string;
    platform: string;
    version: string;
  }): Promise<DeviceId>;

  /**
   * List all registered devices.
   */
  listDevices(): Promise<
    Array<{
      id: DeviceId;
      name: string;
      platform: string;
      lastSeenAt: string;
      isCurrentDevice: boolean;
    }>
  >;

  /**
   * Revoke a device's access.
   */
  revokeDevice(deviceId: DeviceId): Promise<void>;
}

/**
 * Configuration for sync client.
 */
export interface SyncClientConfig {
  /** Base URL for sync API */
  baseUrl: string;
  /** Get current access token */
  getAccessToken: () => Promise<string | null>;
  /** Called when token needs refresh */
  onTokenRefresh?: (tokens: AuthTokens) => Promise<void>;
  /** Called when auth fails (e.g., redirect to login) */
  onAuthError?: () => void;
  /** Request timeout in ms */
  timeout?: number;
}
