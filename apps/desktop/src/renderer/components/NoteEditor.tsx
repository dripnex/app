import { useRef, useCallback } from 'react'
import type { NoteSnapshot } from '../../preload/index'
import { MarkdownEditor } from './MarkdownEditor'

interface NoteEditorProps {
  note: NoteSnapshot | null
  onUpdate: (content: string) => void
}

export function NoteEditor({ note, onUpdate }: NoteEditorProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Handle content change with debounce
  const handleChange = useCallback((content: string) => {
    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce save (500ms)
    debounceRef.current = setTimeout(() => {
      onUpdate(content)
    }, 500)
  }, [onUpdate])

  if (!note) {
    return (
      <div className="note-editor">
        <div className="note-editor-empty">
          <p>Select a note or create a new one</p>
        </div>
      </div>
    )
  }

  return (
    <div className="note-editor">
      <div className="note-editor-header">
        <span className="note-editor-title">{note.title || 'Untitled'}</span>
        <span className="note-editor-meta">
          {note.wordCount} words
        </span>
      </div>
      <div className="note-editor-body">
        <MarkdownEditor
          key={note.id}
          initialContent={note.content}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
