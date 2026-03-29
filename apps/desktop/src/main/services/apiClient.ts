/**
 * API Client Service
 *
 * Centralized HTTP client for communicating with the Readied backend API.
 * Handles authentication, token refresh, retry logic, and error handling.
 *
 * @module ApiClient
 */

import fetch from 'cross-fetch';
import type { TokenStorage } from './tokenStorage.js';
import type { DeviceInfo } from './deviceInfo.js';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SyncChange {
  id: string;
  noteId: string;
  version: number;
  operation: 'create' | 'update' | 'delete';
  encryptedData: string | null;
  deviceId: string;
  createdAt: string;
}

export interface PullResponse {
  changes: SyncChange[];
  cursor: number;
  hasMore: boolean;
}

export interface PushResult {
  noteId: string;
  version: number;
  status: 'applied' | 'conflict';
  serverVersion?: number;
}

export interface PushResponse {
  results: PushResult[];
  cursor: number;
}

export interface TagSyncChange {
  id: string;
  tagId: string;
  version: number;
  operation: 'create' | 'update' | 'delete';
  data: string | null; // JSON: { name, color }
  deviceId: string;
  createdAt: string;
}

export interface NotebookSyncChange {
  id: string;
  notebookId: string;
  version: number;
  operation: 'create' | 'update' | 'delete';
  data: string | null;
  deviceId: string;
  createdAt: string;
}

export interface TagPullResponse {
  changes: TagSyncChange[];
  cursor: number;
  hasMore: boolean;
}

export interface NotebookPullResponse {
  changes: NotebookSyncChange[];
  cursor: number;
  hasMore: boolean;
}

export interface TagPushResult {
  tagId: string;
  version: number;
  status: 'applied' | 'conflict';
  serverVersion?: number;
}

export interface NotebookPushResult {
  notebookId: string;
  version: number;
  status: 'applied' | 'conflict';
  serverVersion?: number;
}

export interface TagPushResponse {
  results: TagPushResult[];
  cursor: number;
}

export interface NotebookPushResponse {
  results: NotebookPushResult[];
  cursor: number;
}

export interface SyncStatus {
  enabled: boolean;
  plan: string;
  cursor: number;
  totalChanges: number;
}

export interface SubscriptionStatus {
  plan: string;
  status: string;
  syncEnabled: boolean;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  canceledAt?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd?: boolean;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RefreshErrorType = 'success' | 'expired' | 'network' | 'device_limit' | 'unknown';

export interface RefreshResult {
  type: RefreshErrorType;
  message?: string;
}

// ============================================================================
// ApiClient Class
// ============================================================================

export class ApiClient {
  private baseURL: string;
  private tokenStorage: TokenStorage;
  private deviceInfo: DeviceInfo;
  private isRefreshing = false;
  private refreshPromise: Promise<RefreshResult> | null = null;
  private _bytesSent = 0;
  private _bytesReceived = 0;

  constructor(baseURL: string, tokenStorage: TokenStorage, deviceInfo: DeviceInfo) {
    this.baseURL = baseURL;
    this.tokenStorage = tokenStorage;
    this.deviceInfo = deviceInfo;
  }

  // ==========================================================================
  // Bandwidth Tracking
  // ==========================================================================

  resetBandwidthCounters(): void {
    this._bytesSent = 0;
    this._bytesReceived = 0;
  }

  getBandwidth(): { bytesSent: number; bytesReceived: number } {
    return { bytesSent: this._bytesSent, bytesReceived: this._bytesReceived };
  }

  // ==========================================================================
  // Core Request Method
  // ==========================================================================

  /**
   * Generic HTTP request with auth, retry, and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 3,
    _isAuthRetry = false
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // Inject access token if available
    const tokens = await this.tokenStorage.getTokens();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    // Track request body size
    if (options.body && typeof options.body === 'string') {
      this._bytesSent += Buffer.byteLength(options.body, 'utf8');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 - Token expired
      if (response.status === 401 && tokens && !_isAuthRetry) {
        const refreshResult = await this.refreshAccessToken();
        switch (refreshResult.type) {
          case 'success':
            return this.request<T>(endpoint, options, 0, true);
          case 'network':
            // Transient failure — throw retryable error so caller can try later
            throw new ApiError(0, refreshResult.message ?? 'Network error during token refresh');
          case 'device_limit':
            throw new ApiError(
              403,
              refreshResult.message ??
                'Device limit exceeded. Please remove a device and try again.'
            );
          case 'expired':
            await this.tokenStorage.clearTokens();
            throw new ApiError(
              401,
              refreshResult.message ?? 'Session expired. Please sign in again.'
            );
          default:
            throw new ApiError(0, refreshResult.message ?? 'Transient error during token refresh');
        }
      }

      // Handle non-OK responses
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          errorBody.error || errorBody.message || 'Request failed',
          errorBody
        );
      }

      // Parse JSON response and track bandwidth
      const json = await response.json();
      const responseText = JSON.stringify(json);
      this._bytesReceived += Buffer.byteLength(responseText, 'utf8');
      return json as T;
    } catch (error) {
      // Network error or fetch failure
      if (error instanceof ApiError) {
        throw error;
      }

      // Retry on network errors (5xx) with exponential backoff
      if (retries > 0 && this.isRetryableError(error)) {
        await this.delay(Math.pow(2, 3 - retries) * 1000); // 1s, 2s, 4s
        return this.request<T>(endpoint, options, retries - 1);
      }

      throw new ApiError(0, error instanceof Error ? error.message : 'Network error');
    }
  }

  /**
   * Refreshes the access token using the refresh token
   */
  async refreshAccessToken(): Promise<RefreshResult> {
    // Prevent concurrent refresh requests
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._refreshAccessToken();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async _refreshAccessToken(): Promise<RefreshResult> {
    try {
      const refreshToken = await this.tokenStorage.getRefreshToken();
      if (!refreshToken) {
        return { type: 'expired', message: 'No refresh token available' };
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken,
          deviceId: this.deviceInfo.deviceId,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const serverMessage =
          (errorBody as Record<string, string>).error ??
          (errorBody as Record<string, string>).message ??
          'Token refresh failed';

        if (response.status === 401 || response.status === 403) {
          // Check for device limit (e.g. 403 with specific error code)
          if (
            response.status === 403 &&
            ((errorBody as Record<string, string>).code === 'DEVICE_LIMIT' ||
              serverMessage.toLowerCase().includes('device limit'))
          ) {
            console.error('[ApiClient] Token refresh failed: device limit exceeded', {
              status: response.status,
              serverMessage,
            });
            return { type: 'device_limit', message: serverMessage };
          }
          // Refresh token expired or revoked — user must re-login
          console.error('[ApiClient] Token refresh failed: token expired/revoked', {
            status: response.status,
            serverMessage,
          });
          return { type: 'expired', message: serverMessage };
        }

        if (response.status >= 500) {
          console.error('[ApiClient] Token refresh failed: server error', {
            status: response.status,
            serverMessage,
          });
          return { type: 'network', message: serverMessage };
        }

        console.error('[ApiClient] Token refresh failed: unexpected status', {
          status: response.status,
          serverMessage,
        });
        return { type: 'unknown', message: serverMessage };
      }

      const data = (await response.json()) as AuthResponse;
      await this.tokenStorage.saveTokens(data.accessToken, data.refreshToken);
      return { type: 'success' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown network error';
      console.error('[ApiClient] Token refresh failed: network error', { message });
      return { type: 'network', message };
    }
  }

  // ==========================================================================
  // Auth Endpoints
  // ==========================================================================

  /**
   * Request a magic link email
   */
  async requestMagicLink(email: string): Promise<void> {
    await this.request<{ success: boolean; message: string }>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email, client: 'desktop' }),
    });
  }

  /**
   * Verify magic link token and get JWT tokens
   */
  async verifyMagicLink(token: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({
        token,
        deviceId: this.deviceInfo.deviceId,
        deviceName: this.deviceInfo.name,
        platform: this.deviceInfo.platform,
      }),
    });
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ user: User }>('/auth/me');
    return response.user;
  }

  // ==========================================================================
  // Sync Endpoints
  // ==========================================================================

  /**
   * Pull changes from server
   */
  async pullChanges(cursor: number, limit = 50): Promise<PullResponse> {
    const params = new URLSearchParams({
      cursor: cursor.toString(),
      limit: limit.toString(),
    });
    return this.request<PullResponse>(`/sync?${params}`);
  }

  /**
   * Push local changes to server
   */
  async pushChanges(
    changes: Array<{
      noteId: string;
      operation: 'create' | 'update' | 'delete';
      encryptedData?: string | null;
      localVersion?: number;
    }>
  ): Promise<PushResponse> {
    return this.request<PushResponse>('/sync', {
      method: 'POST',
      body: JSON.stringify({
        changes,
        deviceId: this.deviceInfo.deviceId,
      }),
    });
  }

  // ==========================================================================
  // Notebook Sync
  // ==========================================================================

  async pullNotebookChanges(cursor: number, limit = 50): Promise<NotebookPullResponse> {
    const params = new URLSearchParams({
      cursor: cursor.toString(),
      limit: limit.toString(),
    });
    return this.request<NotebookPullResponse>(`/sync/notebooks?${params}`);
  }

  async pushNotebookChanges(
    changes: Array<{
      notebookId: string;
      operation: 'create' | 'update' | 'delete';
      data?: string | null;
      localVersion?: number;
    }>
  ): Promise<NotebookPushResponse> {
    return this.request<NotebookPushResponse>('/sync/notebooks', {
      method: 'POST',
      body: JSON.stringify({
        changes,
        deviceId: this.deviceInfo.deviceId,
      }),
    });
  }

  /**
   * Pull tag changes from server
   */
  async pullTagChanges(cursor: number, limit = 50): Promise<TagPullResponse> {
    const params = new URLSearchParams({
      cursor: cursor.toString(),
      limit: limit.toString(),
    });
    return this.request<TagPullResponse>(`/sync/tags?${params}`);
  }

  /**
   * Push tag changes to server
   */
  async pushTagChanges(
    changes: Array<{
      tagId: string;
      operation: 'create' | 'update' | 'delete';
      data?: string | null;
      localVersion?: number;
    }>
  ): Promise<TagPushResponse> {
    return this.request<TagPushResponse>('/sync/tags', {
      method: 'POST',
      body: JSON.stringify({
        changes,
        deviceId: this.deviceInfo.deviceId,
      }),
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    return this.request<SyncStatus>('/sync/status');
  }

  // ==========================================================================
  // E2EE Key Management
  // ==========================================================================

  /**
   * Get encryption keys from server (salt, wrappedCEK, kdfParams).
   * Returns { exists: false } if no keys have been set up yet.
   */
  async getEncryptionKeys(): Promise<{
    exists: boolean;
    salt?: string;
    wrappedCek?: string;
    wrappedCekRecovery?: string | null;
    kdfParams?: { algorithm: string; iterations: number; hash: string };
  }> {
    return this.request('/sync/keys');
  }

  /**
   * Store encryption keys on server (first device setup or passphrase change).
   */
  async setEncryptionKeys(data: {
    salt: string;
    wrappedCek: string;
    wrappedCekRecovery?: string | null;
    kdfParams: { algorithm: string; iterations: number; hash: string };
  }): Promise<{ success: boolean }> {
    return this.request('/sync/keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================================================
  // Subscription Endpoints
  // ==========================================================================

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return this.request<SubscriptionStatus>('/subscription/status');
  }

  /**
   * Create Stripe checkout session via API
   */
  async createCheckoutSession(options: {
    plan: 'monthly' | 'annual';
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{ url: string }> {
    return this.request<{ url: string }>('/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Create Stripe billing portal session
   */
  async createPortalSession(returnUrl: string): Promise<{ url: string }> {
    return this.request<{ url: string }>('/subscription/portal', {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    });
  }

  // ==========================================================================
  // Share Endpoints
  // ==========================================================================

  /**
   * Share a note on the web (create or update)
   */
  async shareNote(input: {
    noteId: string;
    title: string;
    content: string;
    tags?: string[];
    backlinks?: Array<{ noteId: string; title: string }>;
    wordCount?: number;
    notebookName?: string;
  }): Promise<{ slug: string; url: string }> {
    return this.request<{ slug: string; url: string }>('/share', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Remove a shared note
   */
  async unshareNote(slug: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/share/${slug}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Devices
  // ==========================================================================

  async listDevices(): Promise<{
    devices: Array<{
      id: string;
      deviceId: string;
      name: string | null;
      platform: string | null;
      isCurrent: boolean;
      lastSeenAt: string;
      createdAt: string;
    }>;
  }> {
    return this.request('/devices');
  }

  async renameDevice(deviceId: string, name: string): Promise<{ success: boolean }> {
    return this.request(`/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async revokeDevice(deviceId: string): Promise<{ success: boolean }> {
    return this.request(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  async revokeOtherDevices(): Promise<{ success: boolean; revokedCount: number }> {
    return this.request('/devices/revoke-others', {
      method: 'POST',
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private isRetryableError(error: unknown): boolean {
    // Retry on network errors
    if (error instanceof TypeError) {
      return true;
    }
    // Retry on 5xx server errors
    if (error instanceof ApiError && error.statusCode >= 500) {
      return true;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
