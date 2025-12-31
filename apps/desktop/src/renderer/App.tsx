import { useState, useEffect, useCallback } from 'react'
import type { NoteSnapshot } from '../preload/index'
import { NoteList } from './components/NoteList'
import { NoteEditor } from './components/NoteEditor'
import { Sidebar } from './components/Sidebar'

export function App() {
  const [notes, setNotes] = useState<NoteSnapshot[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load notes on mount
  const loadNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await window.readied.notes.list({ sortBy: 'updatedAt', sortOrder: 'desc' })
      setNotes(list)
    } catch (error) {
      console.error('Failed to load notes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // Create new note
  const handleNewNote = useCallback(async () => {
    const result = await window.readied.notes.create({ content: '# Untitled\n\n' })
    if (result.ok) {
      setSelectedNote(result.data)
      await loadNotes()
    }
  }, [loadNotes])

  // Select note
  const handleSelectNote = useCallback(async (id: string) => {
    const result = await window.readied.notes.get(id)
    if (result.ok) {
      setSelectedNote(result.data)
    }
  }, [])

  // Update note content
  const handleUpdateNote = useCallback(async (content: string) => {
    if (!selectedNote) return
    const result = await window.readied.notes.update({ id: selectedNote.id, content })
    if (result.ok) {
      setSelectedNote(result.data)
      await loadNotes()
    }
  }, [selectedNote, loadNotes])

  // Delete note
  const handleDeleteNote = useCallback(async (id: string) => {
    const result = await window.readied.notes.delete(id)
    if (result.ok) {
      if (selectedNote?.id === id) {
        setSelectedNote(null)
      }
      await loadNotes()
    }
  }, [selectedNote, loadNotes])

  // Archive note
  const handleArchiveNote = useCallback(async (id: string) => {
    const result = await window.readied.notes.archive(id)
    if (result.ok) {
      if (selectedNote?.id === id) {
        setSelectedNote(null)
      }
      await loadNotes()
    }
  }, [selectedNote, loadNotes])

  // Duplicate note
  const handleDuplicateNote = useCallback(async (id: string) => {
    const result = await window.readied.notes.duplicate(id)
    if (result.ok) {
      setSelectedNote(result.data)
      await loadNotes()
    }
  }, [loadNotes])

  return (
    <div className="app">
      <Sidebar onNewNote={handleNewNote} />
      <NoteList
        notes={notes}
        selectedId={selectedNote?.id ?? null}
        onSelect={handleSelectNote}
        onDelete={handleDeleteNote}
        onArchive={handleArchiveNote}
        onDuplicate={handleDuplicateNote}
        isLoading={isLoading}
      />
      <NoteEditor
        note={selectedNote}
        onUpdate={handleUpdateNote}
      />
    </div>
  )
}
