import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface Conflict {
  noteId: string;
  localContent: string;
  remoteContent: string;
  localVersion: number;
  remoteVersion: number;
  timestamp: string;
}

// ============================================================================
// Store Interface
// ============================================================================

interface SyncState {
  /** Current sync status */
  status: SyncStatus;
  /** Server cursor position */
  cursor: number;
  /** Last successful sync timestamp (epoch ms) */
  lastSyncAt: number | null;
  /** Pending conflicts */
  conflicts: Conflict[];
  /** Error message from last sync */
  error: string | null;
  /** Whether sync is enabled (Pro feature) */
  isEnabled: boolean;

  // Actions
  syncNow: () => Promise<void>;
  resolveConflict: (noteId: string, resolution: 'local' | 'remote') => Promise<void>;
  clearError: () => void;
  setEnabled: (enabled: boolean) => void;
  updateLastSyncAt: (timestamp: number) => void;
  initNetworkListeners: () => () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSyncStore = create<SyncState>()((set, get) => ({
  // Initial state
  status: 'idle',
  cursor: 0,
  lastSyncAt: null,
  conflicts: [],
  error: null,
  isEnabled: false,

  // Actions

  /**
   * Trigger manual sync (full cycle: pull + push)
   */
  syncNow: async () => {
    const currentStatus = get().status;
    if (currentStatus === 'syncing') {
      return; // Already syncing
    }

    set({ status: 'syncing', error: null });
    try {
      // Perform full sync cycle
      const syncResult = await window.readied.sync.syncNow();

      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Sync failed');
      }

      // Get updated status from server
      const statusResult = await window.readied.sync.status();

      // Update state with results
      set({
        status: 'idle',
        cursor: statusResult.cursor || 0,
        conflicts: syncResult.conflicts || [],
        lastSyncAt: Date.now(),
      });
    } catch (error) {
      let errorMessage = 'Sync failed';
      let status: SyncStatus = 'error';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('enotfound')) {
          errorMessage = 'No internet connection. Sync will resume when online.';
          status = 'offline';
        } else if (msg.includes('timeout')) {
          errorMessage = 'Connection timeout. Please try again.';
        } else if (msg.includes('unauthorized') || msg.includes('401')) {
          errorMessage = 'Session expired. Please sign in again.';
        } else if (msg.includes('forbidden') || msg.includes('403')) {
          errorMessage = 'Sync requires Pro subscription.';
        } else if (msg.includes('rate limit') || msg.includes('429')) {
          errorMessage = 'Too many requests. Please wait a moment.';
        } else if (msg.includes('500') || msg.includes('server')) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }

      set({ status, error: errorMessage });
      throw error;
    }
  },

  /**
   * Resolve a sync conflict
   */
  resolveConflict: async (noteId: string, resolution: 'local' | 'remote') => {
    try {
      await window.readied.sync.resolveConflict(noteId, resolution);

      // Remove resolved conflict
      set(state => ({
        conflicts: state.conflicts.filter(c => c.noteId !== noteId),
      }));
    } catch (error) {
      let errorMessage = 'Failed to resolve conflict';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'No internet connection. Try again when online.';
        } else if (msg.includes('not found')) {
          errorMessage = 'Note not found. It may have been deleted.';
          // Remove the conflict since the note doesn't exist
          set(state => ({
            conflicts: state.conflicts.filter(c => c.noteId !== noteId),
          }));
        } else {
          errorMessage = error.message;
        }
      }

      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * Clear error message
   */
  clearError: () => set({ error: null }),

  /**
   * Set whether sync is enabled (Pro feature)
   */
  setEnabled: (enabled: boolean) => set({ isEnabled: enabled }),

  /**
   * Update last sync timestamp
   */
  updateLastSyncAt: (timestamp: number) => set({ lastSyncAt: timestamp }),

  /**
   * Listen for online/offline events and auto-resume sync on reconnect
   */
  initNetworkListeners: () => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const { status } = get();
        if (status === 'offline' || status === 'error') {
          set({ status: 'idle', error: null });
          get().syncNow().catch(() => {});
        }
      }, 2000);
    };

    const handleOffline = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      set({ status: 'offline', error: 'No internet connection. Sync will resume when online.' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      set({ status: 'offline' });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectStatus = (state: SyncState) => state.status;
export const selectCursor = (state: SyncState) => state.cursor;
export const selectLastSyncAt = (state: SyncState) => state.lastSyncAt;
export const selectConflicts = (state: SyncState) => state.conflicts;
export const selectError = (state: SyncState) => state.error;
export const selectIsEnabled = (state: SyncState) => state.isEnabled;
export const selectIsSyncing = (state: SyncState) => state.status === 'syncing';
export const selectHasConflicts = (state: SyncState) => state.conflicts.length > 0;
