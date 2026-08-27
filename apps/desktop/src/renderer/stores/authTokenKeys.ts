/**
 * Renderer leftovers that must not skip AuthGate after Sign Out.
 *
 * Session JWTs live in main-process TokenStorage (`auth.encrypted`), not
 * localStorage. Older builds still wrote persist blobs here; Sign Out
 * deletes those keys so hydrating cannot see a session.
 */

export const LEFTOVER_AUTH_STORAGE_KEYS = [
  'dripnex-auth',
  'dripnex-auth-storage',
  'auth-storage',
] as const;

export function looksLikeAuthTokenBlob(raw: string): boolean {
  try {
    return hasAccessAndRefresh(JSON.parse(raw) as unknown);
  } catch {
    return false;
  }
}

function hasAccessAndRefresh(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  if (typeof rec.accessToken === 'string' && typeof rec.refreshToken === 'string') {
    return rec.accessToken.length > 0 || rec.refreshToken.length > 0;
  }
  if (rec.state && typeof rec.state === 'object') {
    return hasAccessAndRefresh(rec.state);
  }
  return false;
}

/** Drop known leftover keys and any localStorage value that still holds JWTs. */
export function clearRendererAuthTokens(storage: Storage): void {
  for (const key of LEFTOVER_AUTH_STORAGE_KEYS) {
    storage.removeItem(key);
  }

  const extra: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    const raw = storage.getItem(key);
    if (raw && looksLikeAuthTokenBlob(raw)) {
      extra.push(key);
    }
  }
  for (const key of extra) {
    storage.removeItem(key);
  }
}

export function leftoverAuthKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if ((LEFTOVER_AUTH_STORAGE_KEYS as readonly string[]).includes(key)) {
      keys.push(key);
      continue;
    }
    const raw = storage.getItem(key);
    if (raw && looksLikeAuthTokenBlob(raw)) {
      keys.push(key);
    }
  }
  return keys;
}
