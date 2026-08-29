import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useCssVariables, usePluginStyles, useThemeOverrides } from '@dripnex/plugin-api';
import { scanMarkdown } from '@dripnex/markdown';
import type { NoteSnapshot } from '../preload/index';
import { UpdateBanner } from './components/UpdateBanner';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { NoteWindow } from './components/NoteWindow';
import { Sidebar } from './components/sidebar';
import { GraphView } from './components/GraphView';
import { CommandPalette } from './components/CommandPalette';
import { ConflictResolver } from './components/sync/ConflictResolver';
import { AiPanel } from './components/ai/AiPanel';
import { LicenseProvider } from './contexts/LicenseContext';
import { ToastProvider } from './components/Toast';
import { Toaster } from './ui/primitives';
import { Welcome } from './components/Welcome';
import { AuthGate } from './components/auth/AuthGate';
import { useAuthStore, selectIsAuthenticated, selectSessionHydrated } from './stores/authStore';
import { resolveAppShell } from './utils/appShell';
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
import {
  canGoBack,
  canGoForward,
  emptyNoteHistory,
  historyBack,
  historyForward,
  visitNote,
} from './utils/noteHistory';
import { useAuthSessionEvents } from './hooks/useAuthSessionEvents';
import { useDeepLinks } from './hooks/useDeepLinks';
import { useAutoSave } from './hooks/useAutoSave';
import { useNoteActions } from './hooks/useNoteActions';
import { useAppCommands } from './hooks/useAppCommands';
import { useEnsureNowBoard } from './hooks/useNowBoard';
import { useRefreshOnWindowFocus } from './hooks/useRefreshOnWindowFocus';
import { usePluginRuntime } from './hooks/usePluginRuntime';
import { useMcpLocalPath } from './hooks/useMcpLocalPath';
import type { PaletteMode } from './utils/paletteQuery';
import { useEditorBufferStore, selectContentForNote } from './stores/editorBufferStore';
import { useHeadingJumpStore } from './stores/headingJumpStore';
import { initGsapRuntime, playMotion, setPerformanceLow } from './motion/gsapRuntime';
import { shouldPlaySidebarIn } from './motion/sidebarIn';
import { usePerformanceStore } from './stores/performanceStore';

function NotesApp() {
  usePerformanceMode();
  useOfficialThemes();

  useEffect(() => {
    const stop = initGsapRuntime();
    setPerformanceLow(usePerformanceStore.getState().mode === 'low');
    const unsub = usePerformanceStore.subscribe(state => {
      setPerformanceLow(state.mode === 'low');
    });
    return () => {
      stop();
      unsub();
    };
  }, []);
  useThemeOverrides();
  useAppearanceSettings();
  useCssVariables();
  usePluginStyles();

  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('dripnex-onboarding-done')
  );
  const sessionHydrated = useAuthStore(selectSessionHydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isE2E = window.dripnex?.app?.isE2E?.() === true;

  useAuthSessionEvents({ consumeMagicLink: true });

  useEffect(() => {
    void useAuthStore.getState().loadSession();
  }, []);

  const shell = resolveAppShell({
    onboardingComplete: !showWelcome,
    isAuthenticated,
    sessionHydrated,
    isE2E,
  });

  if (shell === 'auth') {
    return (
      <ToastProvider>
        <AuthGate hydrating={!sessionHydrated} />
        <Toaster />
      </ToastProvider>
    );
  }

  return (
    <SignedInApp
      showWelcome={shell === 'welcome'}
      onFinishedOnboarding={() => setShowWelcome(false)}
    />
  );
}

function SignedInApp({
  showWelcome,
  onFinishedOnboarding,
}: {
  showWelcome: boolean;
  onFinishedOnboarding: () => void;
}) {
  useEnsureNowBoard();
  useRefreshOnWindowFocus();
  useMcpLocalPath();

  const {
    sidebarWidth,
    notelistWidth,
    sidebarCollapsed,
    distractionFree,
    toggleSidebar,
    toggleDistractionFree,
    startResizeSidebar,
    startResizeNotelist,
  } = useResizableLayout();

  const hideSidebar = sidebarCollapsed || distractionFree;
  const hideNoteList = distractionFree;
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarWasHiddenRef = useRef(hideSidebar);

  useLayoutEffect(() => {
    if (shouldPlaySidebarIn(sidebarWasHiddenRef.current, hideSidebar)) {
      playMotion('sidebar-in', sidebarRef.current);
    }
    sidebarWasHiddenRef.current = hideSidebar;
  }, [hideSidebar]);

  useEffect(() => {
    const setVisibility = window.dripnex.windows.setButtonVisibility;
    if (typeof setVisibility !== 'function') return;
    void setVisibility(!hideSidebar);
    return () => {
      void setVisibility(true);
    };
  }, [hideSidebar]);

  const navigation = useNavigation();
  const filteredNotes = useFilteredNotes();
  const selectedNotebookId = useSelectedNotebookId();
  const selectedTag = useSelectedTag();
  const statusFilter = useStatusFilter();
  const tagFilter = useTagFilter();
  const sortBy = useSortBy();
  const sortOrder = useSortOrder();
  const { goToTag, setSort, enterWorkspace, setTagFilter } = useNavigationActions();

  useEffect(() => {
    void useTagColorsStore.getState().loadColors();
  }, []);

  useEffect(() => {
    const cleanup = useSyncStore.getState().initNetworkListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    const cleanup = useSyncStore.getState().initSyncStatusListener();
    return cleanup;
  }, []);

  useDeepLinks();

  const [selectedNote, setSelectedNote] = useState<NoteSnapshot | null>(null);
  const liveNoteContent = useEditorBufferStore(selectContentForNote(selectedNote?.id ?? null));
  const paletteHeadings = useMemo(
    () => scanMarkdown(liveNoteContent ?? selectedNote?.content ?? '').headings,
    [liveNoteContent, selectedNote?.content]
  );
  const selectedNoteRef = useRef<NoteSnapshot | null>(null);
  selectedNoteRef.current = selectedNote;
  const [noteHistory, setNoteHistory] = useState(emptyNoteHistory);
  const noteHistoryRef = useRef(noteHistory);
  noteHistoryRef.current = noteHistory;
  const historyNavGen = useRef(0);
  const setSelectedNoteAndVisit = useCallback((note: NoteSnapshot | null) => {
    setSelectedNote(note);
    if (note) setNoteHistory(prev => visitNote(prev, note.id));
  }, []);
  const goNoteHistory = useCallback(async (direction: 'back' | 'forward') => {
    const gen = ++historyNavGen.current;
    const current = noteHistoryRef.current;
    const { state, id } = direction === 'back' ? historyBack(current) : historyForward(current);
    if (!id) return;
    try {
      const result = await window.dripnex.notes.get(id);
      if (gen !== historyNavGen.current) return;
      if (!result.ok) return;
      setNoteHistory(state);
      setSelectedNote(result.data);
    } catch {
      // Keep the cursor if the note cannot be loaded.
    }
  }, []);
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
    setSelectedNote: setSelectedNoteAndVisit,
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

  useEffect(() => {
    const onFollow = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; anchor?: string }>).detail;
      void handleWikilinkClick(detail?.target ?? '', detail?.anchor);
    };
    window.addEventListener('dripnex:follow-wikilink', onFollow);
    return () => window.removeEventListener('dripnex:follow-wikilink', onFollow);
  }, [handleWikilinkClick]);

  useAutoSave(handleUpdateNote);

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
    setSelectedNote: setSelectedNoteAndVisit,
    displayedNotes,
    onSelectNote: handleSelectNote,
    onNoteBack: () => {
      void goNoteHistory('back');
    },
    onNoteForward: () => {
      void goNoteHistory('forward');
    },
    onToggleZen: toggleDistractionFree,
    onOpenInWindow: () => {
      const note = selectedNoteRef.current;
      if (!note) return;
      void window.dripnex.windows.openNote(note.id, note.title || 'Note');
    },
  });

  const selectedQuickFilter = navigation.kind === 'global' ? navigation.filter : null;
  const aiConfigCache = useRef<Record<string, unknown>>({});

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

  const handleWelcomeComplete = useCallback(
    (createNote: boolean) => {
      localStorage.setItem('dripnex-onboarding-done', 'true');
      onFinishedOnboarding();
      if (createNote) {
        void handleNewNote();
      }
    },
    [handleNewNote, onFinishedOnboarding]
  );

  if (showWelcome) {
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
            <aside
              ref={sidebarRef}
              className="app__sidebar"
              data-collapsed={hideSidebar ? 'true' : 'false'}
              style={{ width: sidebarWidth }}
              aria-hidden={hideSidebar}
              inert={hideSidebar || undefined}
            >
              <Sidebar onOpenGraph={() => setIsGraphOpen(true)} />
            </aside>
            {!hideSidebar ? (
              <div
                className="resize-handle"
                onMouseDown={startResizeSidebar}
                role="separator"
                aria-orientation="vertical"
              />
            ) : null}

            <section
              className="app__notelist"
              data-collapsed={hideNoteList ? 'true' : 'false'}
              style={{ width: notelistWidth }}
              aria-hidden={hideNoteList}
              inert={hideNoteList || undefined}
            >
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
            {!hideNoteList ? (
              <div
                className="resize-handle"
                onMouseDown={startResizeNotelist}
                role="separator"
                aria-orientation="vertical"
              />
            ) : null}

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
                  canBack={canGoBack(noteHistory)}
                  canForward={canGoForward(noteHistory)}
                  distractionFree={distractionFree}
                  onBack={() => {
                    void goNoteHistory('back');
                  }}
                  onForward={() => {
                    void goNoteHistory('forward');
                  }}
                  onToggleZen={toggleDistractionFree}
                  onOpenWindow={() => {
                    if (!selectedNote) return;
                    void window.dripnex.windows.openNote(
                      selectedNote.id,
                      selectedNote.title || 'Note'
                    );
                  }}
                />
              )}
            </main>

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
            headings={paletteHeadings}
            onJumpHeading={text => {
              if (!selectedNote) return;
              useHeadingJumpStore.getState().request(selectedNote.id, text);
            }}
          />
          <ConflictResolver variant="modal" />
          <Toaster />
        </div>
      </LicenseProvider>
    </ToastProvider>
  );
}

export function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const noteWindowId = urlParams.get('noteWindow');

  if (noteWindowId) {
    return (
      <ErrorBoundary>
        <NoteWindow noteId={noteWindowId} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <NotesApp />
    </ErrorBoundary>
  );
}
