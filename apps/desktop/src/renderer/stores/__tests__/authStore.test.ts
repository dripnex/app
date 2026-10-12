import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leftoverAuthKeys } from '../authTokenKeys';
import { applySignedOut, useAuthStore } from '../authStore';
import { resolveAppShell } from '../../utils/appShell';

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

function signedInShell(isAuthenticated: boolean, sessionHydrated = true) {
  return resolveAppShell({
    onboardingComplete: true,
    isAuthenticated,
    sessionHydrated,
  });
}

describe('authStore sign-out and magic-link request', () => {
  const user = { id: 'u1', email: 'tomas@dripnex.app' };
  let storage: Storage;
  let auth: {
    requestMagicLink: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    verifyToken: ReturnType<typeof vi.fn>;
    continueLocally: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storage = memoryStorage();
    auth = {
      requestMagicLink: vi.fn(async () => ({ success: true })),
      logout: vi.fn(async () => ({ success: true })),
      getSession: vi.fn(async () => null),
      verifyToken: vi.fn(async () => ({ success: true, user })),
      continueLocally: vi.fn(async () => ({ success: true, user })),
    };
    vi.stubGlobal('window', {
      localStorage: storage,
      dripnex: {
        auth,
        sync: {
          stopAutoSync: vi.fn(async () => ({ success: true })),
          startAutoSync: vi.fn(async () => ({ success: true })),
        },
        license: { getState: vi.fn(async () => ({ status: 'free' })) },
        encryption: { isReady: vi.fn(async () => ({ ready: false })) },
      },
    });
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionHydrated: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sign-out clears leftover token keys and leaves an unauthenticated shell', async () => {
    storage.setItem('dripnex-auth', JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
    storage.setItem(
      'auth-storage',
      JSON.stringify({ state: { accessToken: 'a', refreshToken: 'r' } })
    );
    useAuthStore.setState({
      user,
      isAuthenticated: true,
      sessionHydrated: true,
      isLoading: false,
      error: null,
    });
    expect(signedInShell(true)).toBe('workspace');

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.sessionHydrated).toBe(true);
    expect(leftoverAuthKeys(storage)).toEqual([]);
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(signedInShell(state.isAuthenticated, state.sessionHydrated)).toBe('auth');
  });

  it('applySignedOut from another window also empties leftover token keys', () => {
    storage.setItem(
      'dripnex-auth-storage',
      JSON.stringify({ accessToken: 'a', refreshToken: 'r' })
    );
    useAuthStore.setState({
      user,
      isAuthenticated: true,
      sessionHydrated: true,
    });

    applySignedOut();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(leftoverAuthKeys(storage)).toEqual([]);
    expect(signedInShell(false)).toBe('auth');
  });

  it('requesting a magic link does not set authenticated', async () => {
    await useAuthStore.getState().requestMagicLink('tomas@dripnex.app');

    const state = useAuthStore.getState();
    expect(auth.requestMagicLink).toHaveBeenCalledWith('tomas@dripnex.app');
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(leftoverAuthKeys(storage)).toEqual([]);
    expect(signedInShell(state.isAuthenticated, true)).toBe('auth');
  });

  it('does not restore a session from an in-flight getSession after sign-out', async () => {
    let resolveSession!: (value: { user: typeof user } | null) => void;
    auth.getSession.mockReturnValue(
      new Promise(resolve => {
        resolveSession = resolve;
      })
    );

    useAuthStore.setState({
      user,
      isAuthenticated: true,
      sessionHydrated: true,
    });

    const pending = useAuthStore.getState().loadSession();
    await useAuthStore.getState().logout();
    resolveSession({ user });
    await pending;

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(signedInShell(false)).toBe('auth');
  });

  it('does not restore a session from an in-flight verifyToken after sign-out', async () => {
    let resolveVerify!: (value: { success: boolean; user: typeof user }) => void;
    auth.verifyToken.mockReturnValue(
      new Promise(resolve => {
        resolveVerify = resolve;
      })
    );

    storage.setItem('dripnex-auth', JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
    useAuthStore.setState({
      user,
      isAuthenticated: true,
      sessionHydrated: true,
    });

    const pending = useAuthStore.getState().verifyToken('magic-link-token');
    await useAuthStore.getState().logout();
    resolveVerify({ success: true, user });
    await pending;

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(leftoverAuthKeys(storage)).toEqual([]);
    expect(signedInShell(state.isAuthenticated, state.sessionHydrated)).toBe('auth');
  });
});
