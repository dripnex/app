import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  Folder,
  Plus,
  X,
} from 'lucide-react';
import type { NotebookTreeNode } from '../../preload/index';
import { useNotebookTree, useNotebookMutations } from '../hooks/useNotebooks';

interface NotebookTreeProps {
  selectedNotebookId: string | null;
  onSelectNotebook: (id: string) => void;
}

interface TreeNodeProps {
  node: NotebookTreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCreate: (parentId: string) => void;
}

function TreeNode({ node, selectedId, onSelect, onRename, onDelete, onCreate }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.notebook.name);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.notebook.id;
  const isInbox = node.notebook.id === 'inbox';
  const canHaveChildren = node.notebook.depth < 2; // Max 3 levels (0, 1, 2)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.notebook.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInbox) {
      setIsEditing(true);
      setEditName(node.notebook.name);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim() && editName !== node.notebook.name) {
      onRename(node.notebook.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(node.notebook.name);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Context menu could be added here in the future
  };

  return (
    <li className="notebook-tree-item" role="treeitem" aria-expanded={isExpanded}>
      <div
        className={`notebook-tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${node.notebook.depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
      >
        {hasChildren && (
          <button
            type="button"
            className="notebook-tree-toggle"
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="chevron" />
            ) : (
              <ChevronRight size={14} className="chevron" />
            )}
          </button>
        )}
        {!hasChildren && <span className="notebook-tree-spacer" />}

        <span className="notebook-icon" aria-hidden="true">
          {isInbox ? <Inbox size={14} /> : <Folder size={14} />}
        </span>

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="notebook-edit-form">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditSubmit}
              autoFocus
              className="notebook-edit-input"
            />
          </form>
        ) : (
          <span className="notebook-name">{node.notebook.name}</span>
        )}

        {!isInbox && (
          <div className="notebook-actions">
            {canHaveChildren && (
              <button
                type="button"
                className="notebook-action-btn"
                onClick={e => {
                  e.stopPropagation();
                  onCreate(node.notebook.id);
                }}
                title="Add sub-notebook"
                aria-label="Add sub-notebook"
              >
                <Plus size={12} />
              </button>
            )}
            <button
              type="button"
              className="notebook-action-btn notebook-action-delete"
              onClick={e => {
                e.stopPropagation();
                if (confirm(`Delete "${node.notebook.name}"? Notes will move to Inbox.`)) {
                  onDelete(node.notebook.id);
                }
              }}
              title="Delete notebook"
              aria-label="Delete notebook"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="notebook-tree-children" role="group">
          {node.children.map(child => (
            <TreeNode
              key={child.notebook.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreate={onCreate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function NotebookTree({ selectedNotebookId, onSelectNotebook }: NotebookTreeProps) {
  const { data: tree, isLoading } = useNotebookTree();
  const { createNotebook, renameNotebook, deleteNotebook } = useNotebookMutations();
  const [isCreating, setIsCreating] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const handleCreate = useCallback((parentId?: string) => {
    setCreateParentId(parentId ?? null);
    setNewNotebookName('');
    setIsCreating(true);
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newNotebookName.trim()) {
      await createNotebook.mutateAsync({
        name: newNotebookName.trim(),
        parentId: createParentId ?? undefined,
      });
      setIsCreating(false);
      setNewNotebookName('');
      setCreateParentId(null);
    }
  };

  const handleCreateCancel = () => {
    setIsCreating(false);
    setNewNotebookName('');
    setCreateParentId(null);
  };

  const handleRename = async (id: string, name: string) => {
    await renameNotebook.mutateAsync({ id, name });
  };

  const handleDelete = async (id: string) => {
    await deleteNotebook.mutateAsync(id);
    if (selectedNotebookId === id) {
      onSelectNotebook('inbox');
    }
  };

  if (isLoading) {
    return (
      <div className="notebook-tree-loading" aria-busy="true">
        Loading notebooks...
      </div>
    );
  }

  return (
    <div className="notebook-tree" role="tree" aria-label="Notebooks">
      <div className="notebook-tree-header">
        <span className="notebook-tree-title">Notebooks</span>
        <button
          type="button"
          className="notebook-tree-add"
          onClick={() => handleCreate()}
          title="Create notebook"
          aria-label="Create new notebook"
        >
          <Plus size={14} />
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="notebook-create-form">
          <input
            type="text"
            value={newNotebookName}
            onChange={e => setNewNotebookName(e.target.value)}
            placeholder="Notebook name"
            autoFocus
            className="notebook-create-input"
          />
          <div className="notebook-create-actions">
            <button
              type="submit"
              className="notebook-create-btn"
              disabled={!newNotebookName.trim()}
            >
              Create
            </button>
            <button
              type="button"
              className="notebook-create-btn cancel"
              onClick={handleCreateCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="notebook-tree-list" role="group">
        {tree?.map(node => (
          <TreeNode
            key={node.notebook.id}
            node={node}
            selectedId={selectedNotebookId}
            onSelect={onSelectNotebook}
            onRename={handleRename}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        ))}
      </ul>
    </div>
  );
}
