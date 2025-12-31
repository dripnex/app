import { useState, useEffect, useCallback, useRef } from 'react';
import type { NoteSnapshot } from '../preload/index';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { Sidebar } from './components/Sidebar';
import { TrialBanner } from './components/TrialBanner';
import { LicenseDialog } from './components/LicenseDialog';
import { LicenseProvider } from './contexts/LicenseContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  const [notes, setNotes] = useState<NoteSnapshot[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load notes based on view mode and search query
  const loadNotes = useCallback(
    async (query?: string, archived?: 'active' | 'archived') => {
      setIsLoading(true);
      try {
        const currentQuery = query ?? searchQuery;
        const currentArchived = archived ?? viewMode;

        if (currentQuery.trim()) {
          // Search mode
          const list = await window.readied.notes.search(currentQuery, 50);
          // Filter by archive status
          const filtered =
            currentArchived === 'archived'
              ? list.filter(n => n.isArchived)
              : list.filter(n => !n.isArchived);
          setNotes(filtered);
        } else {
          // Normal list mode
          const list = await window.readied.notes.list({
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            archived: currentArchived,
          });
          setNotes(list);
        }
      } catch (error) {
        window.readied.log.error('Failed to load notes', { error: String(error) });
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, viewMode]
  );

  // Initial load
  useEffect(() => {
    loadNotes();
  }, []); // Only on mount

  // Reload when view mode changes
  useEffect(() => {
    loadNotes(searchQuery, viewMode);
  }, [viewMode]);

  // Handle search with debounce
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      searchDebounceRef.current = setTimeout(() => {
        loadNotes(query, viewMode);
      }, 300);
    },
    [viewMode, loadNotes]
  );

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: 'active' | 'archived') => {
    setViewMode(mode);
    setSelectedNote(null);
  }, []);

  // Create new note
  const handleNewNote = useCallback(async () => {
    const result = await window.readied.notes.create({ content: '# Untitled\n\n' });
    if (result.ok) {
      setSelectedNote(result.data);
      // Switch to active view and clear search
      setViewMode('active');
      setSearchQuery('');
      await loadNotes('', 'active');
    }
  }, [loadNotes]);

  // Select note
  const handleSelectNote = useCallback(async (id: string) => {
    const result = await window.readied.notes.get(id);
    if (result.ok) {
      setSelectedNote(result.data);
    }
  }, []);

  // Update note content
  const handleUpdateNote = useCallback(
    async (content: string) => {
      if (!selectedNote) return;
      const result = await window.readied.notes.update({ id: selectedNote.id, content });
      if (result.ok) {
        setSelectedNote(result.data);
        await loadNotes();
      }
    },
    [selectedNote, loadNotes]
  );

  // Delete note
  const handleDeleteNote = useCallback(
    async (id: string) => {
      const result = await window.readied.notes.delete(id);
      if (result.ok) {
        if (selectedNote?.id === id) {
          setSelectedNote(null);
        }
        await loadNotes();
      }
    },
    [selectedNote, loadNotes]
  );

  // Archive or restore note based on view mode
  const handleArchiveNote = useCallback(
    async (id: string) => {
      const result =
        viewMode === 'archived'
          ? await window.readied.notes.restore(id)
          : await window.readied.notes.archive(id);

      if (result.ok) {
        if (selectedNote?.id === id) {
          setSelectedNote(null);
        }
        await loadNotes();
      }
    },
    [selectedNote, viewMode, loadNotes]
  );

  // Duplicate note
  const handleDuplicateNote = useCallback(
    async (id: string) => {
      const result = await window.readied.notes.duplicate(id);
      if (result.ok) {
        setSelectedNote(result.data);
        // Switch to active view to see the duplicate
        if (viewMode === 'archived') {
          setViewMode('active');
          await loadNotes('', 'active');
        } else {
          await loadNotes();
        }
      }
    },
    [viewMode, loadNotes]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + N: New note
      if (isMod && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }

      // Cmd/Ctrl + F: Focus search
      if (isMod && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      }

      // Cmd/Ctrl + D: Duplicate current note
      if (isMod && e.key === 'd' && selectedNote) {
        e.preventDefault();
        handleDuplicateNote(selectedNote.id);
      }

      // Escape: Clear selection or search
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          loadNotes('', viewMode);
        } else if (selectedNote) {
          setSelectedNote(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewNote, handleDuplicateNote, selectedNote, searchQuery, viewMode, loadNotes]);

  return (
    <ErrorBoundary>
      <LicenseProvider>
        <div className="app">
          <TrialBanner />
          <div className="app__content">
            <Sidebar onNewNote={handleNewNote} />
            <NoteList
              notes={notes}
              selectedId={selectedNote?.id ?? null}
              onSelect={handleSelectNote}
              onDelete={handleDeleteNote}
              onArchive={handleArchiveNote}
              onDuplicate={handleDuplicateNote}
              onSearch={handleSearch}
              isLoading={isLoading}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
            <NoteEditor note={selectedNote} onUpdate={handleUpdateNote} />
          </div>
          <LicenseDialog />
        </div>
      </LicenseProvider>
    </ErrorBoundary>
  );
}
