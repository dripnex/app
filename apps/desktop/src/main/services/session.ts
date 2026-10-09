/**
 * Session resolution for auth:getSession.
 *
 * Tokens stay on disk unless the API says they are expired (401).
 * A network blip must not log the user out.
 * Leftover continue-locally identity is not a session — AuthGate requires
 * a consumed magic-link (JWT in TokenStorage).
 */

import { ApiError } from './apiClient.js';

export interface SessionUser {
  id: string;
  email: string;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 401;
}

/** Decode email/sub from a JWT for display only. Signature is not checked. */
export function userFromAccessToken(token: string): SessionUser | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      email?: unknown;
    };
    if (typeof json.sub !== 'string' || typeof json.email !== 'string') return null;
    if (!json.sub || !json.email.includes('@')) return null;
    return { id: json.sub, email: json.email };
  } catch {
    return null;
  }
}

export async function resolveSession(deps: {
  hasTokens: () => Promise<boolean>;
  getCurrentUser: () => Promise<SessionUser>;
  getAccessToken: () => Promise<string | null>;
  clearTokens: () => Promise<void>;
}): Promise<{ user: SessionUser } | null> {
  const hasTokens = await deps.hasTokens();
  if (!hasTokens) {
    return null;
  }

  try {
    return { user: await deps.getCurrentUser() };
  } catch (error) {
    if (isUnauthorizedError(error)) {
      await deps.clearTokens();
      return null;
    }

    const token = await deps.getAccessToken();
    const fromJwt = token ? userFromAccessToken(token) : null;
    return fromJwt ? { user: fromJwt } : null;
  }
}
