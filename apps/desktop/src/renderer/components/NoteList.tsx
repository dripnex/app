import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Sparkles,
  Archive,
  Search,
  X,
  SquarePen,
  FileStack,
  PanelLeft,
  Pin,
  PinOff,
  Globe,
} from 'lucide-react';
import { LayoutZone } from '@dripnex/plugin-api';
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
import type { QuickFilterType } from './sidebar';
import { NoteListContextMenu } from './NoteListContextMenu';
import { NotebookPicker } from './NotebookPicker';
import { TemplatePicker } from './TemplatePicker/TemplatePicker';
import styles from './NoteList.module.css';

const sc = cssm(styles);

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
function EmptyState({ variant }: { variant: 'no-notes' | 'no-archived' | 'no-results' }) {
  const content = {
    'no-notes': {
      icon: <Sparkles size={32} />,
      title: 'No notes yet',
      hint: 'Press ⌘N to create your first note',
    },
    'no-archived': {
      icon: <Archive size={32} />,
      title: 'Trash is empty',
      hint: 'Deleted notes will appear here',
    },
    'no-results': {
      icon: <Search size={32} />,
      title: 'No matches found',
      hint: 'Try a different search term',
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

  useEffect(() => {
    const selected = listItemsRef.current?.querySelector('[aria-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

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
    if (selectedQuickFilter === 'pinned') return 'no-notes';
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
            <PanelLeft size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
        <span className={sc('header-title')}>{getHeaderTitle()}</span>
        {onCreateFromTemplate && selectedNotebookId !== 'templates' ? (
          <IconButton label="New from template" onClick={() => setTemplatePickerOpen(true)}>
            <FileStack size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton label="Create new note" onClick={onNewNote}>
          <SquarePen size={16} aria-hidden="true" />
        </IconButton>
      </div>

      {/* Search bar with icon + filter toggle */}
      <div className={sc('note-list-search')}>
        <div className={sc('search-input-wrapper')}>
          <Search size={14} className={sc('search-icon')} aria-hidden="true" />
          <label htmlFor="note-search" className="visually-hidden">
            Search notes
          </label>
          <input
            id="note-search"
            type="search"
            placeholder="Search or tag:work status:active notebook:inbox"
            value={searchQuery}
            onChange={handleSearchChange}
            className={sc('search-input')}
            aria-describedby={searchQuery ? 'search-status' : undefined}
          />
          {searchQuery && (
            <button
              className={sc('search-clear')}
              onClick={clearSearch}
              aria-label="Clear search"
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchQuery && (
          <span id="search-status" className="visually-hidden">
            {isLoading ? 'Searching...' : `${notes.length} results`}
          </span>
        )}
        <p className={sc('search-hint')}>
          tag:work · status:active · notebook:inbox · is:pinned · is:trash
        </p>
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
            {notes.map((note, index) => (
              <NoteListItem
                key={note.id}
                note={note}
                index={index}
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

      {/* Plugin Note List Footer */}
      <LayoutZone name="note-list-footer" />

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
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onTagClick: (tag: string) => void;
  onContextMenu: (e: React.MouseEvent, note: NoteWithExcerpt) => void;
}

function NoteListItem({
  note,
  index,
  isSelected,
  onSelect,
  onTagClick,
  onContextMenu,
}: NoteListItemProps) {
  const getColor = useTagColorsStore(state => state.getColor);
  const isShared = useShareStore(selectIsShared(note.id));
  const kind = kindMeta(kindFromTags(note.tags, note.status));
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
      style={{ '--item-index': Math.min(index, 10) } as React.CSSProperties}
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
        {note.isPinned && <Pin size={12} className={sc('pin-icon')} aria-label="Pinned" />}
        {showUnpinEffect && <PinOff size={12} className={sc('unpin-icon')} aria-hidden="true" />}
        {isShared && <Globe size={12} className={sc('share-icon')} aria-label="Shared" />}
        {note.title || 'Untitled'}
      </div>
      <div className={sc('note-list-item-meta')}>
        <span className={sc('timestamp')}>{formatRelativeTime(note.updatedAt)}</span>
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
      </div>
      {note.excerpt && <div className={sc('note-list-item-preview')}>{note.excerpt}</div>}
    </li>
  );
}
