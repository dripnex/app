import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../apiClient.js';
import { resolveSession, userFromAccessToken } from '../session.js';

function jwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `hdr.${body}.sig`;
}

describe('userFromAccessToken', () => {
  it('reads sub and email from the payload', () => {
    expect(userFromAccessToken(jwt({ sub: 'u1', email: 'a@b.com' }))).toEqual({
      id: 'u1',
      email: 'a@b.com',
    });
  });

  it('rejects junk', () => {
    expect(userFromAccessToken('not-a-jwt')).toBeNull();
    expect(userFromAccessToken(jwt({ email: 'a@b.com' }))).toBeNull();
  });
});

describe('resolveSession', () => {
  const user = { id: 'u1', email: 'a@b.com' };

  it('returns the cloud user when /auth/me works', async () => {
    const session = await resolveSession({
      hasTokens: async () => true,
      getCurrentUser: async () => user,
      getAccessToken: async () => jwt({ sub: user.id, email: user.email }),
      clearTokens: vi.fn(),
      readLocal: async () => null,
    });
    expect(session).toEqual({ user });
  });

  it('keeps tokens and the JWT user when the API is unreachable', async () => {
    const clearTokens = vi.fn();
    const session = await resolveSession({
      hasTokens: async () => true,
      getCurrentUser: async () => {
        throw new ApiError(0, 'Network error');
      },
      getAccessToken: async () => jwt({ sub: user.id, email: user.email }),
      clearTokens,
      readLocal: async () => null,
    });
    expect(session).toEqual({ user });
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it('clears tokens only on 401', async () => {
    const clearTokens = vi.fn();
    const session = await resolveSession({
      hasTokens: async () => true,
      getCurrentUser: async () => {
        throw new ApiError(401, 'Session expired');
      },
      getAccessToken: async () => jwt({ sub: user.id, email: user.email }),
      clearTokens,
      readLocal: async () => null,
    });
    expect(session).toBeNull();
    expect(clearTokens).toHaveBeenCalledOnce();
  });

  it('falls back to local identity when there are no tokens', async () => {
    const local = { id: 'local', email: 'me@local' };
    const session = await resolveSession({
      hasTokens: async () => false,
      getCurrentUser: async () => user,
      getAccessToken: async () => null,
      clearTokens: vi.fn(),
      readLocal: async () => local,
    });
    expect(session).toEqual({ user: local });
  });
});
