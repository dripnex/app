import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface ShareInfo {
  slug: string;
  url: string;
  noteId: string;
}

interface ShareStore {
  // State
  shares: Record<string, ShareInfo>; // noteId → ShareInfo
  isLoaded: boolean;

  // Actions
  setShared: (noteId: string, info: ShareInfo) => void;
  removeShared: (noteId: string) => void;
  getShare: (noteId: string) => ShareInfo | null;
  isShared: (noteId: string) => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useShareStore = create<ShareStore>()(
  persist(
    (set, get) => ({
      // Initial state
      shares: {},
      isLoaded: true,

      // Actions
      setShared: (noteId, info) => {
        set(state => ({
          shares: { ...state.shares, [noteId]: info },
        }));
      },

      removeShared: noteId => {
        set(state => {
          const { [noteId]: _, ...rest } = state.shares;
          return { shares: rest };
        });
      },

      getShare: noteId => get().shares[noteId] ?? null,

      isShared: noteId => noteId in get().shares,
    }),
    {
      name: 'dripnex-shares',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsShared = (noteId: string) => (state: ShareStore) => noteId in state.shares;

export const selectShareInfo = (noteId: string) => (state: ShareStore) =>
  state.shares[noteId] ?? null;
