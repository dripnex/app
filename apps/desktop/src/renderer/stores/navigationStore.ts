import { create } from 'zustand';
import type { NoteStatus } from '../../preload/index';

// ============================================================================
// Types
// ============================================================================

/**
 * Explicit navigation state - single source of truth for "what am I viewing"
 */
export type NavigationState =
  | { kind: 'global'; filter: 'all' | 'pinned' | 'trash' }
  | { kind: 'notebook'; id: string }
  | { kind: 'tag'; name: string }
  | { kind: 'search'; query: string }
  | { kind: 'planning' };

/**
 * Status filter - orthogonal to navigation, can combine with any view
 */
export type StatusFilter = NoteStatus | null;

/**
 * Tag filter - orthogonal to navigation, filters within current context
 */
export type TagFilter = string | null;

/**
 * Sort options for note list
 */
export type SortBy = 'title' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

// ============================================================================
// Store Interface
// ============================================================================

interface NavigationStore {
  // State
  navigation: NavigationState;
  statusFilter: StatusFilter;
  tagFilter: TagFilter;
  sortBy: SortBy;
  sortOrder: SortOrder;

  // Actions - Navigation
  goToAllNotes: () => void;
  goToAllInCurrentContext: () => void;
  goToPinned: () => void;
  goToTrash: () => void;
  goToNotebook: (id: string) => void;
  goToTag: (name: string) => void;
  goToSearch: (query: string) => void;
  goToPlanning: () => void;
  clearNavigation: () => void;

  // Actions - Filters
  setStatusFilter: (status: StatusFilter) => void;
  setTagFilter: (tag: TagFilter) => void;
  clearStatusFilter: () => void;
  clearFilters: () => void;

  // Actions - Sort
  setSort: (sortBy: SortBy, sortOrder: SortOrder) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

const DEFAULT_NAVIGATION: NavigationState = { kind: 'global', filter: 'all' };

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  // Initial state
  navigation: DEFAULT_NAVIGATION,
  statusFilter: null,
  tagFilter: null,
  sortBy: 'updatedAt',
  sortOrder: 'desc',

  // Navigation actions (clear filters when changing context)
  goToAllNotes: () =>
    set({ navigation: { kind: 'global', filter: 'all' }, statusFilter: null, tagFilter: null }),
  goToAllInCurrentContext: () => {
    const { navigation } = get();
    if (navigation.kind === 'notebook') {
      // Stay in notebook, just clear filters
      set({ statusFilter: null, tagFilter: null });
    } else {
      // Go to global "all notes"
      set({ navigation: { kind: 'global', filter: 'all' }, statusFilter: null, tagFilter: null });
    }
  },
  goToPinned: () =>
    set({ navigation: { kind: 'global', filter: 'pinned' }, statusFilter: null, tagFilter: null }),
  goToTrash: () =>
    set({ navigation: { kind: 'global', filter: 'trash' }, statusFilter: null, tagFilter: null }),
  goToNotebook: id =>
    set({ navigation: { kind: 'notebook', id }, statusFilter: null, tagFilter: null }),
  goToTag: name => set({ navigation: { kind: 'tag', name }, statusFilter: null, tagFilter: null }),
  goToSearch: query =>
    set({ navigation: { kind: 'search', query }, statusFilter: null, tagFilter: null }),
  goToPlanning: () =>
    set({ navigation: { kind: 'planning' }, statusFilter: null, tagFilter: null }),
  clearNavigation: () =>
    set({ navigation: DEFAULT_NAVIGATION, statusFilter: null, tagFilter: null }),

  // Filter actions
  setStatusFilter: status => set({ statusFilter: status }),
  setTagFilter: tag => set({ tagFilter: tag }),
  clearStatusFilter: () => set({ statusFilter: null }),
  clearFilters: () => set({ statusFilter: null, tagFilter: null }),

  // Sort actions
  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
}));

// ============================================================================
// Selectors (for granular subscriptions)
// ============================================================================

export const selectNavigation = (state: NavigationStore) => state.navigation;
export const selectStatusFilter = (state: NavigationStore) => state.statusFilter;
export const selectTagFilter = (state: NavigationStore) => state.tagFilter;

// Derived selectors
export const selectIsNotebookContext = (state: NavigationStore) =>
  state.navigation.kind === 'notebook';

export const selectIsGlobalContext = (state: NavigationStore) => state.navigation.kind === 'global';

export const selectIsPlanningContext = (state: NavigationStore) =>
  state.navigation.kind === 'planning';

export const selectIsTrashView = (state: NavigationStore) =>
  state.navigation.kind === 'global' && state.navigation.filter === 'trash';

export const selectSelectedNotebookId = (state: NavigationStore) =>
  state.navigation.kind === 'notebook' ? state.navigation.id : null;

export const selectGlobalFilter = (state: NavigationStore) =>
  state.navigation.kind === 'global' ? state.navigation.filter : null;

export const selectSelectedTag = (state: NavigationStore) =>
  state.navigation.kind === 'tag' ? state.navigation.name : null;

export const selectSortBy = (state: NavigationStore) => state.sortBy;
export const selectSortOrder = (state: NavigationStore) => state.sortOrder;
