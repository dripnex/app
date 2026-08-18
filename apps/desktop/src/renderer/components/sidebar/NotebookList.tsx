import { useCallback, useMemo } from 'react';
import { useNotebookTree, useNotebookMutations, getAncestorIds } from '../../hooks/useNotebooks';
import type { NotebookTreeNode } from '../../../preload/index';
import { NotebookItem } from './NotebookItem';
import { sc } from './sc';

interface NotebookListProps {
  readonly selectedNotebookId: string | null;
  readonly onSelectNotebook: (id: string) => void;
  readonly filterParentId?: string | null;
  /** Request to create a child notebook */
  readonly onRequestCreateChild: (parentId: string) => void;
  readonly nameFilter?: string;
}

function NotebookListSkeleton() {
  return (
    <div className={sc('notebook-list-skeleton')} aria-busy="true">
      <div className={sc('skeleton-item')} />
      <div className={sc('skeleton-item')} />
      <div className={sc('skeleton-item')} />
    </div>
  );
}

function NotebookListEmpty() {
  return (
    <div className={sc('notebook-list-empty')}>
      <p>No notebooks yet</p>
    </div>
  );
}

function NotebookListError({ message }: { message: string }) {
  return (
    <div className={sc('notebook-list-error')} role="alert">
      <p>Error loading notebooks: {message}</p>
    </div>
  );
}

/**
 * NotebookList - Pure list component
 *
 * Only renders notebooks and emits events.
 * Does NOT manage modals or overlays.
 */
export function NotebookList({
  selectedNotebookId,
  onSelectNotebook,
  filterParentId,
  onRequestCreateChild,
  nameFilter = '',
}: NotebookListProps) {
  const { data: tree, isLoading, error } = useNotebookTree();
  const { renameNotebook, deleteNotebook, moveNotebook, reorderNotebooks } = useNotebookMutations();

  // Calculate ancestor IDs for breadcrumb-style highlighting
  const ancestorIds = useMemo(
    () => getAncestorIds(selectedNotebookId, tree ?? []),
    [selectedNotebookId, tree]
  );

  // Filter tree to show only children of filterParentId when in contextual mode
  const displayedTree = useMemo(() => {
    if (!filterParentId || !tree) return tree ?? [];

    function findChildren(nodes: NotebookTreeNode[]): NotebookTreeNode[] {
      for (const node of nodes) {
        if (node.notebook.id === filterParentId) {
          return node.children;
        }
        const found = findChildren(node.children);
        if (found.length > 0) return found;
      }
      return [];
    }
    return findChildren(tree);
  }, [tree, filterParentId]);

  const filteredTree = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) return displayedTree;

    function match(nodes: NotebookTreeNode[]): NotebookTreeNode[] {
      const next: NotebookTreeNode[] = [];
      for (const node of nodes) {
        const children = match(node.children);
        if (node.notebook.name.toLowerCase().includes(q) || children.length > 0) {
          next.push({ ...node, children });
        }
      }
      return next;
    }

    return match(displayedTree);
  }, [displayedTree, nameFilter]);

  const visibleTree = useMemo(
    () => filteredTree.filter(node => node.notebook.id !== 'templates'),
    [filteredTree]
  );

  // Sibling IDs at the root level (for reorder)
  const rootSiblingIds = useMemo(() => visibleTree.map(n => n.notebook.id), [visibleTree]);

  const handleRename = useCallback(
    async (id: string, name: string) => {
      await renameNotebook.mutateAsync({ id, name });
    },
    [renameNotebook]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteNotebook.mutateAsync(id);
      if (selectedNotebookId === id) {
        onSelectNotebook('inbox');
      }
    },
    [deleteNotebook, selectedNotebookId, onSelectNotebook]
  );

  const handleMove = useCallback(
    async (id: string, newParentId: string | null) => {
      await moveNotebook.mutateAsync({ id, newParentId });
    },
    [moveNotebook]
  );

  const handleReorder = useCallback(
    async (parentId: string | null, orderedIds: string[]) => {
      await reorderNotebooks.mutateAsync({ parentId, orderedIds });
    },
    [reorderNotebooks]
  );

  // Loading state
  if (isLoading) {
    return <NotebookListSkeleton />;
  }

  // Error state
  if (error) {
    return <NotebookListError message={error instanceof Error ? error.message : 'Unknown error'} />;
  }

  // Empty state (only for global mode, not contextual)
  if (!filterParentId && (!tree || tree.length === 0)) {
    return <NotebookListEmpty />;
  }

  return (
    <div className={sc('notebook-list')}>
      <ul className={sc('notebook-list-tree')} role="tree" aria-label="Notebooks">
        {visibleTree.map(node => (
          <NotebookItem
            key={node.notebook.id}
            node={node}
            depth={0}
            isSelected={selectedNotebookId === node.notebook.id}
            isInPath={ancestorIds.has(node.notebook.id)}
            ancestorIds={ancestorIds}
            selectedNotebookId={selectedNotebookId}
            onSelect={onSelectNotebook}
            onRename={handleRename}
            onDelete={handleDelete}
            onCreateChild={onRequestCreateChild}
            onMove={handleMove}
            onReorder={handleReorder}
            siblingIds={rootSiblingIds}
          />
        ))}
      </ul>
    </div>
  );
}

export type { NotebookListProps };
