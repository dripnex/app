import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Editor view modes for split view functionality
 */
export type EditorViewMode = 'editor' | 'split' | 'preview';

// ============================================================================
// Store Interface
// ============================================================================

interface EditorPreferencesStore {
  // State
  viewMode: EditorViewMode;
  outlineOpen: boolean;

  // Actions
  setViewMode: (mode: EditorViewMode) => void;
  cycleViewMode: () => void;
  togglePreview: () => void;
  toggleSplit: () => void;
  toggleOutline: () => void;
  setOutlineOpen: (open: boolean) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

const VIEW_MODE_CYCLE: EditorViewMode[] = ['editor', 'split', 'preview'];

export const useEditorPreferencesStore = create<EditorPreferencesStore>()(
  persist(
    (set, get) => ({
      // Initial state
      viewMode: 'editor',
      outlineOpen: false,

      // Actions
      setViewMode: mode => set({ viewMode: mode }),
      toggleOutline: () => set(state => ({ outlineOpen: !state.outlineOpen })),
      setOutlineOpen: open => set({ outlineOpen: open }),

      cycleViewMode: () => {
        const current = get().viewMode;
        const currentIndex = VIEW_MODE_CYCLE.indexOf(current);
        const nextIndex = (currentIndex + 1) % VIEW_MODE_CYCLE.length;
        set({ viewMode: VIEW_MODE_CYCLE[nextIndex] });
      },
      togglePreview: () => {
        set({ viewMode: get().viewMode === 'preview' ? 'editor' : 'preview' });
      },
      toggleSplit: () => {
        set({ viewMode: get().viewMode === 'split' ? 'editor' : 'split' });
      },
    }),
    {
      name: 'dripnex-editor-preferences',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectViewMode = (state: EditorPreferencesStore) => state.viewMode;
export const selectOutlineOpen = (state: EditorPreferencesStore) => state.outlineOpen;

export const selectIsEditorVisible = (state: EditorPreferencesStore) =>
  state.viewMode === 'editor' || state.viewMode === 'split';

export const selectIsPreviewVisible = (state: EditorPreferencesStore) =>
  state.viewMode === 'preview' || state.viewMode === 'split';
