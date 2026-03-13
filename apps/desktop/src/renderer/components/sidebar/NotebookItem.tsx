import { useState, useCallback, useRef, memo, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  Folder,
  Plus,
  X,
  GitBranch,
  History,
  GripVertical,
} from 'lucide-react';
import type { NotebookTreeNode } from '../../../preload/index';
import { CommitHistory } from '../git/CommitHistory';

type DropPosition = 'above' | 'inside' | 'below' | null;

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
  readonly onMove?: (id: string, newParentId: string | null) => void;
  readonly onReorder?: (parentId: string | null, orderedIds: string[]) => void;
  readonly siblingIds?: string[];
}

/** Collect all descendant IDs from a tree node (used for circular ref prevention) */
function collectDescendantIds(node: NotebookTreeNode): Set<string> {
  const ids = new Set<string>();
  function walk(children: NotebookTreeNode[]) {
    for (const child of children) {
      ids.add(child.notebook.id);
      walk(child.children);
    }
  }
  walk(node.children);
  return ids;
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
  onMove,
  onReorder,
  siblingIds,
}: NotebookItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.notebook.name);
  const [isGitEnabled, setIsGitEnabled] = useState(false);
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [showCommitHistory, setShowCommitHistory] = useState(false);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canDrag, setCanDrag] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const hasChildren = node.children.length > 0;
  const isInbox = node.notebook.id === 'inbox';
  const canHaveChildren = depth < 2; // Max 3 levels (0, 1, 2)

  // Memoize descendant IDs for circular reference prevention
  const descendantIds = useMemo(() => collectDescendantIds(node), [node]);

  // Check git status on mount
  useEffect(() => {
    const checkGitStatus = async () => {
      try {
        const result = await window.readied.notebooks.isGitEnabled(node.notebook.id);
        if (result.success && result.enabled !== undefined) {
          setIsGitEnabled(result.enabled);
        }
      } catch (error) {
        console.error('Failed to check git status:', error);
      }
    };
    checkGitStatus();
  }, [node.notebook.id]);

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

  const handleToggleGit = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsGitLoading(true);
      try {
        if (isGitEnabled) {
          await window.readied.notebooks.disableGit(node.notebook.id);
          setIsGitEnabled(false);
        } else {
          const result = await window.readied.git.init(node.notebook.id);
          if (result.success) {
            await window.readied.notebooks.enableGit(node.notebook.id);
            setIsGitEnabled(true);
          }
        }
      } catch (error) {
        console.error('Failed to toggle git:', error);
        alert(`Failed to ${isGitEnabled ? 'disable' : 'enable'} git: ${error}`);
      } finally {
        setIsGitLoading(false);
      }
    },
    [node.notebook.id, isGitEnabled]
  );

  const handleShowHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCommitHistory(true);
  }, []);

  // ── Drag & Drop ──────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (isInbox || isEditing) {
        e.preventDefault();
        return;
      }

      e.dataTransfer.setData('text/plain', node.notebook.id);
      e.dataTransfer.setData('application/x-notebook-parent', node.notebook.parentId ?? 'root');
      // Store descendant IDs so drop targets can check for circular reference
      e.dataTransfer.setData(
        'application/x-notebook-descendants',
        JSON.stringify([...descendantIds])
      );
      e.dataTransfer.effectAllowed = 'move';
      setIsDragging(true);
    },
    [node.notebook.id, node.notebook.parentId, isInbox, isEditing, descendantIds]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getDropPosition = useCallback(
    (e: React.DragEvent): DropPosition => {
      const row = rowRef.current;
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      // Top 25% = above, bottom 25% = below, middle 50% = inside (if can have children)
      if (y < height * 0.25) return 'above';
      if (y > height * 0.75) return 'below';
      return canHaveChildren || isInbox ? 'inside' : 'above';
    },
    [canHaveChildren, isInbox]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const hasDragData = e.dataTransfer.types.includes('text/plain');
      if (!hasDragData) return;

      e.dataTransfer.dropEffect = 'move';
      const pos = getDropPosition(e);

      // Inbox only accepts 'inside' drops
      if (isInbox && pos !== 'inside') {
        setDropPosition('inside');
        return;
      }
      setDropPosition(pos);
    },
    [getDropPosition, isInbox]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving this element, not entering a child
    const row = rowRef.current;
    if (row && !row.contains(e.relatedTarget as Node)) {
      setDropPosition(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropPosition(null);

      const draggedId = e.dataTransfer.getData('text/plain');
      const draggedParentId = e.dataTransfer.getData('application/x-notebook-parent');
      if (!draggedId || draggedId === node.notebook.id) return;

      // Prevent circular reference: can't drop a parent into its own descendant
      try {
        const descendants = JSON.parse(
          e.dataTransfer.getData('application/x-notebook-descendants') || '[]'
        ) as string[];
        if (descendants.includes(node.notebook.id)) {
          return; // Abort — would create circular reference
        }
      } catch {
        // If descendant data is malformed, proceed cautiously
      }

      const pos = isInbox ? 'inside' : getDropPosition(e);
      const thisParentId = node.notebook.parentId;

      if (pos === 'inside') {
        // Move dragged notebook into this one as a child
        onMove?.(draggedId, node.notebook.id);
        setIsExpanded(true);
      } else if (pos === 'above' || pos === 'below') {
        const fromSameParent =
          (draggedParentId === 'root' ? null : draggedParentId) === thisParentId;

        if (fromSameParent && siblingIds && onReorder) {
          // Reorder within same parent
          const filtered = siblingIds.filter(id => id !== draggedId);
          const targetIndex = filtered.indexOf(node.notebook.id);
          const insertIndex = pos === 'above' ? targetIndex : targetIndex + 1;
          filtered.splice(insertIndex, 0, draggedId);
          onReorder(thisParentId, filtered);
        } else {
          // Move to a different parent, then position will be at end
          onMove?.(draggedId, thisParentId);
        }
      }
    },
    [
      node.notebook.id,
      node.notebook.parentId,
      isInbox,
      getDropPosition,
      onMove,
      onReorder,
      siblingIds,
    ]
  );

  // CSS class for drop indicator
  const dropClass = dropPosition ? `drop-${dropPosition}` : '';
  const draggingClass = isDragging ? 'dragging' : '';

  return (
    <li className="notebook-item" role="treeitem" aria-expanded={isExpanded}>
      <div
        ref={rowRef}
        className={`notebook-item-row ${isSelected ? 'selected' : ''} ${isInPath ? 'in-path' : ''} ${dropClass} ${draggingClass}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        draggable={canDrag && !isInbox && !isEditing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag handle — only visible on hover, enables dragging */}
        {!isInbox && !isEditing && (
          <span
            className="notebook-item-drag-handle"
            aria-hidden="true"
            onMouseEnter={() => setCanDrag(true)}
            onMouseLeave={() => setCanDrag(false)}
          >
            <GripVertical size={12} />
          </span>
        )}

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

        {isGitEnabled && !isInbox && (
          <span className="notebook-item-git-badge" aria-label="Git enabled" title="Git enabled">
            <GitBranch size={10} />
          </span>
        )}

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
            <button
              type="button"
              className={`notebook-item-action ${isGitEnabled ? 'notebook-item-action--git-enabled' : ''}`}
              onClick={handleToggleGit}
              disabled={isGitLoading}
              aria-label={isGitEnabled ? 'Disable git' : 'Enable git'}
              title={isGitEnabled ? 'Disable git version control' : 'Enable git version control'}
            >
              <GitBranch size={12} aria-hidden="true" style={{ opacity: isGitLoading ? 0.5 : 1 }} />
            </button>
            {isGitEnabled && (
              <button
                type="button"
                className="notebook-item-action"
                onClick={handleShowHistory}
                aria-label="View commit history"
                title="View commit history"
              >
                <History size={12} aria-hidden="true" />
              </button>
            )}
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
              onMove={onMove}
              onReorder={onReorder}
              siblingIds={node.children.map(c => c.notebook.id)}
            />
          ))}
        </ul>
      )}

      {showCommitHistory && (
        <CommitHistory
          notebookId={node.notebook.id}
          notebookName={node.notebook.name}
          onClose={() => setShowCommitHistory(false)}
        />
      )}
    </li>
  );
});
