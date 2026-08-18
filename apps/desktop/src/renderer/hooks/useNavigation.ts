import { useMemo } from 'react';
import type { NoteSnapshot } from '../../preload/index';
import {
  useNavigationStore,
  selectNavigation,
  selectStatusFilter,
  selectTagFilter,
  selectIsNotebookContext,
  selectSelectedNotebookId,
  selectGlobalFilter,
  selectSelectedTag,
  selectSortBy,
  selectSortOrder,
  type NavigationState,
  type StatusFilter,
  type TagFilter,
  type SortBy,
  type SortOrder,
} from '../stores/navigationStore';
import { useNotes, useNoteCounts, useScopedNoteCounts, withExcerpt } from './useNotes';
import { useNotebookTree, getNotebookPath, getAncestorIds } from './useNotebooks';
import { listOptionsFromNav } from '../utils/listOptionsFromNav';

// ============================================================================
// Note with Excerpt (for list display)
// ============================================================================

export interface NoteWithExcerpt extends NoteSnapshot {
  /** First ~100 chars of content for preview */
  readonly excerpt: string;
}

// ============================================================================
// Re-export types
// ============================================================================

export type { NavigationState, StatusFilter, TagFilter, SortBy, SortOrder };

// ============================================================================
// Granular Selectors (minimize re-renders)
// ============================================================================

/** Get current navigation state */
export const useNavigation = () => useNavigationStore(selectNavigation);

/** Get current status filter */
export const useStatusFilter = () => useNavigationStore(selectStatusFilter);

/** Get current tag filter */
export const useTagFilter = () => useNavigationStore(selectTagFilter);

/** Check if in notebook context */
export const useIsNotebookContext = () => useNavigationStore(selectIsNotebookContext);

/** Get selected notebook ID (null if not in notebook view) */
export const useSelectedNotebookId = () => useNavigationStore(selectSelectedNotebookId);

/** Get global filter (null if not in global view) */
export const useGlobalFilter = () => useNavigationStore(selectGlobalFilter);

/** Get selected tag (null if not in tag view) */
export const useSelectedTag = () => useNavigationStore(selectSelectedTag);

/** Get current sort field */
export const useSortBy = () => useNavigationStore(selectSortBy);

/** Get current sort order */
export const useSortOrder = () => useNavigationStore(selectSortOrder);

// ============================================================================
// Actions Hook (stable references)
// ============================================================================

/** Get all navigation actions (stable references) */
export function useNavigationActions() {
  const goToAllNotes = useNavigationStore(s => s.goToAllNotes);
  const goToAllInCurrentContext = useNavigationStore(s => s.goToAllInCurrentContext);
  const goToPinned = useNavigationStore(s => s.goToPinned);
  const goToTrash = useNavigationStore(s => s.goToTrash);
  const goToNotebook = useNavigationStore(s => s.goToNotebook);
  const goToTag = useNavigationStore(s => s.goToTag);
  const goToSearch = useNavigationStore(s => s.goToSearch);
  const clearNavigation = useNavigationStore(s => s.clearNavigation);
  const setStatusFilter = useNavigationStore(s => s.setStatusFilter);
  const setTagFilter = useNavigationStore(s => s.setTagFilter);
  const clearFilters = useNavigationStore(s => s.clearFilters);
  const setSort = useNavigationStore(s => s.setSort);

  return {
    goToAllNotes,
    goToAllInCurrentContext,
    goToPinned,
    goToTrash,
    goToNotebook,
    goToTag,
    goToSearch,
    clearNavigation,
    setStatusFilter,
    setTagFilter,
    clearFilters,
    setSort,
  };
}

// ============================================================================
// Derived Data Hooks (combine Zustand + React Query)
// ============================================================================

/**
 * Get filtered notes based on current navigation state
 * Combines Zustand navigation with React Query data
 * Returns notes with excerpt for list display
 */
export function useFilteredNotes(): NoteWithExcerpt[] {
  const navigation = useNavigation();
  const statusFilter = useStatusFilter();
  const tagFilter = useTagFilter();
  const sortBy = useSortBy();
  const sortOrder = useSortOrder();

  const options = useMemo(
    () => listOptionsFromNav({ navigation, statusFilter, tagFilter, sortBy, sortOrder }),
    [navigation, statusFilter, tagFilter, sortBy, sortOrder]
  );
  const { data: notes } = useNotes(options);

  return useMemo(() => (notes ?? []).map(withExcerpt), [notes]);
}

/**
 * Get notebook context data (path, ancestors, etc.)
 * Only useful when navigation.kind === 'notebook'
 */
export function useNotebookContext() {
  const navigation = useNavigation();
  const { data: tree } = useNotebookTree();

  return useMemo(() => {
    if (navigation.kind !== 'notebook') {
      return {
        id: null,
        path: [],
        ancestorIds: new Set<string>(),
        childrenIds: [],
      };
    }

    const id = navigation.id;
    const path = getNotebookPath(id, tree ?? []);
    const ancestorIds = getAncestorIds(id, tree ?? []);

    // Find children of selected notebook
    function findChildren(nodes: typeof tree): string[] {
      if (!nodes) return [];
      for (const node of nodes) {
        if (node.notebook.id === id) {
          return node.children.map(c => c.notebook.id);
        }
        const found = findChildren(node.children);
        if (found.length > 0) return found;
      }
      return [];
    }

    return {
      id,
      path,
      ancestorIds,
      childrenIds: findChildren(tree ?? []),
    };
  }, [navigation, tree]);
}

/**
 * Get global note counts
 */
export function useGlobalCounts() {
  const { data: counts } = useNoteCounts();

  return useMemo(
    () => ({
      active: counts?.active ?? 0,
      pinned: counts?.pinned ?? 0,
      deleted: counts?.deleted ?? 0,
      byStatus: counts?.byStatus ?? { active: 0, on_hold: 0, completed: 0, dropped: 0 },
    }),
    [counts]
  );
}

/**
 * Get displayed notes count (for current view)
 */
export function useDisplayedNotesCount(): number {
  const notes = useFilteredNotes();
  return notes.length;
}

/**
 * Notes in the current nav context only (no status/tag overlay).
 * Used for sidebar All Notes / Status / Tags counts.
 */
export function useContextNotes(): NoteSnapshot[] {
  const navigation = useNavigation();
  const options = useMemo(
    () => listOptionsFromNav({ navigation, statusFilter: null, tagFilter: null }),
    [navigation]
  );
  const { data: notes } = useNotes(options);
  return notes ?? [];
}

export function useScopedSidebarCounts() {
  const navigation = useNavigation();
  const options = useMemo(
    () => listOptionsFromNav({ navigation, statusFilter: null, tagFilter: null }),
    [navigation]
  );
  const { data } = useScopedNoteCounts(options);

  return useMemo(
    () => ({
      all: data?.total ?? 0,
      byStatus: data?.byStatus ?? { active: 0, on_hold: 0, completed: 0, dropped: 0 },
      byTag: data?.byTag ?? {},
    }),
    [data]
  );
}
