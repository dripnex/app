import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  Archive,
  Search,
  X,
  FolderOpen,
  Inbox,
  Folder,
  Check,
  Copy,
  ArchiveRestore,
  Trash2,
  SquarePen,
  ArrowUpDown,
} from 'lucide-react';
import type { NotebookSnapshot } from '../../preload/index';
import { useNotebookList, useNotebook } from '../hooks/useNotebooks';
import type { NoteWithExcerpt, SortBy, SortOrder } from '../hooks/useNavigation';
import { formatRelativeTime } from '../utils/date';
import type { QuickFilterType } from './sidebar';

interface NoteListProps {
  notes: NoteWithExcerpt[];
  selectedId: string | null;
  selectedNotebookId: string | null;
  selectedTag: string | null;
  selectedQuickFilter: QuickFilterType | null;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (noteId: string, notebookId: string) => void;
  onSearch: (query: string) => void;
  onNewNote: () => void;
  onSortChange: (sortBy: SortBy, sortOrder: SortOrder) => void;
  onTagClick: (tag: string) => void;
  isLoading: boolean;
}

/** Loading skeleton for note list */
function NoteListSkeleton() {
  return (
    <div className="note-list-skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-title" />
          <div className="skeleton-meta" />
          <div className="skeleton-preview" />
        </div>
      ))}
    </div>
  );
}

/** Sort options configuration */
const SORT_OPTIONS: Array<{ value: SortBy; label: string; order: SortOrder }> = [
  { value: 'updatedAt', label: 'Last Updated', order: 'desc' },
  { value: 'createdAt', label: 'Date Created', order: 'desc' },
  { value: 'title', label: 'Title A-Z', order: 'asc' },
  { value: 'title', label: 'Title Z-A', order: 'desc' },
];

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
      title: 'No archived notes',
      hint: 'Archived notes will appear here',
    },
    'no-results': {
      icon: <Search size={32} />,
      title: 'No matches found',
      hint: 'Try a different search term',
    },
  };

  const { icon, title, hint } = content[variant];

  return (
    <div className="note-list-empty" role="status" aria-live="polite">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-title">{title}</p>
      <p className="empty-hint">{hint}</p>
    </div>
  );
}

export function NoteList({
  notes,
  selectedId,
  selectedNotebookId,
  selectedTag,
  selectedQuickFilter,
  sortBy,
  sortOrder,
  onSelect,
  onDelete,
  onArchive,
  onDuplicate,
  onMove,
  onSearch,
  onNewNote,
  onSortChange,
  onTagClick,
  isLoading,
}: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const { data: notebooks = [] } = useNotebookList();
  const { data: notebook } = useNotebook(selectedNotebookId);

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

  // Get header title based on navigation context
  const getHeaderTitle = () => {
    if (selectedQuickFilter === 'pinned') return 'Pinned';
    if (selectedQuickFilter === 'trash') return 'Trash';
    if (selectedTag) return `#${selectedTag}`;
    if (selectedNotebookId && notebook) return notebook.name;
    return 'All Notes';
  };

  // Close sort dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortDropdown]);

  // Check if a sort option is active
  const isSortActive = (option: typeof SORT_OPTIONS[number]) => {
    return sortBy === option.value && sortOrder === option.order;
  };

  return (
    <nav className="note-list" aria-label="Notes navigation">
      {/* Header Toolbar */}
      <div className="note-list-header">
        <div className="sort-btn-container" ref={sortDropdownRef}>
          <button
            type="button"
            className="header-btn"
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            aria-label="Sort notes"
            aria-expanded={showSortDropdown}
            aria-haspopup="menu"
          >
            <ArrowUpDown size={16} aria-hidden="true" />
          </button>
          {showSortDropdown && (
            <div className="sort-dropdown" role="menu">
              {SORT_OPTIONS.map((option, index) => (
                <button
                  key={`${option.value}-${option.order}-${index}`}
                  type="button"
                  role="menuitem"
                  className={`sort-option ${isSortActive(option) ? 'active' : ''}`}
                  onClick={() => {
                    onSortChange(option.value, option.order);
                    setShowSortDropdown(false);
                  }}
                >
                  <span>{option.label}</span>
                  {isSortActive(option) && (
                    <span className="check-icon">
                      <Check size={14} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="header-title">{getHeaderTitle()}</span>
        <button
          type="button"
          className="header-btn"
          onClick={onNewNote}
          aria-label="Create new note"
        >
          <SquarePen size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Search bar with icon */}
      <div className="note-list-search">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" aria-hidden="true" />
          <label htmlFor="note-search" className="visually-hidden">
            Search notes
          </label>
          <input
            id="note-search"
            type="search"
            placeholder="Search"
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
            aria-describedby={searchQuery ? 'search-status' : undefined}
          />
          {searchQuery && (
            <button
              className="search-clear"
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
      </div>

      {/* Note list content */}
      <div className="note-list-content" aria-busy={isLoading}>
        {isLoading ? (
          <NoteListSkeleton />
        ) : notes.length === 0 ? (
          <EmptyState variant={getEmptyVariant()} />
        ) : (
          <ul className="note-list-items" role="listbox" aria-label="Notes">
            {notes.map(note => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={note.id === selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                onArchive={onArchive}
                onDuplicate={onDuplicate}
                onMove={onMove}
                onTagClick={onTagClick}
                notebooks={notebooks}
                isArchived={note.isArchived}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

interface NoteListItemProps {
  note: NoteWithExcerpt;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (noteId: string, notebookId: string) => void;
  onTagClick: (tag: string) => void;
  notebooks: NotebookSnapshot[];
  isArchived: boolean;
}

function NoteListItem({
  note,
  isSelected,
  onSelect,
  onDelete,
  onArchive,
  onDuplicate,
  onMove,
  onTagClick,
  notebooks,
  isArchived,
}: NoteListItemProps) {
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMoveDropdown(false);
      }
    };

    if (showMoveDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoveDropdown]);

  const handleMove = (notebookId: string) => {
    if (notebookId !== note.notebookId) {
      onMove(note.id, notebookId);
    }
    setShowMoveDropdown(false);
  };

  return (
    <li
      role="option"
      aria-selected={isSelected}
      className={`note-list-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(note.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(note.id);
        }
      }}
      tabIndex={0}
    >
      <div className="note-list-item-title">{note.title || 'Untitled'}</div>
      <div className="note-list-item-meta">
        <span className="timestamp">{formatRelativeTime(note.updatedAt)}</span>
        {note.tags.length > 0 && (
          <span className="tags">
            {note.tags.slice(0, 2).map(tag => (
              <button
                key={tag}
                type="button"
                className="tag-badge tag-badge-clickable"
                onClick={e => {
                  e.stopPropagation();
                  onTagClick(tag);
                }}
              >
                {tag}
              </button>
            ))}
          </span>
        )}
      </div>
      {note.excerpt && (
        <div className="note-list-item-preview">{note.excerpt}</div>
      )}
      <div className="note-list-item-actions" role="group" aria-label="Note actions">
        <div className="action-btn-container" ref={dropdownRef}>
          <button
            type="button"
            className="action-btn"
            onClick={e => {
              e.stopPropagation();
              setShowMoveDropdown(!showMoveDropdown);
            }}
            aria-label="Move to notebook"
            aria-expanded={showMoveDropdown}
            aria-haspopup="menu"
            title="Move"
          >
            <FolderOpen size={14} />
          </button>
          {showMoveDropdown && (
            <div className="move-dropdown" role="menu">
              {notebooks.map(nb => (
                <button
                  key={nb.id}
                  type="button"
                  role="menuitem"
                  className={`move-dropdown-item ${nb.id === note.notebookId ? 'current' : ''}`}
                  style={{ paddingLeft: `${nb.depth * 12 + 8}px` }}
                  onClick={e => {
                    e.stopPropagation();
                    handleMove(nb.id);
                  }}
                >
                  <span className="notebook-icon">
                    {nb.id === 'inbox' ? <Inbox size={12} /> : <Folder size={12} />}
                  </span>
                  <span className="notebook-name">{nb.name}</span>
                  {nb.id === note.notebookId && (
                    <span className="current-mark">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="action-btn"
          onClick={e => {
            e.stopPropagation();
            onDuplicate(note.id);
          }}
          aria-label="Duplicate note"
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="action-btn"
          onClick={e => {
            e.stopPropagation();
            onArchive(note.id);
          }}
          aria-label={isArchived ? 'Restore note' : 'Archive note'}
          title={isArchived ? 'Restore' : 'Archive'}
        >
          {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        </button>
        <button
          type="button"
          className="action-btn danger"
          onClick={e => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          aria-label="Delete note permanently"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
