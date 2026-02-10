import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NoteSnapshot, NoteStatus } from '../preload/index';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { NoteWindow } from './components/NoteWindow';
import { Sidebar } from './components/sidebar';
import { GraphView } from './components/GraphView';
import { LicenseProvider } from './contexts/LicenseContext';
import { ToastProvider } from './components/Toast';
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
import { useDebouncedSearch } from './hooks/useDebouncedSearch';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEditorPreferencesStore } from './stores/editorPreferencesStore';
import { useTagColorsStore } from './stores/tagColorsStore';
import { usePerformanceMode } from './hooks/usePerformanceMode';
import { useAppearanceSettings } from './hooks/useAppearanceSettings';
import { useResizableLayout } from './hooks/useResizableLayout';
import { useAuthStore } from './stores/authStore';

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
 */
function NotesApp() {
  usePerformanceMode();
  useAppearanceSettings();

  // Resizable layout
  const { sidebarWidth, notelistWidth, startResizeSidebar, startResizeNotelist } =
    useResizableLayout();

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

  // Load auth session on mount (once)
  useEffect(() => {
    useAuthStore.getState().loadSession();
  }, []);

  // Handle deep link auth verification (readied://auth/verify?token=xxx)
  useEffect(() => {
    const handleAuthVerification = async (...args: unknown[]) => {
      const token = args[0] as string;
      if (!token) return;

      try {
        await useAuthStore.getState().verifyToken(token);
      } catch (error) {
        console.error('Deep link auth verification failed:', error);
      }
    };

    // Listen for deep link auth verification events
    const removeListener = window.readied.ipc.on('auth:verify-token', handleAuthVerification);

    return () => {
      removeListener();
    };
  }, []);

  // Local UI state
  const [selectedNote, setSelectedNote] = useState<NoteSnapshot | null>(null);
  const { searchQuery, debouncedSearch, handleSearch, clearSearch } = useDebouncedSearch(300);
  const [isGraphOpen, setIsGraphOpen] = useState(false);

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

  // Create new note (respects current navigation context)
  const handleNewNote = useCallback(async () => {
    const newNote = await createNote.mutateAsync({
      content: '# Untitled\n\n',
      notebookId: selectedNotebookId ?? undefined,
    });
    setSelectedNote(newNote);
    clearSearch();
  }, [createNote, selectedNotebookId, clearSearch]);

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

      // Auto-commit to git if enabled (fire-and-forget, don't block UI)
      if (updated.notebookId) {
        try {
          const gitSettings = await window.readied.notebooks.getGitSettings(updated.notebookId);
          if (
            gitSettings.success &&
            gitSettings.settings?.enabled &&
            gitSettings.settings?.autoCommit
          ) {
            // Write note file to git repo
            await window.readied.git.writeNote(updated.notebookId, updated.id, content);
            // Commit with note title
            await window.readied.git.commit(updated.notebookId, `Update note: ${updated.title}`, [
              `${updated.id}.md`,
            ]);
          }
        } catch (error) {
          console.error('Auto-commit failed:', error);
          // Don't throw - this shouldn't block the save flow
        }
      }
    },
    [selectedNote, updateNote, syncLinks]
  );

  // Update note title
  const handleUpdateTitle = useCallback(
    async (title: string) => {
      if (!selectedNote) return;
      const updated = await updateNoteTitle.mutateAsync({ id: selectedNote.id, title });
      setSelectedNote(updated);

      // Auto-commit to git if enabled (fire-and-forget, don't block UI)
      if (updated.notebookId) {
        try {
          const gitSettings = await window.readied.notebooks.getGitSettings(updated.notebookId);
          if (
            gitSettings.success &&
            gitSettings.settings?.enabled &&
            gitSettings.settings?.autoCommit
          ) {
            // Write note file to git repo (title change also affects content)
            await window.readied.git.writeNote(updated.notebookId, updated.id, updated.content);
            // Commit with note title
            await window.readied.git.commit(updated.notebookId, `Rename note: ${updated.title}`, [
              `${updated.id}.md`,
            ]);
          }
        } catch (error) {
          console.error('Auto-commit failed:', error);
          // Don't throw - this shouldn't block the save flow
        }
      }
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

  // Keyboard shortcuts (extracted to hook)
  useKeyboardShortcuts({
    onNewNote: handleNewNote,
    onDuplicateNote: handleDuplicateNote,
    onCycleViewMode: cycleViewMode,
    onToggleGraph: useCallback(() => setIsGraphOpen(prev => !prev), []),
    onCloseGraph: useCallback(() => setIsGraphOpen(false), []),
    onClearSearch: clearSearch,
    onDeselectNote: useCallback(() => setSelectedNote(null), []),
    selectedNote,
    searchQuery,
    isGraphOpen,
  });

  return (
    <ToastProvider>
      <LicenseProvider>
        <div className="app">
          <div className="app__layout">
            <aside className="app__sidebar" style={{ width: sidebarWidth }}>
              <Sidebar onOpenGraph={() => setIsGraphOpen(true)} />
            </aside>
            <div
              className="resize-handle"
              onMouseDown={startResizeSidebar}
              role="separator"
              aria-orientation="vertical"
            />

            <section className="app__notelist" style={{ width: notelistWidth }}>
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
            </section>
            <div
              className="resize-handle"
              onMouseDown={startResizeNotelist}
              role="separator"
              aria-orientation="vertical"
            />

            <main className="app__editor">
              {isGraphOpen ? (
                <GraphView
                  selectedNoteId={selectedNote?.id}
                  onNodeClick={noteId => {
                    handleSelectNote(noteId);
                    setIsGraphOpen(false);
                  }}
                  onClose={() => setIsGraphOpen(false)}
                />
              ) : (
                <NoteEditor
                  note={selectedNote}
                  onUpdate={handleUpdateNote}
                  onTitleUpdate={handleUpdateTitle}
                  onMoveToNotebook={handleMoveSelectedNote}
                  onStatusChange={handleStatusChange}
                  onDuplicate={
                    selectedNote ? () => handleDuplicateNote(selectedNote.id) : undefined
                  }
                  onDelete={selectedNote ? () => handleDeleteNote(selectedNote.id) : undefined}
                  onPin={selectedNote ? () => handlePinNote(selectedNote.id) : undefined}
                  onWikilinkClick={handleWikilinkClick}
                  onNavigateToNote={handleSelectNote}
                  onNoteUpdate={setSelectedNote}
                />
              )}
            </main>
          </div>
        </div>
      </LicenseProvider>
    </ToastProvider>
  );
}

export function App() {
  // Check for note window mode via URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const noteWindowId = urlParams.get('noteWindow');

  // If this is a note window, render just the note editor
  if (noteWindowId) {
    return (
      <ErrorBoundary>
        <NoteWindow noteId={noteWindowId} />
      </ErrorBoundary>
    );
  }

  // Main app
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NotesApp />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
