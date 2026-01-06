import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

interface EditorBufferStore {
  // State
  noteId: string | null;
  liveContent: string;
  isDirty: boolean;

  // Actions
  setNote: (noteId: string, content: string) => void;
  updateBuffer: (content: string) => void;
  markClean: () => void;
  clear: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useEditorBufferStore = create<EditorBufferStore>()((set, get) => ({
  // Initial state
  noteId: null,
  liveContent: '',
  isDirty: false,

  // Actions
  setNote: (noteId, content) =>
    set({
      noteId,
      liveContent: content,
      isDirty: false,
    }),

  updateBuffer: content => {
    const state = get();
    // Only mark dirty if content actually changed
    if (state.liveContent !== content) {
      set({
        liveContent: content,
        isDirty: true,
      });
    }
  },

  markClean: () => set({ isDirty: false }),

  clear: () =>
    set({
      noteId: null,
      liveContent: '',
      isDirty: false,
    }),
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectLiveContent = (state: EditorBufferStore) => state.liveContent;
export const selectNoteId = (state: EditorBufferStore) => state.noteId;
export const selectIsDirty = (state: EditorBufferStore) => state.isDirty;

/**
 * Returns live content only if it matches the given noteId.
 * Used by MarkdownPreview to avoid showing content from a different note.
 */
export const selectContentForNote = (noteId: string | null) => (state: EditorBufferStore) =>
  state.noteId === noteId ? state.liveContent : null;
