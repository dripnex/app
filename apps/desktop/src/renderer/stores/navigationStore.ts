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
  | { kind: 'search'; query: string };

/**
 * Status filter - orthogonal to navigation, can combine with any view
 */
export type StatusFilter = NoteStatus | null;

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
  sortBy: SortBy;
  sortOrder: SortOrder;

  // Actions - Navigation
  goToAllNotes: () => void;
  goToPinned: () => void;
  goToTrash: () => void;
  goToNotebook: (id: string) => void;
  goToTag: (name: string) => void;
  goToSearch: (query: string) => void;
  clearNavigation: () => void;

  // Actions - Status Filter
  setStatusFilter: (status: StatusFilter) => void;
  clearStatusFilter: () => void;

  // Actions - Sort
  setSort: (sortBy: SortBy, sortOrder: SortOrder) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

const DEFAULT_NAVIGATION: NavigationState = { kind: 'global', filter: 'all' };

export const useNavigationStore = create<NavigationStore>((set) => ({
  // Initial state
  navigation: DEFAULT_NAVIGATION,
  statusFilter: null,
  sortBy: 'updatedAt',
  sortOrder: 'desc',

  // Navigation actions
  goToAllNotes: () => set({ navigation: { kind: 'global', filter: 'all' } }),
  goToPinned: () => set({ navigation: { kind: 'global', filter: 'pinned' } }),
  goToTrash: () => set({ navigation: { kind: 'global', filter: 'trash' } }),
  goToNotebook: (id) => set({ navigation: { kind: 'notebook', id } }),
  goToTag: (name) => set({ navigation: { kind: 'tag', name } }),
  goToSearch: (query) => set({ navigation: { kind: 'search', query } }),
  clearNavigation: () => set({ navigation: DEFAULT_NAVIGATION }),

  // Status filter actions
  setStatusFilter: (status) => set({ statusFilter: status }),
  clearStatusFilter: () => set({ statusFilter: null }),

  // Sort actions
  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
}));

// ============================================================================
// Selectors (for granular subscriptions)
// ============================================================================

export const selectNavigation = (state: NavigationStore) => state.navigation;
export const selectStatusFilter = (state: NavigationStore) => state.statusFilter;

// Derived selectors
export const selectIsNotebookContext = (state: NavigationStore) =>
  state.navigation.kind === 'notebook';

export const selectIsGlobalContext = (state: NavigationStore) =>
  state.navigation.kind === 'global';

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
