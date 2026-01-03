import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NotebookTreeNode } from '../../preload/index';

/** Query key factory for notebooks */
export const notebookKeys = {
  all: ['notebooks'] as const,
  lists: () => [...notebookKeys.all, 'list'] as const,
  list: () => [...notebookKeys.lists()] as const,
  tree: () => [...notebookKeys.all, 'tree'] as const,
  details: () => [...notebookKeys.all, 'detail'] as const,
  detail: (id: string) => [...notebookKeys.details(), id] as const,
  metadata: (id: string) => [...notebookKeys.details(), id, 'metadata'] as const,
};

/** Hook for listing all notebooks (flat) */
export function useNotebooks() {
  return useQuery({
    queryKey: notebookKeys.list(),
    queryFn: () => window.readied.notebooks.list(),
  });
}

/** Hook for getting notebook tree */
export function useNotebookTree() {
  return useQuery({
    queryKey: notebookKeys.tree(),
    queryFn: () => window.readied.notebooks.tree(),
  });
}

/** Hook for getting a single notebook */
export function useNotebook(id: string | null) {
  return useQuery({
    queryKey: notebookKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null;
      return window.readied.notebooks.get(id);
    },
    enabled: !!id,
  });
}

/** Hook for getting a notebook with metadata (counts) */
export function useNotebookWithMetadata(id: string | null) {
  return useQuery({
    queryKey: notebookKeys.metadata(id ?? ''),
    queryFn: async () => {
      if (!id) return null;
      return window.readied.notebooks.getWithMetadata(id);
    },
    enabled: !!id,
  });
}

/** Hook for notebook mutations */
export function useNotebookMutations() {
  const queryClient = useQueryClient();

  const invalidateNotebooks = () => {
    queryClient.invalidateQueries({ queryKey: notebookKeys.all });
  };

  const createNotebook = useMutation({
    mutationFn: async (input: { name: string; parentId?: string }) => {
      return window.readied.notebooks.create(input);
    },
    onSuccess: () => invalidateNotebooks(),
  });

  const renameNotebook = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return window.readied.notebooks.rename(id, name);
    },
    onSuccess: data => {
      queryClient.setQueryData(notebookKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: notebookKeys.tree() });
      queryClient.invalidateQueries({ queryKey: notebookKeys.lists() });
    },
  });

  const moveNotebook = useMutation({
    mutationFn: async ({ id, newParentId }: { id: string; newParentId: string | null }) => {
      return window.readied.notebooks.move(id, newParentId);
    },
    onSuccess: () => invalidateNotebooks(),
  });

  const deleteNotebook = useMutation({
    mutationFn: async (id: string) => {
      return window.readied.notebooks.delete(id);
    },
    onSuccess: () => {
      invalidateNotebooks();
      // Also invalidate notes since they may have moved to Inbox
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const reorderNotebooks = useMutation({
    mutationFn: async ({
      parentId,
      orderedIds,
    }: {
      parentId: string | null;
      orderedIds: string[];
    }) => {
      return window.readied.notebooks.reorder(parentId, orderedIds);
    },
    onSuccess: () => invalidateNotebooks(),
  });

  return {
    createNotebook,
    renameNotebook,
    moveNotebook,
    deleteNotebook,
    reorderNotebooks,
  };
}

/** Alias for useNotebooks - returns flat list of notebooks */
export const useNotebookList = useNotebooks;

/**
 * Get ancestor IDs for a selected notebook.
 * Used to highlight the path in the sidebar (breadcrumb-style navigation).
 */
export function getAncestorIds(selectedId: string | null, tree: NotebookTreeNode[]): Set<string> {
  const ancestors = new Set<string>();
  if (!selectedId) return ancestors;

  function findPath(nodes: NotebookTreeNode[], path: string[]): boolean {
    for (const node of nodes) {
      if (node.notebook.id === selectedId) {
        // Add all ancestors (excluding the selected node itself)
        path.forEach(id => ancestors.add(id));
        return true;
      }
      if (findPath(node.children, [...path, node.notebook.id])) {
        return true;
      }
    }
    return false;
  }

  findPath(tree, []);
  return ancestors;
}

/** Notebook snapshot type for path results */
export interface NotebookPathItem {
  id: string;
  name: string;
}

/**
 * Get the full path to a selected notebook.
 * Returns an array of notebooks from root to selected (inclusive).
 */
export function getNotebookPath(
  selectedId: string | null,
  tree: NotebookTreeNode[]
): NotebookPathItem[] {
  if (!selectedId) return [];

  function findPath(
    nodes: NotebookTreeNode[],
    path: NotebookPathItem[]
  ): NotebookPathItem[] | null {
    for (const node of nodes) {
      const newPath = [...path, { id: node.notebook.id, name: node.notebook.name }];
      if (node.notebook.id === selectedId) {
        return newPath;
      }
      const result = findPath(node.children, newPath);
      if (result) return result;
    }
    return null;
  }

  return findPath(tree, []) ?? [];
}
