import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NoteSnapshot } from '../preload/index';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { Sidebar } from './components/Sidebar';
import { TrialBanner } from './components/TrialBanner';
import { LicenseDialog } from './components/LicenseDialog';
import { LicenseProvider } from './contexts/LicenseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useNotes, useSearchNotes, useNoteMutations } from './hooks/useNotes';
import { useNotebookTree } from './hooks/useNotebooks';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function NotesApp() {
  const [selectedNote, setSelectedNote] = useState<NoteSnapshot | null>(null);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>('inbox');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const notesQuery = useNotes({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    archived: viewMode,
  });

  const searchNotesQuery = useSearchNotes(debouncedSearch, 50);
  const { data: _notebookTree } = useNotebookTree();

  // Mutations
  const { createNote, updateNote, deleteNote, archiveNote, restoreNote, duplicateNote, moveNote } =
    useNoteMutations();

  // Compute displayed notes based on search and notebook filter
  const notes = useMemo(() => {
    let filteredNotes: NoteSnapshot[];

    if (debouncedSearch.trim()) {
      const searchResults = searchNotesQuery.data ?? [];
      filteredNotes = viewMode === 'archived'
        ? searchResults.filter(n => n.isArchived)
        : searchResults.filter(n => !n.isArchived);
    } else {
      filteredNotes = notesQuery.data ?? [];
    }

    // Filter by selected notebook
    if (selectedNotebookId) {
      filteredNotes = filteredNotes.filter(n => n.notebookId === selectedNotebookId);
    }

    return filteredNotes;
  }, [debouncedSearch, searchNotesQuery.data, notesQuery.data, viewMode, selectedNotebookId]);

  const isLoading =
    notesQuery.isLoading || (debouncedSearch.trim() !== '' && searchNotesQuery.isLoading);

  // Handle search with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(query);
    }, 300);
  }, []);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: 'active' | 'archived') => {
    setViewMode(mode);
    setSelectedNote(null);
  }, []);

  // Create new note
  const handleNewNote = useCallback(async () => {
    const newNote = await createNote.mutateAsync({ content: '# Untitled\n\n' });
    setSelectedNote(newNote);
    setViewMode('active');
    setSearchQuery('');
    setDebouncedSearch('');
  }, [createNote]);

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
      const updated = await updateNote.mutateAsync({ id: selectedNote.id, content });
      setSelectedNote(updated);
    },
    [selectedNote, updateNote]
  );

  // Delete note
  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote.mutateAsync(id);
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
    },
    [selectedNote, deleteNote]
  );

  // Archive or restore note based on view mode
  const handleArchiveNote = useCallback(
    async (id: string) => {
      if (viewMode === 'archived') {
        await restoreNote.mutateAsync(id);
      } else {
        await archiveNote.mutateAsync(id);
      }
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
    },
    [selectedNote, viewMode, archiveNote, restoreNote]
  );

  // Duplicate note
  const handleDuplicateNote = useCallback(
    async (id: string) => {
      const duplicated = await duplicateNote.mutateAsync(id);
      setSelectedNote(duplicated);
      if (viewMode === 'archived') {
        setViewMode('active');
      }
    },
    [viewMode, duplicateNote]
  );

  // Move note to notebook
  const handleMoveNote = useCallback(
    async (noteId: string, notebookId: string) => {
      await moveNote.mutateAsync({ noteId, notebookId });
    },
    [moveNote]
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
          setDebouncedSearch('');
        } else if (selectedNote) {
          setSelectedNote(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewNote, handleDuplicateNote, selectedNote, searchQuery]);

  return (
    <LicenseProvider>
      <div className="app">
        <TrialBanner />
        <div className="app__content">
          <Sidebar
            onNewNote={handleNewNote}
            selectedNotebookId={selectedNotebookId}
            onSelectNotebook={setSelectedNotebookId}
          />
          <NoteList
            notes={notes}
            selectedId={selectedNote?.id ?? null}
            selectedNotebookId={selectedNotebookId}
            onSelect={handleSelectNote}
            onSelectNotebook={setSelectedNotebookId}
            onDelete={handleDeleteNote}
            onArchive={handleArchiveNote}
            onDuplicate={handleDuplicateNote}
            onMove={handleMoveNote}
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
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NotesApp />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
