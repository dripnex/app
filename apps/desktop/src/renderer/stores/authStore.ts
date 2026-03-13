import { create } from 'zustand';

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
  /** Error message from last operation */
  error: string | null;

  // Actions
  requestMagicLink: (email: string) => Promise<void>;
  verifyToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAuthStore = create<AuthState>()(set => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Actions

  /**
   * Request a magic link email
   */
  requestMagicLink: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.readied.auth.requestMagicLink(email);
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
   * Verify magic link token and authenticate
   */
  verifyToken: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.readied.auth.verifyToken(token);
      if (result.success && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        });

        // Start auto-sync after successful authentication
        await window.readied.sync.startAutoSync(5 * 60 * 1000); // 5 minutes
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
   * Logout and clear tokens
   */
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      // Stop auto-sync before logout
      await window.readied.sync.stopAutoSync();

      await window.readied.auth.logout();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      set({
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
    set({ isLoading: true, error: null });
    try {
      const session = await window.readied.auth.getSession();
      if (session) {
        set({
          user: session.user,
          isAuthenticated: true,
          isLoading: false,
        });

        // Start auto-sync if session exists
        await window.readied.sync.startAutoSync(5 * 60 * 1000); // 5 minutes
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load session',
      });
    }
  },

  /**
   * Clear error message
   */
  clearError: () => set({ error: null }),
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
export const selectEmail = (state: AuthState) => state.user?.email ?? null;
