import { useState, useEffect, useRef } from 'react'
import type { NoteSnapshot } from '../../preload/index'

interface NoteEditorProps {
  note: NoteSnapshot | null
  onUpdate: (content: string) => void
}

export function NoteEditor({ note, onUpdate }: NoteEditorProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sync content when note changes
  useEffect(() => {
    setContent(note?.content ?? '')
  }, [note?.id, note?.content])

  // Auto-focus when note changes
  useEffect(() => {
    if (note && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [note?.id])

  // Handle content change with debounce
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)

    // Debounce save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      onUpdate(newContent)
    }, 500)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

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
      <textarea
        ref={textareaRef}
        className="note-editor-content"
        value={content}
        onChange={handleChange}
        placeholder="Start writing..."
        spellCheck={false}
      />
    </div>
  )
}
