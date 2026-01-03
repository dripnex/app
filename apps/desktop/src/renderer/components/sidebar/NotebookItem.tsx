import { useState, useCallback, memo } from 'react';
import { ChevronDown, ChevronRight, Inbox, Folder, Plus, X } from 'lucide-react';
import type { NotebookTreeNode } from '../../../preload/index';

interface NotebookItemProps {
  readonly node: NotebookTreeNode;
  readonly depth: number;
  readonly noteCount?: number;
  readonly isSelected: boolean;
  readonly isInPath: boolean;
  readonly ancestorIds: Set<string>;
  readonly selectedNotebookId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onCreateChild: (parentId: string) => void;
}

export const NotebookItem = memo(function NotebookItem({
  node,
  depth,
  noteCount,
  isSelected,
  isInPath,
  ancestorIds,
  selectedNotebookId,
  onSelect,
  onRename,
  onDelete,
  onCreateChild,
}: NotebookItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.notebook.name);

  const hasChildren = node.children.length > 0;
  const isInbox = node.notebook.id === 'inbox';
  const canHaveChildren = depth < 2; // Max 3 levels (0, 1, 2)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(node.notebook.id);
    },
    [node.notebook.id, onSelect]
  );

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isInbox) {
        setIsEditing(true);
        setEditName(node.notebook.name);
      }
    },
    [isInbox, node.notebook.name]
  );

  const handleEditSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = editName.trim();
      if (trimmedName && trimmedName !== node.notebook.name) {
        onRename(node.notebook.id, trimmedName);
      }
      setIsEditing(false);
    },
    [editName, node.notebook.id, node.notebook.name, onRename]
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditing(false);
        setEditName(node.notebook.name);
      }
    },
    [node.notebook.name]
  );

  const handleAddChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCreateChild(node.notebook.id);
    },
    [node.notebook.id, onCreateChild]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm(`Delete "${node.notebook.name}"? Notes will move to Inbox.`)) {
        onDelete(node.notebook.id);
      }
    },
    [node.notebook.id, node.notebook.name, onDelete]
  );

  return (
    <li className="notebook-item" role="treeitem" aria-expanded={isExpanded}>
      <div
        className={`notebook-item-row ${isSelected ? 'selected' : ''} ${isInPath ? 'in-path' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
      >
        {hasChildren ? (
          <button
            type="button"
            className="notebook-item-toggle"
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown size={14} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="notebook-item-spacer" aria-hidden="true" />
        )}

        <span className="notebook-item-icon" aria-hidden="true">
          {isInbox ? <Inbox size={14} /> : <Folder size={14} />}
        </span>

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="notebook-item-edit-form">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditSubmit}
              autoFocus
              className="notebook-item-edit-input"
            />
          </form>
        ) : (
          <span className="notebook-item-name">{node.notebook.name}</span>
        )}

        {noteCount !== undefined && noteCount > 0 && (
          <span className="notebook-item-count" aria-label={`${noteCount} notes`}>
            {noteCount}
          </span>
        )}

        {!isInbox && (
          <div className="notebook-item-actions">
            {canHaveChildren && (
              <button
                type="button"
                className="notebook-item-action"
                onClick={handleAddChild}
                aria-label="Add sub-notebook"
              >
                <Plus size={12} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="notebook-item-action notebook-item-action--delete"
              onClick={handleDelete}
              aria-label="Delete notebook"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="notebook-item-children" role="group">
          {node.children.map(child => (
            <NotebookItem
              key={child.notebook.id}
              node={child}
              depth={depth + 1}
              isSelected={selectedNotebookId === child.notebook.id}
              isInPath={ancestorIds.has(child.notebook.id)}
              ancestorIds={ancestorIds}
              selectedNotebookId={selectedNotebookId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreateChild={onCreateChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
});
