import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError, type FetchFn } from '../apiClient.js';
import type { TokenStorage } from '../tokenStorage.js';
import type { DeviceInfo } from '../deviceInfo.js';

const mockedFetch = vi.fn<FetchFn>();

function abortError(): Error {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('ApiClient timeouts', () => {
  const device: DeviceInfo = {
    deviceId: 'device-1',
    name: 'test',
    platform: 'darwin',
    createdAt: '2026-01-01',
  };

  let tokens: { accessToken: string; refreshToken: string } | null;
  let storage: TokenStorage;
  let client: ApiClient;

  beforeEach(() => {
    mockedFetch.mockReset();
    tokens = null;
    storage = {
      getTokens: vi.fn(async () => tokens),
      getRefreshToken: vi.fn(async () => tokens?.refreshToken ?? null),
      saveTokens: vi.fn(async (accessToken: string, refreshToken: string) => {
        tokens = { accessToken, refreshToken };
      }),
      clearTokens: vi.fn(async () => {
        tokens = null;
      }),
    } as unknown as TokenStorage;
    client = new ApiClient('https://api.example.test', storage, device, mockedFetch);
  });

  it('passes an AbortSignal on every request', async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ success: true, message: 'ok' }));

    await client.requestMagicLink('user@example.test');

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const init = mockedFetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps an aborted request to ApiError "Request timed out"', async () => {
    mockedFetch.mockRejectedValue(abortError());

    await expect(client.requestMagicLink('user@example.test')).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 0,
      message: 'Request timed out',
    } satisfies Partial<ApiError>);
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });

  it('treats a timed-out refresh as network, not expired', async () => {
    tokens = { accessToken: 'access', refreshToken: 'refresh' };
    mockedFetch.mockRejectedValue(abortError());

    const result = await client.refreshAccessToken();

    expect(result).toEqual({ type: 'network', message: 'Request timed out' });
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });

  it('does not treat an aborted refresh as expired when the caller retries auth', async () => {
    tokens = { accessToken: 'stale', refreshToken: 'refresh' };
    mockedFetch.mockResolvedValueOnce(jsonResponse({}, 401)).mockRejectedValueOnce(abortError());

    await expect(client.requestMagicLink('user@example.test')).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 0,
      message: 'Request timed out',
    });
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });
});
