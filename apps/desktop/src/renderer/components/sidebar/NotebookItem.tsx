import { useState, useCallback, useRef, memo, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  GitBranch,
  History,
  GripVertical,
  Trash2,
  Smile,
} from 'lucide-react';
import { useStore } from 'zustand';
import { pluginContextMenuStore } from '@dripnex/plugin-api';
import { dispatchCommand } from '../../hooks/useCommandRegistry';
import type { NotebookTreeNode } from '../../../preload/index';
import { useNotebookExpandStore } from '../../stores/notebookExpandStore';
import { useWorkspaceRootId } from '../../hooks/useNavigation';
import { CommitHistory } from '../git/CommitHistory';
import { NotebookIconPicker, type IconPickerAnchor } from './NotebookIconPicker';
import { notebookLucideIcon } from './notebookIcons';
import { sc } from './sc';

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
  readonly onEnterWorkspace?: (id: string) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onCreateChild: (parentId: string) => void;
  readonly onSetIcon: (id: string, icon: string | null) => void;
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
  onEnterWorkspace,
  onRename,
  onDelete,
  onCreateChild,
  onSetIcon,
  onMove,
  onReorder,
  siblingIds,
}: NotebookItemProps) {
  const workspaceRootId = useWorkspaceRootId();
  const isExpanded = useNotebookExpandStore(s => !s.collapsedIds.includes(node.notebook.id));
  const toggleExpanded = useNotebookExpandStore(s => s.toggle);
  const expandNotebook = useNotebookExpandStore(s => s.expand);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.notebook.name);
  const [isGitEnabled, setIsGitEnabled] = useState(false);
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [showCommitHistory, setShowCommitHistory] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [iconPicker, setIconPicker] = useState<IconPickerAnchor | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canDrag, setCanDrag] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const hasChildren = node.children.length > 0;
  const isInbox = node.notebook.id === 'inbox';
  const canHaveChildren = depth < 2; // Max 3 levels (0, 1, 2)
  const Icon = notebookLucideIcon(
    node.notebook.icon,
    isInbox ? 'inbox' : node.notebook.id === 'templates' ? 'file-stack' : 'folder'
  );
  const pluginMenuItems = useStore(pluginContextMenuStore, state => state.items).filter(
    item => item.target === 'notebook-item'
  );

  // Memoize descendant IDs for circular reference prevention
  const descendantIds = useMemo(() => collectDescendantIds(node), [node]);

  // Check git status on mount
  useEffect(() => {
    const checkGitStatus = async () => {
      try {
        const result = await window.dripnex.notebooks.isGitEnabled(node.notebook.id);
        if (result.success && result.enabled !== undefined) {
          setIsGitEnabled(result.enabled);
        }
      } catch (error) {
        console.error('Failed to check git status:', error);
      }
    };
    void checkGitStatus();
  }, [node.notebook.id]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(node.notebook.id);
    },
    [node.notebook.id, onSelect]
  );

  const handleDetail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEnterWorkspace?.(node.notebook.id);
    },
    [node.notebook.id, onEnterWorkspace]
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpanded(node.notebook.id);
    },
    [node.notebook.id, toggleExpanded]
  );

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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (isInbox) return;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY });
    },
    [isInbox]
  );

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const handleToggleGit = useCallback(async () => {
    setMenu(null);
    setIsGitLoading(true);
    try {
      if (isGitEnabled) {
        await window.dripnex.notebooks.disableGit(node.notebook.id);
        setIsGitEnabled(false);
      } else {
        const result = await window.dripnex.git.init(node.notebook.id);
        if (result.success) {
          await window.dripnex.notebooks.enableGit(node.notebook.id);
          setIsGitEnabled(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle git:', error);
      alert(`Failed to ${isGitEnabled ? 'disable' : 'enable'} git: ${error}`);
    } finally {
      setIsGitLoading(false);
    }
  }, [node.notebook.id, isGitEnabled]);

  const handleShowHistory = useCallback(() => {
    setMenu(null);
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
        expandNotebook(node.notebook.id);
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
      expandNotebook,
    ]
  );

  return (
    <li className={sc('notebook-item')} role="treeitem" aria-expanded={isExpanded}>
      <div
        ref={rowRef}
        className={sc(
          'notebook-item-row',
          isSelected && 'selected',
          isInPath && 'in-path',
          dropPosition && `drop-${dropPosition}`,
          isDragging && 'dragging'
        )}
        style={depth > 0 ? { paddingLeft: `${8 + depth * 16}px` } : undefined}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
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
        <span
          className={sc('notebook-item-lead')}
          onMouseEnter={() => {
            if (!isInbox && !isEditing) setCanDrag(true);
          }}
          onMouseLeave={() => setCanDrag(false)}
        >
          {!isInbox && !isEditing ? (
            <span className={sc('notebook-item-drag-handle')} aria-hidden="true">
              <GripVertical size={12} />
            </span>
          ) : null}
          {hasChildren ? (
            <button
              type="button"
              className={sc('notebook-item-toggle')}
              onClick={handleToggle}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown size={12} aria-hidden="true" />
              ) : (
                <ChevronRight size={12} aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className={sc('notebook-item-toggle-slot')} aria-hidden="true" />
          )}
          <span className={sc('notebook-item-icon')} aria-hidden="true">
            <Icon size={15} />
          </span>
        </span>

        {isGitEnabled && !isInbox && (
          <span
            className={sc('notebook-item-git-badge')}
            aria-label="Git enabled"
            title="Git enabled"
          >
            <GitBranch size={10} />
          </span>
        )}

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className={sc('notebook-item-edit-form')}>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditSubmit}
              autoFocus
              className={sc('notebook-item-edit-input')}
            />
          </form>
        ) : (
          <span className={sc('notebook-item-name')}>{node.notebook.name}</span>
        )}

        {noteCount !== undefined && noteCount > 0 && (
          <span className={sc('sidebar-row-count')} aria-label={`${noteCount} notes`}>
            {noteCount}
          </span>
        )}

        {onEnterWorkspace && workspaceRootId !== node.notebook.id ? (
          <button
            type="button"
            className={sc('notebook-item-detail')}
            onClick={handleDetail}
            title="Switch to workspace view"
          >
            Detail
            <ChevronRight
              size={10}
              className={sc('notebook-item-detail-chevron')}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      {hasChildren && isExpanded && (
        <ul className={sc('notebook-item-children')} role="group">
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
              onEnterWorkspace={onEnterWorkspace}
              onRename={onRename}
              onDelete={onDelete}
              onCreateChild={onCreateChild}
              onSetIcon={onSetIcon}
              onMove={onMove}
              onReorder={onReorder}
              siblingIds={node.children.map(c => c.notebook.id)}
            />
          ))}
        </ul>
      )}

      {menu
        ? createPortal(
            <div
              className={sc('notebook-menu')}
              style={{ top: menu.y, left: menu.x }}
              role="menu"
              onMouseDown={event => event.stopPropagation()}
            >
              {canHaveChildren ? (
                <button
                  type="button"
                  className={sc('notebook-menu-item')}
                  onClick={() => {
                    setMenu(null);
                    onCreateChild(node.notebook.id);
                  }}
                >
                  <Plus size={14} aria-hidden="true" />
                  New sub-notebook
                </button>
              ) : null}
              <button
                type="button"
                className={sc('notebook-menu-item')}
                onClick={() => {
                  if (!menu) return;
                  setIconPicker({
                    top: menu.y,
                    left: menu.x,
                    bottom: menu.y + 8,
                    right: menu.x + 8,
                  });
                  setMenu(null);
                }}
              >
                <Smile size={14} aria-hidden="true" />
                Change icon
              </button>
              <button
                type="button"
                className={sc('notebook-menu-item')}
                onClick={() => void handleToggleGit()}
                disabled={isGitLoading}
              >
                <GitBranch size={14} aria-hidden="true" />
                {isGitEnabled ? 'Disable Git' : 'Enable Git'}
              </button>
              {isGitEnabled ? (
                <button
                  type="button"
                  className={sc('notebook-menu-item')}
                  onClick={handleShowHistory}
                >
                  <History size={14} aria-hidden="true" />
                  Commit history
                </button>
              ) : null}
              <button
                type="button"
                className={sc('notebook-menu-item', 'notebook-menu-item--danger')}
                onClick={() => {
                  setMenu(null);
                  if (confirm(`Delete "${node.notebook.name}"? Notes will move to Inbox.`)) {
                    onDelete(node.notebook.id);
                  }
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </button>
              {pluginMenuItems.length > 0
                ? pluginMenuItems.map(item => (
                    <button
                      key={item.commandId}
                      type="button"
                      className={sc('notebook-menu-item')}
                      onClick={() => {
                        setMenu(null);
                        void dispatchCommand(item.commandId, { notebookId: node.notebook.id });
                      }}
                    >
                      {item.label}
                    </button>
                  ))
                : null}
            </div>,
            document.body
          )
        : null}

      {showCommitHistory && (
        <CommitHistory
          notebookId={node.notebook.id}
          notebookName={node.notebook.name}
          onClose={() => setShowCommitHistory(false)}
        />
      )}

      {iconPicker ? (
        <NotebookIconPicker
          current={node.notebook.icon}
          anchor={iconPicker}
          onSelect={icon => {
            onSetIcon(node.notebook.id, icon);
            setIconPicker(null);
          }}
          onClose={() => setIconPicker(null)}
        />
      ) : null}
    </li>
  );
});
