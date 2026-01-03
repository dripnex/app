import { useState, useCallback, useMemo } from 'react';
import { useNotebookTree, useNotebookMutations, getAncestorIds } from '../../hooks/useNotebooks';
import type { NotebookTreeNode } from '../../../preload/index';
import { NotebookItem } from './NotebookItem';
import { NotebookCreateForm } from './NotebookCreateForm';

interface NotebookListProps {
  readonly selectedNotebookId: string | null;
  readonly onSelectNotebook: (id: string) => void;
  readonly filterParentId?: string | null;
}

function NotebookListSkeleton() {
  return (
    <div className="notebook-list-skeleton" aria-busy="true">
      <div className="skeleton-item" />
      <div className="skeleton-item" />
      <div className="skeleton-item" />
    </div>
  );
}

function NotebookListEmpty() {
  return (
    <div className="notebook-list-empty">
      <p>No notebooks yet</p>
    </div>
  );
}

function NotebookListError({ message }: { message: string }) {
  return (
    <div className="notebook-list-error" role="alert">
      <p>Error loading notebooks: {message}</p>
    </div>
  );
}

export function NotebookList({
  selectedNotebookId,
  onSelectNotebook,
  filterParentId,
}: NotebookListProps) {
  const { data: tree, isLoading, error } = useNotebookTree();
  const { createNotebook, renameNotebook, deleteNotebook } = useNotebookMutations();
  const [isCreating, setIsCreating] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  // Calculate ancestor IDs for breadcrumb-style highlighting
  const ancestorIds = useMemo(
    () => getAncestorIds(selectedNotebookId, tree ?? []),
    [selectedNotebookId, tree]
  );

  // Filter tree to show only children of filterParentId when in contextual mode
  const displayedTree = useMemo(() => {
    if (!filterParentId || !tree) return tree ?? [];

    // Find children of the selected notebook
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

  const handleStartCreate = useCallback((parentId?: string) => {
    setCreateParentId(parentId ?? null);
    setIsCreating(true);
  }, []);

  const handleCreate = useCallback(
    async (name: string, parentId: string | null) => {
      await createNotebook.mutateAsync({
        name,
        parentId: parentId ?? undefined,
      });
      setIsCreating(false);
      setCreateParentId(null);
    },
    [createNotebook]
  );

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setCreateParentId(null);
  }, []);

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
    <div className="notebook-list">
      {isCreating && (
        <NotebookCreateForm
          parentId={createParentId}
          onSubmit={handleCreate}
          onCancel={handleCancelCreate}
        />
      )}
      <ul className="notebook-list-tree" role="tree" aria-label="Notebooks">
        {displayedTree.map(node => (
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
            onCreateChild={handleStartCreate}
          />
        ))}
      </ul>
    </div>
  );
}

// Export for external use to trigger creation
export type { NotebookListProps };
