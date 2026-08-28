import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Archive,
  Search,
  Filter,
  X,
  SquarePen,
  FileStack,
  Files,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Pin,
  PinOff,
  Globe,
  FileText,
} from 'lucide';
import { LayoutZone } from '@dripnex/plugin-api';
import { Icon } from '../ui/icons/Icon';
import { useNotebookList, useNotebook } from '../hooks/useNotebooks';
import type { NoteWithExcerpt, SortBy, SortOrder } from '../hooks/useNavigation';
import type { NoteStatus } from '../../preload/index';
import { formatRelativeTime } from '../utils/date';
import { useTagColorsStore } from '../stores/tagColorsStore';
import { useShareStore, selectIsShared } from '../stores/shareStore';
import { kindFromTags, kindMeta } from '../lib/knowledge';
import { cssm } from '../lib/cssm';
import { dispatchCommand } from '../hooks/useCommandRegistry';
import { IconButton } from '../ui/primitives';
import { noteListNavDirection } from '../utils/noteListKeys';
import { modAccel } from '../utils/modAccel';
import { playListEnter, playMotion } from '../motion/gsapRuntime';
import { elementsForNoteIds, planListEnter } from '../motion/listEnter';
import type { QuickFilterType } from './sidebar';
import { NoteListContextMenu } from './NoteListContextMenu';
import { NotebookPicker } from './NotebookPicker';
import { TemplatePicker } from './TemplatePicker/TemplatePicker';
import styles from './NoteList.module.css';

const sc = cssm(styles);

const STATUS_LABEL: Record<NoteStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  dropped: 'Dropped',
};

interface NoteListProps {
  notes: NoteWithExcerpt[];
  selectedId: string | null;
  selectedNotebookId: string | null;
  selectedTag: string | null;
  selectedStatus: NoteStatus | null;
  selectedQuickFilter: QuickFilterType | null;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRestoreDeleted: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPin: (id: string) => void;
  onMove: (noteId: string, notebookId: string) => void;
  onSearch: (query: string) => void;
  onNewNote: () => void;
  onSortChange: (sortBy: SortBy, sortOrder: SortOrder) => void;
  onCreateFromTemplate?: (noteId: string) => void;
  onTagClick: (tag: string) => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  isLoading: boolean;
}

/** Loading skeleton for note list */
function NoteListSkeleton() {
  return (
    <div className={sc('note-list-skeleton')} aria-hidden="true">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={sc('skeleton-item')}>
          <div className={sc('skeleton-title')} />
          <div className={sc('skeleton-meta')} />
          <div className={sc('skeleton-preview')} />
        </div>
      ))}
    </div>
  );
}

/** Empty state with icon and context-aware messaging */
function EmptyState({
  variant,
}: {
  variant: 'no-notes' | 'no-archived' | 'no-results' | 'no-pinned';
}) {
  const content = {
    'no-notes': {
      icon: <Icon icon={FileText} size={28} />,
      title: 'No notes yet',
      hint: `Press ${modAccel('N')}. Messy input is enough`,
    },
    'no-archived': {
      icon: <Icon icon={Archive} size={28} />,
      title: 'Trash is empty',
      hint: 'Deleted notes appear here',
    },
    'no-results': {
      icon: <Icon icon={Search} size={28} />,
      title: 'No matches',
      hint: 'Try a different search',
    },
    'no-pinned': {
      icon: <Icon icon={Pin} size={28} />,
      title: 'Nothing pinned',
      hint: 'Pin a note to keep it here',
    },
  };

  const { icon, title, hint } = content[variant];

  return (
    <div className={sc('note-list-empty')} role="status" aria-live="polite">
      <span className={sc('empty-icon')} aria-hidden="true">
        {icon}
      </span>
      <p className={sc('empty-title')}>{title}</p>
      <p className={sc('empty-hint')}>{hint}</p>
    </div>
  );
}

/** Context menu state */
interface ContextMenuState {
  noteId: string;
  notebookId: string | null;
  isArchived: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  x: number;
  y: number;
}

/** Notebook picker state */
interface NotebookPickerState {
  noteId: string;
  currentNotebookId: string | null;
}

export function NoteList({
  notes,
  selectedId,
  selectedNotebookId,
  selectedTag,
  selectedStatus,
  selectedQuickFilter,
  sortBy: _sortBy,
  sortOrder: _sortOrder,
  onSelect,
  onDelete,
  onRestoreDeleted,
  onPermanentDelete,
  onArchive,
  onDuplicate,
  onPin,
  onMove,
  onSearch,
  onNewNote,
  onSortChange: _onSortChange,
  onCreateFromTemplate,
  onTagClick,
  onToggleSidebar,
  sidebarCollapsed,
  isLoading,
}: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [notebookPicker, setNotebookPicker] = useState<NotebookPickerState | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const { data: notebooks = [] } = useNotebookList();
  const { data: notebook } = useNotebook(selectedNotebookId);
  const listItemsRef = useRef<HTMLUListElement | null>(null);
  const seenNoteIdsRef = useRef(new Set<string>());
  const prevSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const selected = listItemsRef.current?.querySelector('[aria-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const noteIdsKey = notes.map(n => n.id).join('\0');

  useLayoutEffect(() => {
    const noteIds = noteIdsKey ? noteIdsKey.split('\0') : [];
    if (!listItemsRef.current) {
      if (noteIds.length === 0) seenNoteIdsRef.current = new Set();
      return;
    }

    const plan = planListEnter({
      noteIds,
      seenIds: seenNoteIdsRef.current,
    });
    seenNoteIdsRef.current = new Set(noteIds);

    if (plan.mode !== 'none') {
      playListEnter(elementsForNoteIds(plan.ids));
      prevSelectedIdRef.current = selectedId;
      return;
    }

    if (selectedId && selectedId !== prevSelectedIdRef.current) {
      playMotion('list-select', document.getElementById(`note-${selectedId}`));
    }
    prevSelectedIdRef.current = selectedId;
  }, [noteIdsKey, selectedId, isLoading]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = noteListNavDirection(event);
      if (!direction) return;
      event.preventDefault();
      void dispatchCommand(direction === 1 ? 'app:next-note' : 'app:prev-note');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Handler to open notebook picker from context menu
  const handleOpenNotebookPicker = useCallback(
    (noteId: string, currentNotebookId: string | null) => {
      setContextMenu(null);
      setNotebookPicker({ noteId, currentNotebookId });
    },
    []
  );

  // Handler for notebook selection
  const handleNotebookSelect = useCallback(
    (notebookId: string) => {
      if (notebookPicker) {
        onMove(notebookPicker.noteId, notebookId);
      }
      setNotebookPicker(null);
    },
    [notebookPicker, onMove]
  );

  // Blur policy: set data-overlay-open when picker is open
  useEffect(() => {
    document.documentElement.dataset.overlayOpen = notebookPicker ? 'true' : 'false';
    return () => {
      document.documentElement.dataset.overlayOpen = 'false';
    };
  }, [notebookPicker]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      onSearch(query);
    },
    [onSearch]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    onSearch('');
  }, [onSearch]);

  const getEmptyVariant = () => {
    if (searchQuery) return 'no-results';
    if (selectedQuickFilter === 'trash') return 'no-archived';
    if (selectedQuickFilter === 'pinned') return 'no-pinned';
    return 'no-notes';
  };

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, note: NoteWithExcerpt) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      noteId: note.id,
      notebookId: note.notebookId,
      isArchived: note.isArchived,
      isPinned: note.isPinned,
      isDeleted: note.isDeleted,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  // Get header title based on navigation context
  const getHeaderTitle = () => {
    if (selectedQuickFilter === 'pinned') return 'Pinned';
    if (selectedQuickFilter === 'trash') return 'Trash';
    if (selectedStatus === 'active') return 'Active';
    if (selectedStatus === 'on_hold') return 'On Hold';
    if (selectedStatus === 'completed') return 'Completed';
    if (selectedStatus === 'dropped') return 'Dropped';
    if (selectedTag) return selectedTag;
    if (selectedNotebookId && notebook) return notebook.name;
    return 'All Notes';
  };

  const selectedIndex = selectedId ? notes.findIndex(n => n.id === selectedId) : -1;
  const listPosition =
    selectedIndex >= 0 ? `${selectedIndex + 1} of ${notes.length}` : `${notes.length}`;

  return (
    <nav className={sc('note-list')} aria-label="Notes navigation" data-note-list>
      {/* Header Toolbar */}
      <div className={sc('note-list-header')}>
        {onToggleSidebar ? (
          <IconButton
            label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            pressed={!sidebarCollapsed}
            onClick={onToggleSidebar}
          >
            <Icon icon={sidebarCollapsed ? PanelLeft : PanelLeftClose} size={16} />
          </IconButton>
        ) : null}
        <span className={sc('header-title')}>{getHeaderTitle()}</span>
        <LayoutZone name="note-list-header" />
        {onCreateFromTemplate && selectedNotebookId !== 'templates' ? (
          <IconButton label="New from template" onClick={() => setTemplatePickerOpen(true)}>
            <Icon icon={FileStack} hoverIcon={Files} size={16} />
          </IconButton>
        ) : null}
        <IconButton label="Create new note" onClick={onNewNote}>
          <Icon icon={SquarePen} hoverIcon={Plus} size={16} />
        </IconButton>
      </div>

      {/* Search bar with icon + filter toggle */}
      <div className={sc('note-list-search')}>
        <div className={sc('search-input-wrapper')}>
          <Icon icon={Filter} hoverIcon={Search} size={14} className={sc('search-icon')} />
          <label htmlFor="note-search" className="visually-hidden">
            Filter notes
          </label>
          <input
            id="note-search"
            type="search"
            placeholder="Filter"
            value={searchQuery}
            onChange={handleSearchChange}
            className={sc('search-input')}
            aria-describedby={searchQuery ? 'search-status' : undefined}
          />
          {searchQuery && (
            <button
              className={sc('search-clear')}
              onClick={clearSearch}
              aria-label="Clear filter"
              type="button"
            >
              <Icon icon={X} size={14} />
            </button>
          )}
        </div>
        {searchQuery && (
          <span id="search-status" className="visually-hidden">
            {isLoading ? 'Searching...' : `${notes.length} results`}
          </span>
        )}
      </div>

      {/* Note list content */}
      <div className={sc('note-list-content')} aria-busy={isLoading}>
        {isLoading ? (
          <NoteListSkeleton />
        ) : notes.length === 0 ? (
          <EmptyState variant={getEmptyVariant()} />
        ) : (
          <ul
            ref={listItemsRef}
            className={sc('note-list-items')}
            role="listbox"
            aria-label="Notes"
            aria-activedescendant={selectedId ? `note-${selectedId}` : undefined}
          >
            {notes.map(note => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={note.id === selectedId}
                onSelect={onSelect}
                onTagClick={onTagClick}
                onContextMenu={handleContextMenu}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <NoteListContextMenu
          noteId={contextMenu.noteId}
          currentNotebookId={contextMenu.notebookId}
          isArchived={contextMenu.isArchived}
          isPinned={contextMenu.isPinned}
          isDeleted={contextMenu.isDeleted}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onPin={onPin}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
          onDelete={onDelete}
          onRestoreDeleted={onRestoreDeleted}
          onPermanentDelete={onPermanentDelete}
          onOpenPicker={handleOpenNotebookPicker}
          onCreateFromTemplate={onCreateFromTemplate}
        />
      )}

      <div className={sc('note-list-status')}>
        {notes.length > 0 ? <span className={sc('note-list-count')}>{listPosition}</span> : null}
        <LayoutZone name="note-list-footer" />
      </div>

      {/* Notebook picker modal */}
      {notebookPicker && (
        <NotebookPicker
          currentNotebookId={notebookPicker.currentNotebookId}
          notebooks={notebooks}
          onSelect={handleNotebookSelect}
          onClose={() => setNotebookPicker(null)}
        />
      )}

      {templatePickerOpen && onCreateFromTemplate ? (
        <TemplatePicker
          onSelect={onCreateFromTemplate}
          onClose={() => setTemplatePickerOpen(false)}
        />
      ) : null}
    </nav>
  );
}

interface NoteListItemProps {
  note: NoteWithExcerpt;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onTagClick: (tag: string) => void;
  onContextMenu: (e: React.MouseEvent, note: NoteWithExcerpt) => void;
}

function NoteListItem({
  note,
  isSelected,
  onSelect,
  onTagClick,
  onContextMenu,
}: NoteListItemProps) {
  const getColor = useTagColorsStore(state => state.getColor);
  const isShared = useShareStore(selectIsShared(note.id));
  const kind = kindMeta(kindFromTags(note.tags, note.status));
  const tasks = {
    total: note.taskCount ?? 0,
    completed: note.checkedTaskCount ?? 0,
  };
  const [showUnpinEffect, setShowUnpinEffect] = useState(false);
  const prevPinnedRef = useRef(note.isPinned);

  // Detect unpin transition (pinned → unpinned)
  useEffect(() => {
    if (prevPinnedRef.current && !note.isPinned) {
      setShowUnpinEffect(true);
      const timer = setTimeout(() => setShowUnpinEffect(false), 600);
      return () => clearTimeout(timer);
    }
    prevPinnedRef.current = note.isPinned;
  }, [note.isPinned]);

  return (
    <li
      id={`note-${note.id}`}
      role="option"
      aria-selected={isSelected}
      className={sc('note-list-item', isSelected && 'selected')}
      onClick={() => onSelect(note.id)}
      onContextMenu={e => onContextMenu(e, note)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(note.id);
        }
      }}
      tabIndex={0}
    >
      <div className={sc('note-list-item-title')}>
        <span className={sc('kind-dot')} style={{ background: kind.color }} title={kind.label} />
        {note.isPinned && (
          <Icon icon={Pin} size={12} className={sc('pin-icon')} aria-label="Pinned" />
        )}
        {showUnpinEffect && (
          <Icon icon={PinOff} size={12} className={sc('unpin-icon')} aria-hidden="true" />
        )}
        {isShared && (
          <Icon icon={Globe} size={12} className={sc('share-icon')} aria-label="Shared" />
        )}
        {note.title || 'Untitled'}
      </div>
      <div className={sc('note-list-item-meta')}>
        <span className={sc('timestamp')}>{formatRelativeTime(note.updatedAt)}</span>
        {note.status !== 'active' ? (
          <span className={sc('status-chip', `status-chip--${note.status}`)}>
            {STATUS_LABEL[note.status]}
          </span>
        ) : null}
        {tasks.total > 0 ? (
          <span className={sc('task-progress')}>
            {tasks.completed} of {tasks.total}
          </span>
        ) : null}
        {note.tags.length > 0 && (
          <span className={sc('tags')}>
            {note.tags.slice(0, 2).map(tag => {
              const color = getColor(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={sc('tag-badge', 'tag-badge-clickable')}
                  onClick={e => {
                    e.stopPropagation();
                    onTagClick(tag);
                  }}
                >
                  {color && (
                    <span
                      className={sc('tag-badge-dot')}
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  )}
                  {tag}
                </button>
              );
            })}
          </span>
        )}
        <LayoutZone
          name="note-list-item-suffix"
          meta={{ noteId: note.id, title: note.title, notebookId: note.notebookId }}
        />
      </div>
      {note.excerpt && <div className={sc('note-list-item-preview')}>{note.excerpt}</div>}
    </li>
  );
}
