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

// ============================================================================
// ApiClient Class
// ============================================================================

export class ApiClient {
  private baseURL: string;
  private tokenStorage: TokenStorage;
  private deviceInfo: DeviceInfo;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseURL: string, tokenStorage: TokenStorage, deviceInfo: DeviceInfo) {
    this.baseURL = baseURL;
    this.tokenStorage = tokenStorage;
    this.deviceInfo = deviceInfo;
  }

  // ==========================================================================
  // Core Request Method
  // ==========================================================================

  /**
   * Generic HTTP request with auth, retry, and error handling
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, retries = 3): Promise<T> {
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

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 - Token expired
      if (response.status === 401 && tokens) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          return this.request<T>(endpoint, options, 0);
        } else {
          // Refresh failed - clear tokens
          await this.tokenStorage.clearTokens();
          throw new ApiError(401, 'Session expired. Please sign in again.');
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

      // Parse JSON response
      return (await response.json()) as T;
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
  async refreshAccessToken(): Promise<boolean> {
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

  private async _refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await this.tokenStorage.getRefreshToken();
      if (!refreshToken) {
        return false;
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
        return false;
      }

      const data = (await response.json()) as AuthResponse;
      await this.tokenStorage.saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
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
      body: JSON.stringify({ email }),
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

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    return this.request<SyncStatus>('/sync/status');
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
