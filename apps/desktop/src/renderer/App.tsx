import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import type { NoteSnapshot, NoteStatus } from '../preload/index';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { Sidebar } from './components/sidebar';
import { LicenseProvider } from './contexts/LicenseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  useNavigation,
  useFilteredNotes,
  useSelectedNotebookId,
  useSelectedTag,
  useNavigationActions,
  useSortBy,
  useSortOrder,
  useStatusFilter,
} from './hooks/useNavigation';
import { useSearchNotes, useNoteMutations } from './hooks/useNotes';
import { useSyncLinks } from './hooks/useLinks';
import { useEditorPreferencesStore } from './stores/editorPreferencesStore';
import { useTagColorsStore } from './stores/tagColorsStore';
import { usePerformanceMode } from './hooks/usePerformanceMode';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

/**
 * Main Notes Application
 *
 * Uses Zustand for navigation state (no Provider needed).
 * All filtering is derived via useFilteredNotes hook.
 */
function NotesApp() {
  // Initialize performance mode (glass/blur tuning)
  usePerformanceMode();

  // Layout persistence
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: 'readied-main-layout',
    storage: localStorage,
  });

  // Navigation state from Zustand
  const navigation = useNavigation();
  const filteredNotes = useFilteredNotes();
  const selectedNotebookId = useSelectedNotebookId();
  const selectedTag = useSelectedTag();
  const sortBy = useSortBy();
  const sortOrder = useSortOrder();
  const statusFilter = useStatusFilter();
  const { goToAllNotes, goToTag, setSort } = useNavigationActions();

  // Editor preferences
  const cycleViewMode = useEditorPreferencesStore(state => state.cycleViewMode);

  // Load tag colors on mount (once)
  useEffect(() => {
    useTagColorsStore.getState().loadColors();
  }, []);

  // Local UI state
  const [selectedNote, setSelectedNote] = useState<NoteSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search query
  const searchNotesQuery = useSearchNotes(debouncedSearch, 50);

  // Mutations
  const {
    createNote,
    updateNote,
    updateNoteTitle,
    deleteNote,
    archiveNote,
    restoreNote,
    duplicateNote,
    moveNote,
    setNoteStatus,
    pinNote,
    unpinNote,
  } = useNoteMutations();

  // Links sync mutation
  const syncLinks = useSyncLinks();

  // Determine which notes to display
  // Both filteredNotes and searchNotesQuery.data have excerpt
  const displayedNotes = debouncedSearch.trim() ? (searchNotesQuery.data ?? []) : filteredNotes;

  const isLoading = debouncedSearch.trim() !== '' && searchNotesQuery.isLoading;

  // Determine selected quick filter for NoteList header
  const selectedQuickFilter = navigation.kind === 'global' ? navigation.filter : null;

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

  // Create new note (respects current navigation context)
  const handleNewNote = useCallback(async () => {
    const newNote = await createNote.mutateAsync({
      content: '# Untitled\n\n',
      notebookId: selectedNotebookId ?? undefined,
    });
    setSelectedNote(newNote);
    setSearchQuery('');
    setDebouncedSearch('');
  }, [createNote, selectedNotebookId]);

  // Select note
  const handleSelectNote = useCallback(async (id: string) => {
    const result = await window.readied.notes.get(id);
    if (result.ok) {
      setSelectedNote(result.data);
    }
  }, []);

  // Handle wikilink click - best-effort navigation by title
  const handleWikilinkClick = useCallback(
    async (title: string) => {
      const notes = await window.readied.notes.search(title);
      if (notes.length > 0) {
        // Find exact match (case-insensitive)
        const match = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
        if (match) {
          handleSelectNote(match.id);
        }
      }
      // No-op if note doesn't exist (future: could show toast or create note)
    },
    [handleSelectNote]
  );

  // Update note content
  const handleUpdateNote = useCallback(
    async (content: string) => {
      if (!selectedNote) return;
      const updated = await updateNote.mutateAsync({ id: selectedNote.id, content });
      setSelectedNote(updated);
      // Sync links after save (fire-and-forget, don't block UI)
      syncLinks.mutate({ noteId: selectedNote.id, content });
    },
    [selectedNote, updateNote, syncLinks]
  );

  // Update note title
  const handleUpdateTitle = useCallback(
    async (title: string) => {
      if (!selectedNote) return;
      const updated = await updateNoteTitle.mutateAsync({ id: selectedNote.id, title });
      setSelectedNote(updated);
    },
    [selectedNote, updateNoteTitle]
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

  // Archive note (toggle based on current state)
  const handleArchiveNote = useCallback(
    async (id: string) => {
      const result = await window.readied.notes.get(id);
      if (!result.ok) return;

      if (result.data.isArchived) {
        await restoreNote.mutateAsync(id);
      } else {
        await archiveNote.mutateAsync(id);
      }
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
    },
    [selectedNote, archiveNote, restoreNote]
  );

  // Duplicate note
  const handleDuplicateNote = useCallback(
    async (id: string) => {
      const duplicated = await duplicateNote.mutateAsync(id);
      setSelectedNote(duplicated);
      goToAllNotes();
    },
    [duplicateNote, goToAllNotes]
  );

  // Pin/unpin note (toggle)
  const handlePinNote = useCallback(
    async (id: string) => {
      const note = displayedNotes.find(n => n.id === id);
      if (!note) return;
      if (note.isPinned) {
        await unpinNote.mutateAsync(id);
      } else {
        await pinNote.mutateAsync(id);
      }
    },
    [displayedNotes, pinNote, unpinNote]
  );

  // Move note to notebook
  const handleMoveNote = useCallback(
    async (noteId: string, notebookId: string) => {
      await moveNote.mutateAsync({ noteId, notebookId });
    },
    [moveNote]
  );

  // Move current note to notebook (for editor header)
  const handleMoveSelectedNote = useCallback(
    async (notebookId: string) => {
      if (!selectedNote) return;
      const updated = await moveNote.mutateAsync({ noteId: selectedNote.id, notebookId });
      setSelectedNote(updated);
    },
    [selectedNote, moveNote]
  );

  // Change note status
  const handleStatusChange = useCallback(
    async (status: NoteStatus) => {
      if (!selectedNote) return;
      const updated = await setNoteStatus.mutateAsync({ id: selectedNote.id, status });
      // If there's a status filter active and the note no longer matches, deselect it
      if (statusFilter && status !== statusFilter) {
        setSelectedNote(null);
      } else {
        setSelectedNote(updated);
      }
    },
    [selectedNote, setNoteStatus, statusFilter]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }

      if (isMod && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      }

      if (isMod && e.key === 'd' && selectedNote) {
        e.preventDefault();
        handleDuplicateNote(selectedNote.id);
      }

      // Cmd+Shift+P to cycle view mode (Editor → Split → Preview)
      if (isMod && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        cycleViewMode();
      }

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
  }, [handleNewNote, handleDuplicateNote, selectedNote, searchQuery, cycleViewMode]);

  return (
    <LicenseProvider>
      <div className="app">
        <Group
          id="main-layout"
          orientation="horizontal"
          className="app__content"
          defaultLayout={defaultLayout}
          onLayoutChange={onLayoutChange}
        >
          {/* Sidebar Panel */}
          <Panel id="sidebar" defaultSize={220} minSize={200} maxSize={360}>
            <Sidebar />
          </Panel>

          <Separator className="resize-handle" />

          {/* NoteList Panel */}
          <Panel id="notelist" defaultSize={300} minSize={240} maxSize={450}>
            <NoteList
              notes={displayedNotes}
              selectedId={selectedNote?.id ?? null}
              selectedNotebookId={selectedNotebookId}
              selectedTag={selectedTag}
              selectedQuickFilter={selectedQuickFilter}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSelect={handleSelectNote}
              onDelete={handleDeleteNote}
              onArchive={handleArchiveNote}
              onDuplicate={handleDuplicateNote}
              onPin={handlePinNote}
              onMove={handleMoveNote}
              onSearch={handleSearch}
              onNewNote={handleNewNote}
              onSortChange={setSort}
              onTagClick={goToTag}
              isLoading={isLoading}
            />
          </Panel>

          <Separator className="resize-handle" />

          {/* Editor Panel - elastic, takes remaining space */}
          <Panel id="editor" minSize={400}>
            <NoteEditor
              note={selectedNote}
              onUpdate={handleUpdateNote}
              onTitleUpdate={handleUpdateTitle}
              onMoveToNotebook={handleMoveSelectedNote}
              onStatusChange={handleStatusChange}
              onDuplicate={selectedNote ? () => handleDuplicateNote(selectedNote.id) : undefined}
              onDelete={selectedNote ? () => handleDeleteNote(selectedNote.id) : undefined}
              onWikilinkClick={handleWikilinkClick}
              onNavigateToNote={handleSelectNote}
            />
          </Panel>
        </Group>
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
