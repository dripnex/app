import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

interface TagColorsStore {
  // State
  colors: Record<string, string>; // tagName -> color (only tags WITH color)
  isLoaded: boolean;
  isLoading: boolean; // Guard to prevent double fetch

  // Actions
  loadColors: () => Promise<void>;
  setColor: (tagName: string, color: string | null) => Promise<void>;
  getColor: (tagName: string) => string | null;
  /** Remove a tag from the cache (called when tag is deleted from system) */
  removeTag: (tagName: string) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useTagColorsStore = create<TagColorsStore>((set, get) => ({
  // Initial state
  colors: {},
  isLoaded: false,
  isLoading: false,

  // Actions
  loadColors: async () => {
    // Guard: no fetch if already loaded or currently loading
    if (get().isLoaded || get().isLoading) return;

    set({ isLoading: true });
    try {
      const tags = await window.dripnex.notes.tagsWithColors();
      const colorMap = Object.fromEntries(tags.filter(t => t.color).map(t => [t.name, t.color!]));
      set({ colors: colorMap, isLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  setColor: async (tagName, color) => {
    // 1. Persist to DB first
    await window.dripnex.notes.setTagColor(tagName, color);

    // 2. Update cache
    set(state => ({
      colors: color
        ? { ...state.colors, [tagName]: color }
        : Object.fromEntries(Object.entries(state.colors).filter(([k]) => k !== tagName)),
    }));
  },

  getColor: tagName => get().colors[tagName] ?? null,

  removeTag: tagName => {
    set(state => ({
      colors: Object.fromEntries(Object.entries(state.colors).filter(([k]) => k !== tagName)),
    }));
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectTagColor = (tagName: string) => (state: TagColorsStore) =>
  state.colors[tagName] ?? null;

export const selectIsLoaded = (state: TagColorsStore) => state.isLoaded;
