import { useMemo } from 'react';
import type { NoteSnapshot } from '../../preload/index';
import {
  useNavigationStore,
  selectNavigation,
  selectStatusFilter,
  selectTagFilter,
  selectIsNotebookContext,
  selectIsPlanningContext,
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
import { useNotes, useNoteCounts, withExcerpt } from './useNotes';
import { useNotebookTree, getNotebookPath, getAncestorIds } from './useNotebooks';

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

/** Check if in planning (Kanban board) context */
export const useIsPlanningContext = () => useNavigationStore(selectIsPlanningContext);

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
  const goToPlanning = useNavigationStore(s => s.goToPlanning);
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
    goToPlanning,
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

  // Fetch notes with current sort config from store
  const { data: allNotes } = useNotes({
    sortBy,
    sortOrder,
    archived: 'all',
  });

  return useMemo(() => {
    if (!allNotes) return [];

    let notes = [...allNotes];

    // 1. Filter by navigation state
    switch (navigation.kind) {
      case 'global':
        if (navigation.filter === 'all') {
          notes = notes.filter(n => !n.isDeleted && !n.isArchived);
        } else if (navigation.filter === 'pinned') {
          notes = notes.filter(n => n.isPinned && !n.isDeleted);
        } else if (navigation.filter === 'trash') {
          notes = notes.filter(n => n.isDeleted);
        }
        break;

      case 'notebook':
        notes = notes.filter(n => n.notebookId === navigation.id && !n.isDeleted && !n.isArchived);
        break;

      case 'tag':
        notes = notes.filter(
          n => n.tags.some(t => t === navigation.name) && !n.isDeleted && !n.isArchived
        );
        break;

      case 'search':
        // Search is handled separately via useSearchNotes
        notes = notes.filter(n => !n.isDeleted && !n.isArchived);
        break;

      case 'planning':
        // The Planning board fetches and groups its own notes by boardStage;
        // the standard note list is empty in this view.
        notes = [];
        break;
    }

    // 2. Filter by status (orthogonal)
    if (statusFilter) {
      notes = notes.filter(n => n.status === statusFilter);
    }

    // 3. Filter by tag (orthogonal)
    if (tagFilter) {
      notes = notes.filter(n => n.tags.some(t => t === tagFilter));
    }

    // 4. Add excerpt for list display
    return notes.map(withExcerpt);
  }, [allNotes, navigation, statusFilter, tagFilter]);
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
