/**
 * ApiClient Unit Tests
 *
 * Tests the HTTP client for sync operations with mocked fetch.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ApiClient, ApiError } from '../apiClient';
import type { TokenStorage } from '../tokenStorage';
import type { DeviceInfo } from '../deviceInfo';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('cross-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'cross-fetch';
const mockFetch = fetch as Mock;

function createMockTokenStorage() {
  return {
    getTokens: vi.fn(async () => ({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    })),
    getRefreshToken: vi.fn(async () => 'test-refresh-token'),
    saveTokens: vi.fn(async () => {}),
    clearTokens: vi.fn(async () => {}),
    hasTokens: vi.fn(async () => true),
    getAccessToken: vi.fn(async () => 'test-access-token'),
  } as unknown as TokenStorage;
}

function createMockDeviceInfo(): DeviceInfo {
  return {
    deviceId: 'test-device-uuid',
    name: 'Test MacBook',
    platform: 'darwin',
    createdAt: '2025-01-01T00:00:00Z',
  };
}

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => data),
  };
}

function createClient() {
  const tokenStorage = createMockTokenStorage();
  const deviceInfo = createMockDeviceInfo();
  const client = new ApiClient('https://api.readied.app', tokenStorage, deviceInfo);
  return { client, tokenStorage, deviceInfo };
}

// ============================================================================
// Tests
// ============================================================================

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pullChanges', () => {
    it('fetches note changes with cursor and limit', async () => {
      const { client } = createClient();
      const mockResponse = {
        changes: [
          {
            id: 'change_1',
            noteId: 'note_1',
            version: 1,
            operation: 'create',
            encryptedData: 'encrypted...',
            deviceId: 'device_1',
            createdAt: '2025-01-01T00:00:00Z',
          },
        ],
        cursor: 1,
        hasMore: false,
      };

      mockFetch.mockResolvedValue(mockJsonResponse(mockResponse));

      const result = await client.pullChanges(0, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.readied.app/sync?cursor=0&limit=50',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
      expect(result.changes).toHaveLength(1);
      expect(result.cursor).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('uses default limit of 50', async () => {
      const { client } = createClient();
      mockFetch.mockResolvedValue(
        mockJsonResponse({ changes: [], cursor: 0, hasMore: false })
      );

      await client.pullChanges(10);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.readied.app/sync?cursor=10&limit=50',
        expect.any(Object)
      );
    });
  });

  describe('pushChanges', () => {
    it('pushes encrypted changes to server', async () => {
      const { client } = createClient();
      const mockResponse = {
        results: [{ noteId: 'note_1', version: 5, status: 'applied' }],
        cursor: 5,
      };

      mockFetch.mockResolvedValue(mockJsonResponse(mockResponse));

      const changes = [
        {
          noteId: 'note_1',
          operation: 'update' as const,
          encryptedData: 'encrypted_content',
          localVersion: 3,
        },
      ];

      const result = await client.pushChanges(changes);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.readied.app/sync',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            changes,
            deviceId: 'test-device-uuid',
          }),
        })
      );
      expect(result.results[0]!.status).toBe('applied');
      expect(result.cursor).toBe(5);
    });

    it('handles conflict responses', async () => {
      const { client } = createClient();
      const mockResponse = {
        results: [
          { noteId: 'note_1', version: 5, status: 'conflict', serverVersion: 10 },
        ],
        cursor: 5,
      };

      mockFetch.mockResolvedValue(mockJsonResponse(mockResponse));

      const result = await client.pushChanges([
        { noteId: 'note_1', operation: 'update', encryptedData: 'data', localVersion: 3 },
      ]);

      expect(result.results[0]!.status).toBe('conflict');
      expect(result.results[0]!.serverVersion).toBe(10);
    });
  });

  describe('pullNotebookChanges', () => {
    it('fetches notebook changes with cursor', async () => {
      const { client } = createClient();
      const mockResponse = {
        changes: [
          {
            id: 'change_1',
            notebookId: 'nb_1',
            version: 1,
            operation: 'create',
            encryptedData: 'encrypted_nb_data',
            deviceId: 'device_1',
            createdAt: '2025-01-01T00:00:00Z',
          },
        ],
        cursor: 1,
        hasMore: false,
      };

      mockFetch.mockResolvedValue(mockJsonResponse(mockResponse));

      const result = await client.pullNotebookChanges(0, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.readied.app/sync/notebooks?cursor=0&limit=50',
        expect.any(Object)
      );
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]!.notebookId).toBe('nb_1');
    });
  });

  describe('pushNotebookChanges', () => {
    it('pushes notebook changes to server', async () => {
      const { client } = createClient();
      const mockResponse = {
        results: [{ notebookId: 'nb_1', version: 3, status: 'applied' }],
        cursor: 3,
      };

      mockFetch.mockResolvedValue(mockJsonResponse(mockResponse));

      const changes = [
        {
          notebookId: 'nb_1',
          operation: 'update' as const,
          encryptedData: 'encrypted_nb',
          localVersion: 2,
        },
      ];

      const result = await client.pushNotebookChanges(changes);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.readied.app/sync/notebooks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            changes,
            deviceId: 'test-device-uuid',
          }),
        })
      );
      expect(result.results[0]!.status).toBe('applied');
    });
  });

  describe('error handling', () => {
    it('throws ApiError on non-OK responses', async () => {
      const { client } = createClient();
      mockFetch.mockResolvedValue(
        mockJsonResponse({ error: 'Sync requires Pro subscription' }, 403)
      );

      await expect(client.pullChanges(0)).rejects.toThrow(ApiError);
      await expect(client.pullChanges(0)).rejects.toThrow('Sync requires Pro subscription');
    });

    it('retries on network errors', async () => {
      const { client } = createClient();
      // Make delay instant to avoid real timeouts
      vi.spyOn(client as never, 'delay' as never).mockResolvedValue(undefined as never);

      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValue(
          mockJsonResponse({ changes: [], cursor: 0, hasMore: false })
        );

      const result = await client.pullChanges(0);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.hasMore).toBe(false);
    });

    it('gives up after max retries', async () => {
      const { client } = createClient();
      // Make delay instant to avoid real timeouts
      vi.spyOn(client as never, 'delay' as never).mockResolvedValue(undefined as never);

      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.pullChanges(0)).rejects.toThrow(ApiError);
      // 1 initial + 3 retries = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('token refresh', () => {
    it('refreshes token on 401 and retries', async () => {
      const { client, tokenStorage } = createClient();

      // First call returns 401
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: 'Unauthorized' }, 401));

      // Refresh token call succeeds
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          user: { id: 'user_1', email: 'test@test.com' },
        })
      );

      // Retry with new token succeeds
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ changes: [], cursor: 0, hasMore: false })
      );

      const result = await client.pullChanges(0);

      expect(tokenStorage.saveTokens).toHaveBeenCalledWith(
        'new-access-token',
        'new-refresh-token'
      );
      expect(result.hasMore).toBe(false);
    });

    it('clears tokens when refresh fails', async () => {
      const { client, tokenStorage } = createClient();

      // First call returns 401
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: 'Unauthorized' }, 401));

      // Refresh token call fails
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: 'Invalid token' }, 401));

      await expect(client.pullChanges(0)).rejects.toThrow('Session expired');
      expect(tokenStorage.clearTokens).toHaveBeenCalled();
    });
  });

  describe('getSyncStatus', () => {
    it('returns sync status', async () => {
      const { client } = createClient();
      const mockStatus = {
        enabled: true,
        plan: 'pro',
        cursor: 42,
        totalChanges: 100,
      };

      mockFetch.mockResolvedValue(mockJsonResponse(mockStatus));

      const status = await client.getSyncStatus();

      expect(status.enabled).toBe(true);
      expect(status.plan).toBe('pro');
      expect(status.cursor).toBe(42);
    });
  });

  describe('auth endpoints', () => {
    it('requests magic link', async () => {
      const { client } = createClient();
      mockFetch.mockResolvedValue(
        mockJsonResponse({ success: true, message: 'Email sent' })
      );

      await client.requestMagicLink('user@example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.readied.app/auth/magic-link',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@example.com' }),
        })
      );
    });

    it('verifies magic link with device info', async () => {
      const { client } = createClient();
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          user: { id: 'user_1', email: 'user@example.com' },
          accessToken: 'token',
          refreshToken: 'refresh',
        })
      );

      const result = await client.verifyMagicLink('magic-token-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.readied.app/auth/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            token: 'magic-token-123',
            deviceId: 'test-device-uuid',
            deviceName: 'Test MacBook',
            platform: 'darwin',
          }),
        })
      );
      expect(result.user.email).toBe('user@example.com');
    });
  });
});
