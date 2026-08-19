import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCssVariables, useThemeOverrides } from '@dripnex/plugin-api';
import type { NoteSnapshot } from '../preload/index';
import { UpdateBanner } from './components/UpdateBanner';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { NoteWindow } from './components/NoteWindow';
import { Sidebar } from './components/sidebar';
import { GraphView } from './components/GraphView';
import { CommandPalette } from './components/CommandPalette';
import { AiPanel } from './components/ai/AiPanel';
import { LicenseProvider } from './contexts/LicenseContext';
import { ToastProvider } from './components/Toast';
import { Toaster } from './ui/primitives';
import { Welcome } from './components/Welcome';
import { AuthGate } from './components/auth/AuthGate';
import { useAuthStore, selectIsAuthenticated, selectSessionHydrated } from './stores/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  useNavigation,
  useFilteredNotes,
  useSelectedNotebookId,
  useSelectedTag,
  useStatusFilter,
  useNavigationActions,
  useSortBy,
  useSortOrder,
  useTagFilter,
} from './hooks/useNavigation';
import { useSearchNotes } from './hooks/useNotes';
import { useDebouncedSearch } from './hooks/useDebouncedSearch';
import { matchNotebookId, parseNoteSearch } from './utils/parseNoteSearch';
import { useNotebooks } from './hooks/useNotebooks';
import { listOptionsFromNav } from './utils/listOptionsFromNav';
import { useTagColorsStore } from './stores/tagColorsStore';
import { usePerformanceMode } from './hooks/usePerformanceMode';
import { useAppearanceSettings } from './hooks/useAppearanceSettings';
import { useOfficialThemes } from './hooks/useOfficialThemes';
import { useResizableLayout } from './hooks/useResizableLayout';
import { useSyncStore } from './stores/syncStore';
import { useDeepLinks } from './hooks/useDeepLinks';
import { useAutoSave } from './hooks/useAutoSave';
import { useNoteActions } from './hooks/useNoteActions';
import { useAppCommands } from './hooks/useAppCommands';
import { useEnsureNowBoard } from './hooks/useNowBoard';
import { useRefreshOnWindowFocus } from './hooks/useRefreshOnWindowFocus';
import { usePluginRuntime } from './hooks/usePluginRuntime';
import { useMcpLocalPath } from './hooks/useMcpLocalPath';
import type { PaletteMode } from './utils/paletteQuery';

/**
 * Main Notes Application
 */
function NotesApp() {
  usePerformanceMode();
  useAppearanceSettings();
  useOfficialThemes();
  useEnsureNowBoard();
  useRefreshOnWindowFocus();
  useMcpLocalPath();
  useThemeOverrides(); // Applies active theme tokens
  useCssVariables();

  // First-run onboarding
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('dripnex-onboarding-done')
  );
  const sessionHydrated = useAuthStore(selectSessionHydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const skipAuthGate = window.dripnex?.app?.isE2E?.() === true;

  // Resizable layout
  const {
    sidebarWidth,
    notelistWidth,
    sidebarCollapsed,
    toggleSidebar,
    startResizeSidebar,
    startResizeNotelist,
  } = useResizableLayout();

  useEffect(() => {
    const setVisibility = window.dripnex.windows.setButtonVisibility;
    if (typeof setVisibility !== 'function') return;
    void setVisibility(!sidebarCollapsed);
    return () => {
      void setVisibility(true);
    };
  }, [sidebarCollapsed]);

  // Navigation state from Zustand
  const navigation = useNavigation();
  const filteredNotes = useFilteredNotes();
  const selectedNotebookId = useSelectedNotebookId();
  const selectedTag = useSelectedTag();
  const statusFilter = useStatusFilter();
  const tagFilter = useTagFilter();
  const sortBy = useSortBy();
  const sortOrder = useSortOrder();
  const { goToTag, setSort, enterWorkspace, setTagFilter } = useNavigationActions();

  // Load tag colors on mount (once)
  useEffect(() => {
    void useTagColorsStore.getState().loadColors();
  }, []);

  // Load auth session on mount (once)
  useEffect(() => {
    void useAuthStore.getState().loadSession();
  }, []);

  // Auto-resume sync on network reconnect
  useEffect(() => {
    const cleanup = useSyncStore.getState().initNetworkListeners();
    return cleanup;
  }, []);

  // Listen for sync status events pushed from main process
  useEffect(() => {
    const cleanup = useSyncStore.getState().initSyncStatusListener();
    return cleanup;
  }, []);

  // Handle deep link auth verification
  useDeepLinks();

  // Local UI state
  const [selectedNote, setSelectedNote] = useState<NoteSnapshot | null>(null);
  const selectedNoteRef = useRef<NoteSnapshot | null>(null);
  selectedNoteRef.current = selectedNote;
  const { appAPI, dataAPI, pluginSlot } = usePluginRuntime(selectedNoteRef);
  const { searchQuery, debouncedSearch, handleSearch, clearSearch } = useDebouncedSearch(300);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode | null>(null);
  const isCommandPaletteOpen = paletteMode !== null;
  const openPalette = useCallback((mode: PaletteMode) => {
    setPaletteMode(prev => (prev === mode ? null : mode));
  }, []);
  const setIsCommandPaletteOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    setPaletteMode(prev => {
      const isOpen = prev !== null;
      const next = typeof open === 'function' ? open(isOpen) : open;
      if (!next) return null;
      return prev ?? 'commands';
    });
  }, []);

  const { data: notebooks } = useNotebooks();
  const parsedSearch = useMemo(() => parseNoteSearch(debouncedSearch), [debouncedSearch]);
  const searchNotebookId = useMemo(() => {
    if (!parsedSearch.notebook || !notebooks) return undefined;
    return matchNotebookId(parsedSearch.notebook, notebooks);
  }, [parsedSearch.notebook, notebooks]);
  const searchOptions = useMemo(() => {
    const scoped = listOptionsFromNav({
      navigation,
      statusFilter: parsedSearch.status ?? statusFilter,
      tagFilter,
      sortBy,
      sortOrder,
    });
    const tags = [...new Set([...(scoped.tags ?? []), ...parsedSearch.tags])];
    if (scoped.tag && !tags.includes(scoped.tag)) tags.unshift(scoped.tag);
    return {
      ...scoped,
      tag: undefined,
      tags: tags.length > 0 ? tags : undefined,
      notebookId: searchNotebookId ?? scoped.notebookId,
      isPinned: parsedSearch.pinned ?? scoped.isPinned,
      isDeleted: parsedSearch.trash ?? scoped.isDeleted,
      archived: parsedSearch.archived ? ('archived' as const) : scoped.archived,
      limit: 50,
    };
  }, [navigation, parsedSearch, searchNotebookId, statusFilter, tagFilter, sortBy, sortOrder]);
  const searchNotesQuery = useSearchNotes(parsedSearch.text, searchOptions);

  const displayedNotes = useMemo(() => {
    const hasText = parsedSearch.text.length > 0;
    const hasOps =
      parsedSearch.tags.length > 0 ||
      parsedSearch.status !== null ||
      parsedSearch.notebook !== null ||
      parsedSearch.pinned !== null ||
      parsedSearch.trash !== null ||
      parsedSearch.archived !== null;
    const usesQuery =
      hasText ||
      parsedSearch.trash !== null ||
      parsedSearch.archived !== null ||
      parsedSearch.notebook !== null;
    let notes = usesQuery ? (searchNotesQuery.data ?? []) : filteredNotes;

    if (hasText) {
      const needle = parsedSearch.text.toLowerCase();
      const extras = filteredNotes.filter(
        n =>
          n.title.toLowerCase().includes(needle) ||
          n.tags.some(tag => tag.toLowerCase().includes(needle))
      );
      const seen = new Set(notes.map(n => n.id));
      notes = [...notes, ...extras.filter(n => !seen.has(n.id))];
    }

    if (!hasText && hasOps) {
      if (parsedSearch.tags.length > 0) {
        notes = notes.filter(n =>
          parsedSearch.tags.every(tag => n.tags.some(noteTag => noteTag.toLowerCase() === tag))
        );
      }
      if (parsedSearch.status) {
        notes = notes.filter(n => n.status === parsedSearch.status);
      }
      if (searchNotebookId) {
        notes = notes.filter(n => n.notebookId === searchNotebookId);
      }
      if (parsedSearch.pinned) {
        notes = notes.filter(n => n.isPinned);
      }
      if (parsedSearch.trash) {
        notes = notes.filter(n => n.isDeleted);
      }
      if (parsedSearch.archived) {
        notes = notes.filter(n => n.archivedAt !== null);
      }
    }

    return notes;
  }, [filteredNotes, parsedSearch, searchNotebookId, searchNotesQuery.data]);

  const isLoading = searchNotesQuery.isFetching && searchNotesQuery.isLoading;

  // Note CRUD actions (extracted hook)
  const {
    handleNewNote,
    handleSelectNote,
    handleCreateLinkedNote,
    handleWikilinkClick,
    handleUpdateNote,
    handleUpdateTitle,
    handleDeleteNote,
    handleRestoreDeleted,
    handlePermanentDelete,
    handleArchiveNote,
    handleDuplicateNote,
    handleCreateFromTemplate,
    handlePinNote,
    handleMoveNote,
    handleMoveSelectedNote,
    handleStatusChange,
  } = useNoteActions({
    selectedNote,
    setSelectedNote,
    selectedNotebookId,
    clearSearch,
    appAPI,
    dataAPI,
    displayedNotes,
  });

  useEffect(() => {
    const onCreate = (event: Event) => {
      const title = (event as CustomEvent<{ title?: string }>).detail?.title?.trim();
      if (title) void handleCreateLinkedNote(title);
    };
    window.addEventListener('dripnex:create-linked-note', onCreate);
    return () => window.removeEventListener('dripnex:create-linked-note', onCreate);
  }, [handleCreateLinkedNote]);

  // Flush pending saves before window close
  useAutoSave(handleUpdateNote);

  // Commands, AI panel, keyboard shortcuts (extracted hook)
  const {
    isAiPanelOpen,
    aiPanelMode,
    pendingAiCommand,
    openAskNotes,
    closeAiPanel,
    clearPendingAiCommand,
    aiReplaceSelection,
    aiInsertAtCursor,
    closeCommandPalette,
  } = useAppCommands({
    handleNewNote,
    handleDuplicateNote,
    selectedNote,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    openPalette,
    isGraphOpen,
    setIsGraphOpen,
    searchQuery,
    clearSearch,
    setSelectedNote,
    displayedNotes,
    onSelectNote: handleSelectNote,
  });

  // Determine selected quick filter for NoteList header
  const selectedQuickFilter = navigation.kind === 'global' ? navigation.filter : null;

  // AI Panel callbacks -- wired to existing app state
  const aiConfigCache = useRef<Record<string, unknown>>({});

  // Load AI plugin config; stay current when Settings writes a key
  useEffect(() => {
    void window.dripnex.pluginConfig.getAll('dripnex-ai-assistant').then(config => {
      aiConfigCache.current = config ?? {};
    });
    return window.dripnex.ipc.on('pluginConfig:changed', (...args: unknown[]) => {
      if (args[0] !== 'dripnex-ai-assistant' || typeof args[1] !== 'string') return;
      aiConfigCache.current = { ...aiConfigCache.current, [args[1]]: args[2] };
    });
  }, []);

  const aiGetCurrentNote = useCallback(() => {
    const note = selectedNoteRef.current;
    if (!note) return null;
    return { id: note.id, title: note.title, content: note.content };
  }, []);

  const aiGetConfig = useCallback(<T,>(key: string): T | undefined => {
    return aiConfigCache.current[key] as T | undefined;
  }, []);

  // Welcome screen completion handler
  const handleWelcomeComplete = useCallback(
    (createNote: boolean) => {
      localStorage.setItem('dripnex-onboarding-done', 'true');
      setShowWelcome(false);
      if (createNote) {
        void handleNewNote();
      }
    },
    [handleNewNote]
  );

  if (!skipAuthGate && !sessionHydrated) {
    return (
      <ToastProvider>
        <AuthGate hydrating />
        <Toaster />
      </ToastProvider>
    );
  }

  if (!skipAuthGate && !isAuthenticated) {
    return (
      <ToastProvider>
        <AuthGate />
        <Toaster />
      </ToastProvider>
    );
  }

  if (showWelcome && skipAuthGate) {
    return (
      <ToastProvider>
        <Welcome onComplete={handleWelcomeComplete} />
        <Toaster />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <LicenseProvider>
        <div className="app">
          <UpdateBanner />
          <div className="app__layout">
            {!sidebarCollapsed ? (
              <>
                <aside className="app__sidebar" style={{ width: sidebarWidth }}>
                  <Sidebar onOpenGraph={() => setIsGraphOpen(true)} />
                </aside>
                <div
                  className="resize-handle"
                  onMouseDown={startResizeSidebar}
                  role="separator"
                  aria-orientation="vertical"
                />
              </>
            ) : null}

            <section className="app__notelist" style={{ width: notelistWidth }}>
              <NoteList
                notes={displayedNotes}
                selectedId={selectedNote?.id ?? null}
                selectedNotebookId={selectedNotebookId}
                selectedTag={selectedTag}
                selectedStatus={statusFilter}
                selectedQuickFilter={selectedQuickFilter}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSelect={handleSelectNote}
                onDelete={handleDeleteNote}
                onRestoreDeleted={handleRestoreDeleted}
                onPermanentDelete={handlePermanentDelete}
                onArchive={handleArchiveNote}
                onDuplicate={handleDuplicateNote}
                onPin={handlePinNote}
                onMove={handleMoveNote}
                onSearch={handleSearch}
                onNewNote={handleNewNote}
                onCreateFromTemplate={handleCreateFromTemplate}
                onSortChange={setSort}
                onTagClick={goToTag}
                onToggleSidebar={toggleSidebar}
                sidebarCollapsed={sidebarCollapsed}
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
                  onOpenNote={noteId => {
                    void handleSelectNote(noteId);
                    setIsGraphOpen(false);
                  }}
                  onAskNote={noteId => {
                    void handleSelectNote(noteId);
                    openAskNotes();
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
                  onUseTemplate={
                    selectedNote?.notebookId === 'templates'
                      ? () => handleCreateFromTemplate(selectedNote.id)
                      : undefined
                  }
                  onDelete={selectedNote ? () => handleDeleteNote(selectedNote.id) : undefined}
                  onRestoreDeleted={
                    selectedNote ? () => handleRestoreDeleted(selectedNote.id) : undefined
                  }
                  onPermanentDelete={
                    selectedNote ? () => handlePermanentDelete(selectedNote.id) : undefined
                  }
                  onPin={selectedNote ? () => handlePinNote(selectedNote.id) : undefined}
                  onWikilinkClick={handleWikilinkClick}
                  onNavigateToNote={handleSelectNote}
                  onNoteUpdate={setSelectedNote}
                />
              )}
            </main>

            {/* AI Assistant Panel -- right side */}
            {isAiPanelOpen && (
              <aside className="app__ai-panel">
                <AiPanel
                  onClose={closeAiPanel}
                  getCurrentNote={aiGetCurrentNote}
                  getConfig={aiGetConfig}
                  insertAtCursor={aiInsertAtCursor}
                  initialMode={aiPanelMode}
                  initialCommand={pendingAiCommand}
                  replaceSelection={aiReplaceSelection}
                  onCommandExecuted={clearPendingAiCommand}
                  onOpenNote={id => void handleSelectNote(id)}
                />
              </aside>
            )}
          </div>

          {pluginSlot}

          <CommandPalette
            isOpen={isCommandPaletteOpen}
            mode={paletteMode ?? 'commands'}
            onClose={closeCommandPalette}
            onOpenNote={id => void handleSelectNote(id)}
            onJumpNotebook={id => {
              enterWorkspace(id);
            }}
            onJumpTag={name => {
              setTagFilter(name);
            }}
          />
          <Toaster />
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
      <NotesApp />
    </ErrorBoundary>
  );
}
