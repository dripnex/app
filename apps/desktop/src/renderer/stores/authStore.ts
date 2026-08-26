import { create } from 'zustand';
import { clearRendererAuthTokens } from './authTokenKeys';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
}

// ============================================================================
// Store Interface
// ============================================================================

interface AuthState {
  /** Current authenticated user */
  user: User | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Loading state for async operations */
  isLoading: boolean;
  /** True after the first getSession() attempt finishes. */
  sessionHydrated: boolean;
  /** Error message from last operation */
  error: string | null;

  // Actions
  requestMagicLink: (email: string) => Promise<void>;
  continueLocally: (email: string) => Promise<void>;
  verifyToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Signed-out reset
// ============================================================================

/** Bumped on Sign Out so an in-flight getSession cannot restore the shell. */
let sessionEpoch = 0;

function rendererStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAuthStore = create<AuthState>()(set => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  sessionHydrated: false,
  error: null,

  // Actions

  /**
   * Request a magic link email
   */
  requestMagicLink: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.dripnex.auth.requestMagicLink(email);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send magic link');
      }
      set({ isLoading: false });
    } catch (error) {
      let errorMessage = 'Failed to request magic link';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'No internet connection. Check your network and try again.';
        } else if (msg.includes('timeout')) {
          errorMessage = 'Connection timeout. Please try again.';
        } else if (msg.includes('rate limit')) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  /**
   * Create a local-only identity when the cloud API is unreachable.
   */
  continueLocally: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.dripnex.auth.continueLocally(email);
      if (!result.success || !result.user) {
        throw new Error(result.error || 'Failed to continue locally');
      }
      set({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to continue locally',
      });
      throw error;
    }
  },

  /**
   * Verify magic link token and authenticate
   */
  verifyToken: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.dripnex.auth.verifyToken(token);
      if (result.success && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        });

        await startCloudSyncIfReady();
      } else {
        throw new Error(result.error || 'Verification failed');
      }
    } catch (error) {
      let errorMessage = 'Failed to verify token';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('expired')) {
          errorMessage = 'This link has expired or is invalid. Please request a new one.';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'No internet connection. Check your network and try again.';
        } else if (msg.includes('timeout')) {
          errorMessage = 'Connection timeout. Please try again.';
        } else if (msg.includes('device limit')) {
          errorMessage = 'Device limit reached. Remove a device to continue.';
        } else {
          errorMessage = error.message;
        }
      }

      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  /**
   * Logout and clear tokens. Clears this window immediately so AuthGate
   * remounts even if Settings is a separate renderer from the main shell.
   */
  logout: async () => {
    applySignedOut();
    try {
      try {
        await window.dripnex.sync.stopAutoSync();
      } catch {
        // Sync may already be stopped; tokens still need to be cleared.
      }

      const result = await window.dripnex.auth.logout();
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to logout');
      }
    } catch (error) {
      useAuthStore.setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to logout',
      });
      throw error;
    }
  },

  /**
   * Load existing session on app start
   */
  loadSession: async () => {
    const epoch = sessionEpoch;
    set({ isLoading: true, error: null });
    try {
      const session = await window.dripnex.auth.getSession();
      if (epoch !== sessionEpoch) return;
      if (session) {
        set({
          user: session.user,
          isAuthenticated: true,
          isLoading: false,
          sessionHydrated: true,
        });

        await startCloudSyncIfReady();
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          sessionHydrated: true,
        });
      }
    } catch (error) {
      if (epoch !== sessionEpoch) return;
      set({
        isLoading: false,
        sessionHydrated: true,
        error: error instanceof Error ? error.message : 'Failed to load session',
      });
    }
  },

  /**
   * Clear error message
   */
  clearError: () => set({ error: null }),
}));

/**
 * Drop renderer session state and leftover token keys.
 * Main-process JWTs are cleared by `auth:logout`. Other windows hear `auth:signed-out`.
 */
export function applySignedOut(): void {
  sessionEpoch += 1;
  const storage = rendererStorage();
  if (storage) clearRendererAuthTokens(storage);
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    sessionHydrated: true,
  });
}

// ============================================================================
// Selectors
// ============================================================================

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectSessionHydrated = (state: AuthState) => state.sessionHydrated;
export const selectError = (state: AuthState) => state.error;
export const selectEmail = (state: AuthState) => state.user?.email ?? null;

export async function startCloudSyncIfReady(): Promise<void> {
  try {
    const [licenseState, encryption] = await Promise.all([
      window.dripnex.license.getState(),
      window.dripnex.encryption.isReady(),
    ]);
    const canSync =
      licenseState.status === 'trial' ||
      licenseState.status === 'pro_active' ||
      licenseState.status === 'pro_grace';
    if (canSync && encryption.ready) {
      await window.dripnex.sync.startAutoSync(5 * 60 * 1000);
    }
  } catch {
    // License or encryption check failed — don't start sync
  }
}
