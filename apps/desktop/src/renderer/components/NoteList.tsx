import { useState, useCallback } from 'react'
import type { NoteSnapshot } from '../../preload/index'

interface NoteListProps {
  notes: NoteSnapshot[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onDuplicate: (id: string) => void
  onSearch: (query: string) => void
  isLoading: boolean
  viewMode: 'active' | 'archived'
  onViewModeChange: (mode: 'active' | 'archived') => void
}

export function NoteList({
  notes,
  selectedId,
  onSelect,
  onDelete,
  onArchive,
  onDuplicate,
  onSearch,
  isLoading,
  viewMode,
  onViewModeChange,
}: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    onSearch(query)
  }, [onSearch])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    onSearch('')
  }, [onSearch])

  return (
    <div className="note-list">
      {/* Search bar */}
      <div className="note-list-search">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
        {searchQuery && (
          <button className="search-clear" onClick={clearSearch}>
            ×
          </button>
        )}
      </div>

      {/* View mode tabs */}
      <div className="note-list-tabs">
        <button
          className={`tab ${viewMode === 'active' ? 'active' : ''}`}
          onClick={() => onViewModeChange('active')}
        >
          Notes
        </button>
        <button
          className={`tab ${viewMode === 'archived' ? 'active' : ''}`}
          onClick={() => onViewModeChange('archived')}
        >
          Archive
        </button>
      </div>

      {/* Note list content */}
      <div className="note-list-content">
        {isLoading ? (
          <div className="note-list-loading">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="note-list-empty">
            {searchQuery ? (
              <>
                <p>No matches</p>
                <p className="hint">Try a different search</p>
              </>
            ) : viewMode === 'archived' ? (
              <>
                <p>No archived notes</p>
                <p className="hint">Archived notes appear here</p>
              </>
            ) : (
              <>
                <p>No notes yet</p>
                <p className="hint">Create your first note</p>
              </>
            )}
          </div>
        ) : (
          notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isSelected={note.id === selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onArchive={onArchive}
              onDuplicate={onDuplicate}
              isArchived={viewMode === 'archived'}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface NoteListItemProps {
  note: NoteSnapshot
  isSelected: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onDuplicate: (id: string) => void
  isArchived: boolean
}

function NoteListItem({
  note,
  isSelected,
  onSelect,
  onDelete,
  onArchive,
  onDuplicate,
  isArchived,
}: NoteListItemProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className={`note-list-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(note.id)}
    >
      <div className="note-list-item-title">{note.title || 'Untitled'}</div>
      <div className="note-list-item-meta">
        <span className="date">{formatDate(note.updatedAt)}</span>
        <span className="words">{note.wordCount} words</span>
        {note.tags.length > 0 && (
          <span className="tags">
            {note.tags.slice(0, 2).map(tag => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </span>
        )}
      </div>
      <div className="note-list-item-actions">
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate(note.id)
          }}
          title="Duplicate"
        >
          ⧉
        </button>
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation()
            onArchive(note.id)
          }}
          title={isArchived ? 'Restore' : 'Archive'}
        >
          {isArchived ? '↩' : '⊘'}
        </button>
        <button
          className="action-btn danger"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(note.id)
          }}
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  )
}
