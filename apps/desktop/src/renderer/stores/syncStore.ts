import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SyncStatus, SyncConflict, SyncUser } from '@readied/sync-core';

// ============================================================================
// Types
// ============================================================================

/** Auth state */
export type AuthState =
  | { status: 'logged_out' }
  | { status: 'logging_in' }
  | { status: 'logged_in'; user: SyncUser };

// ============================================================================
// Store Interface
// ============================================================================

interface SyncStore {
  // Auth State
  auth: AuthState;
  authToken: string | null;

  // Sync State
  syncStatus: SyncStatus;
  pendingChanges: number;
  lastSyncedAt: string | null;

  // UI State
  showLoginModal: boolean;
  showConflictModal: boolean;
  conflicts: SyncConflict[];

  // Auth Actions
  setAuthToken: (token: string | null) => void;
  setUser: (user: SyncUser | null) => void;
  startLogin: () => void;
  logout: () => void;

  // Sync Actions
  setSyncStatus: (status: SyncStatus) => void;
  setPendingChanges: (count: number) => void;
  setLastSyncedAt: (timestamp: string | null) => void;
  setConflicts: (conflicts: SyncConflict[]) => void;

  // UI Actions
  openLoginModal: () => void;
  closeLoginModal: () => void;
  openConflictModal: () => void;
  closeConflictModal: () => void;

  // Computed
  isLoggedIn: () => boolean;
  isSyncEnabled: () => boolean;
  canSync: () => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      // Initial State
      auth: { status: 'logged_out' },
      authToken: null,
      syncStatus: { status: 'disabled' },
      pendingChanges: 0,
      lastSyncedAt: null,
      showLoginModal: false,
      showConflictModal: false,
      conflicts: [],

      // Auth Actions
      setAuthToken: token => set({ authToken: token }),

      setUser: user =>
        set({
          auth: user ? { status: 'logged_in', user } : { status: 'logged_out' },
        }),

      startLogin: () => set({ auth: { status: 'logging_in' } }),

      logout: () =>
        set({
          auth: { status: 'logged_out' },
          authToken: null,
          syncStatus: { status: 'disabled' },
          pendingChanges: 0,
          conflicts: [],
        }),

      // Sync Actions
      setSyncStatus: status => {
        set({ syncStatus: status });
        if (status.status === 'idle' && status.lastSyncedAt) {
          set({ lastSyncedAt: status.lastSyncedAt });
        }
        if (status.status === 'conflict') {
          set({ conflicts: status.conflicts, showConflictModal: true });
        }
      },

      setPendingChanges: count => set({ pendingChanges: count }),

      setLastSyncedAt: timestamp => set({ lastSyncedAt: timestamp }),

      setConflicts: conflicts => set({ conflicts }),

      // UI Actions
      openLoginModal: () => set({ showLoginModal: true }),
      closeLoginModal: () => set({ showLoginModal: false }),
      openConflictModal: () => set({ showConflictModal: true }),
      closeConflictModal: () => set({ showConflictModal: false }),

      // Computed
      isLoggedIn: () => get().auth.status === 'logged_in',

      isSyncEnabled: () => {
        const { auth, syncStatus } = get();
        return auth.status === 'logged_in' && syncStatus.status !== 'disabled';
      },

      canSync: () => {
        const { auth, syncStatus } = get();
        return (
          auth.status === 'logged_in' &&
          syncStatus.status !== 'disabled' &&
          syncStatus.status !== 'syncing'
        );
      },
    }),
    {
      name: 'readied-sync',
      // Only persist auth token and last synced time
      partialize: state => ({
        authToken: state.authToken,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

// ============================================================================
// Selectors (for performance)
// ============================================================================

export const selectSyncStatus = (state: SyncStore) => state.syncStatus;
export const selectAuth = (state: SyncStore) => state.auth;
export const selectPendingChanges = (state: SyncStore) => state.pendingChanges;
export const selectConflicts = (state: SyncStore) => state.conflicts;
