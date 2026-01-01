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
} from 'lucide-react';
import type { NoteSnapshot, NotebookSnapshot } from '../../preload/index';
import { useNotebookList } from '../hooks/useNotebooks';
import { Breadcrumb } from './Breadcrumb';

interface NoteListProps {
  notes: NoteSnapshot[];
  selectedId: string | null;
  selectedNotebookId: string | null;
  onSelect: (id: string) => void;
  onSelectNotebook: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (noteId: string, notebookId: string) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  viewMode: 'active' | 'archived';
  onViewModeChange: (mode: 'active' | 'archived') => void;
}

/** Loading skeleton for note list */
function NoteListSkeleton() {
  return (
    <div className="note-list-skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-title" />
          <div className="skeleton-meta" />
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
  onSelect,
  onSelectNotebook,
  onDelete,
  onArchive,
  onDuplicate,
  onMove,
  onSearch,
  isLoading,
  viewMode,
  onViewModeChange,
}: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: notebooks = [] } = useNotebookList();

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
    if (viewMode === 'archived') return 'no-archived';
    return 'no-notes';
  };

  return (
    <nav className="note-list" aria-label="Notes navigation">
      {/* Search bar */}
      <div className="note-list-search">
        <label htmlFor="note-search" className="visually-hidden">
          Search notes
        </label>
        <input
          id="note-search"
          type="search"
          placeholder="Search notes..."
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
        {searchQuery && (
          <span id="search-status" className="visually-hidden">
            {isLoading ? 'Searching...' : `${notes.length} results`}
          </span>
        )}
      </div>

      {/* Breadcrumb navigation */}
      <Breadcrumb selectedNotebookId={selectedNotebookId} onNavigate={onSelectNotebook} />

      {/* View mode tabs */}
      <div className="note-list-tabs" role="tablist" aria-label="Note views">
        <button
          role="tab"
          aria-selected={viewMode === 'active'}
          aria-controls="notes-panel"
          className={`tab ${viewMode === 'active' ? 'active' : ''}`}
          onClick={() => onViewModeChange('active')}
        >
          Notes
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'archived'}
          aria-controls="notes-panel"
          className={`tab ${viewMode === 'archived' ? 'active' : ''}`}
          onClick={() => onViewModeChange('archived')}
        >
          Archive
        </button>
      </div>

      {/* Note list content */}
      <div id="notes-panel" role="tabpanel" className="note-list-content" aria-busy={isLoading}>
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
                notebooks={notebooks}
                isArchived={viewMode === 'archived'}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

interface NoteListItemProps {
  note: NoteSnapshot;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (noteId: string, notebookId: string) => void;
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
  notebooks,
  isArchived,
}: NoteListItemProps) {
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

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
        <span className="date">{formatDate(note.updatedAt)}</span>
        <span className="words">{note.wordCount} words</span>
        {note.tags.length > 0 && (
          <span className="tags">
            {note.tags.slice(0, 2).map(tag => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </span>
        )}
      </div>
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
