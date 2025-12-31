import type { NoteSnapshot } from '../../preload/index'

interface NoteListProps {
  notes: NoteSnapshot[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onDuplicate: (id: string) => void
  isLoading: boolean
}

export function NoteList({
  notes,
  selectedId,
  onSelect,
  onDelete,
  onArchive,
  onDuplicate,
  isLoading,
}: NoteListProps) {
  if (isLoading) {
    return (
      <div className="note-list">
        <div className="note-list-loading">Loading...</div>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="note-list">
        <div className="note-list-empty">
          <p>No notes yet</p>
          <p className="hint">Create your first note</p>
        </div>
      </div>
    )
  }

  return (
    <div className="note-list">
      {notes.map((note) => (
        <NoteListItem
          key={note.id}
          note={note}
          isSelected={note.id === selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onArchive={onArchive}
          onDuplicate={onDuplicate}
        />
      ))}
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
}

function NoteListItem({
  note,
  isSelected,
  onSelect,
  onDelete,
  onArchive,
  onDuplicate,
}: NoteListItemProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    // Context menu will be added later
  }

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
      onContextMenu={handleContextMenu}
    >
      <div className="note-list-item-title">{note.title || 'Untitled'}</div>
      <div className="note-list-item-meta">
        <span className="date">{formatDate(note.updatedAt)}</span>
        <span className="words">{note.wordCount} words</span>
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
          title="Archive"
        >
          ⊘
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
