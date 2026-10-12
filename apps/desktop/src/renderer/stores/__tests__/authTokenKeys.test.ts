import { describe, expect, it } from 'vitest';
import {
  LEFTOVER_AUTH_STORAGE_KEYS,
  clearRendererAuthTokens,
  leftoverAuthKeys,
  looksLikeAuthTokenBlob,
} from '../authTokenKeys';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

describe('leftover auth token keys', () => {
  it('detects persist blobs with access and refresh tokens', () => {
    expect(looksLikeAuthTokenBlob(JSON.stringify({ accessToken: 'a', refreshToken: 'r' }))).toBe(
      true
    );
    expect(
      looksLikeAuthTokenBlob(
        JSON.stringify({ state: { accessToken: 'a', refreshToken: 'r' }, version: 0 })
      )
    ).toBe(true);
    expect(looksLikeAuthTokenBlob(JSON.stringify({ theme: 'dark' }))).toBe(false);
  });

  it('clears known leftover keys and token-shaped values', () => {
    const storage = memoryStorage({
      'dripnex-auth': JSON.stringify({ accessToken: 'a', refreshToken: 'r' }),
      'dripnex-settings': JSON.stringify({ appearance: {} }),
      other: JSON.stringify({ state: { accessToken: 'x', refreshToken: 'y' } }),
    });

    expect(leftoverAuthKeys(storage).sort()).toEqual(['dripnex-auth', 'other']);
    clearRendererAuthTokens(storage);
    expect(leftoverAuthKeys(storage)).toEqual([]);
    expect(storage.getItem('dripnex-settings')).toBeTruthy();
    for (const key of LEFTOVER_AUTH_STORAGE_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
  });
});
