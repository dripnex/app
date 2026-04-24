import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditorView } from '@codemirror/view';
import {
  PluginHost,
  createEditorAPI,
  createAppAPI,
  createDataAPI,
  editorPluginStore,
  useCssVariables,
  useThemeOverrides,
  themeRegistryStore,
} from '@readied/plugin-api';
import type { EditorAPIWithEvents, AppAPIWithEvents, DataAPIWithEvents } from '@readied/plugin-api';
import type { RegisteredCommand } from '@readied/command-registry';
import { useStore } from 'zustand';
import { UpdateBanner } from './components/UpdateBanner';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { NoteWindow } from './components/NoteWindow';
import { Sidebar } from './components/sidebar';
import { GraphView } from './components/GraphView';
import { CommandPalette } from './components/CommandPalette';
import { AiPanel } from './components/ai/AiPanel';
import { LicenseProvider } from './contexts/LicenseContext';
import { ToastProvider, useToast } from './components/Toast';
import { Toaster } from './ui/primitives';
import type { PluginLoadError } from './stores/pluginRuntimeStore';
import { Welcome } from './components/Welcome';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  useNavigation,
  useFilteredNotes,
  useSelectedNotebookId,
  useSelectedTag,
  useNavigationActions,
  useSortBy,
  useSortOrder,
} from './hooks/useNavigation';
import { useSearchNotes } from './hooks/useNotes';
import { useDebouncedSearch } from './hooks/useDebouncedSearch';
import { getEditorView, registry as commandRegistry } from './hooks/useCommandRegistry';
import { builtInPlugins } from './plugins';
import { useTagColorsStore } from './stores/tagColorsStore';
import { usePerformanceMode } from './hooks/usePerformanceMode';
import { useAppearanceSettings } from './hooks/useAppearanceSettings';
import { useResizableLayout } from './hooks/useResizableLayout';
import { useAuthStore } from './stores/authStore';
import { useSyncStore } from './stores/syncStore';
import { useSettingsStore, selectAppearance } from './stores/settings';
import { pluginRuntimeStore } from './stores/pluginRuntimeStore';
import type { NoteSnapshot } from '../preload/index';

// Extracted hooks
import { useDeepLinks } from './hooks/useDeepLinks';
import { useAutoSave } from './hooks/useAutoSave';
import { useNoteActions } from './hooks/useNoteActions';
import { useAppCommands } from './hooks/useAppCommands';

/** Shows toast errors for plugins that failed to load */
function PluginErrorNotifier({ errors }: { errors: PluginLoadError[] }) {
  const { showToast } = useToast();

  useEffect(() => {
    for (const err of errors) {
      showToast(`Plugin "${err.pluginName}" failed to load`, 'error');
    }
  }, [errors, showToast]);

  return null;
}

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
  useThemeOverrides(); // Applies active theme tokens
  useCssVariables();

  // First-run onboarding
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('readied-onboarding-done')
  );

  // Restore saved plugin theme on startup
  const appearance = useSettingsStore(selectAppearance);
  const registeredThemeCount = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().themes.length
  );

  useEffect(() => {
    const savedThemeId = appearance?.activeThemeId;
    if (savedThemeId && registeredThemeCount > 0) {
      const exists = themeRegistryStore.getState().themes.some(t => t.id === savedThemeId);
      if (exists) {
        themeRegistryStore.getState().setActive(savedThemeId);
      }
    }
  }, [appearance?.activeThemeId, registeredThemeCount]);

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
  const { goToTag, setSort } = useNavigationActions();

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
  const { searchQuery, debouncedSearch, handleSearch, clearSearch } = useDebouncedSearch(300);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Plugin system: create stable EditorAPI and AppAPI (early, so handlers can reference them)
  const editorAPI = useMemo<EditorAPIWithEvents>(() => createEditorAPI(getEditorView), []);

  const appAPI = useMemo<AppAPIWithEvents>(
    () =>
      createAppAPI({
        getCurrentNote() {
          const note = selectedNoteRef.current;
          if (!note) return null;
          return { id: note.id, title: note.title, content: note.content };
        },
        async searchNotes(query) {
          const notes = await window.readied.notes.search(query, 20);
          return notes.map(n => ({ id: n.id, title: n.title }));
        },
        async getNoteById(id) {
          const result = await window.readied.notes.get(id);
          if (!result.ok) return null;
          return { id: result.data.id, title: result.data.title, content: result.data.content };
        },
        async getNoteTags(noteId) {
          return window.readied.notes.getManualTags(noteId);
        },
        async getBacklinks(noteId) {
          const links = await window.readied.links.getBacklinks(noteId);
          return links.map(l => ({ noteId: l.noteId, noteTitle: l.noteTitle }));
        },
        async listNotes() {
          const notes = await window.readied.notes.list();
          return notes.map(n => ({
            id: n.id,
            title: n.title,
            notebookId: n.notebookId,
            tags: [...n.tags],
            wordCount: n.wordCount,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            isPinned: n.isPinned,
            status: n.status,
          }));
        },
        async listNotebooks() {
          const notebooks = await window.readied.notebooks.list();
          return notebooks.map(nb => ({
            id: nb.id,
            name: nb.name,
            parentId: nb.parentId,
          }));
        },
        async listTags() {
          return window.readied.notes.tags();
        },
      }),
    []
  );

  const dataAPI = useMemo<DataAPIWithEvents>(
    () =>
      createDataAPI({
        async getNotes(options) {
          const notes = await window.readied.notes.list(
            options
              ? {
                  tag: options.tag,
                  sortBy: options.sortBy === 'wordCount' ? 'updatedAt' : options.sortBy,
                  sortOrder: options.sortOrder,
                }
              : undefined
          );
          let filtered = notes;
          if (options?.notebookId)
            filtered = filtered.filter(n => n.notebookId === options.notebookId);
          if (options?.status) filtered = filtered.filter(n => n.status === options.status);
          if (options?.isPinned !== undefined)
            filtered = filtered.filter(n => n.isPinned === options.isPinned);

          if (options?.sortBy === 'wordCount') {
            const dir = options.sortOrder === 'asc' ? 1 : -1;
            filtered = [...filtered].sort((a, b) => dir * (a.wordCount - b.wordCount));
          }

          const total = filtered.length;

          if (options?.offset || options?.limit) {
            const start = options.offset ?? 0;
            const end = options.limit ? start + options.limit : undefined;
            filtered = filtered.slice(start, end);
          }

          return {
            notes: filtered.map(n => ({
              id: n.id,
              title: n.title,
              notebookId: n.notebookId,
              tags: [...n.tags],
              wordCount: n.wordCount,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
              isPinned: n.isPinned,
              status: n.status,
            })),
            total,
          };
        },
        async getNote(id) {
          const result = await window.readied.notes.get(id);
          if (!result.ok) return null;
          return { id: result.data.id, title: result.data.title, content: result.data.content };
        },
        async searchNotes(query, options) {
          const notes = await window.readied.notes.search(query, options?.limit ?? 20);
          return {
            results: notes.map(n => ({ id: n.id, title: n.title })),
            total: notes.length,
          };
        },
        async countNotes() {
          const counts = await window.readied.notes.count();
          return counts.total;
        },
        async getNotebooks() {
          const notebooks = await window.readied.notebooks.list();
          return notebooks.map(nb => ({ id: nb.id, name: nb.name, parentId: nb.parentId }));
        },
        async getNotebookTree() {
          type TreeNode = {
            id: string;
            name: string;
            parentId: string | null;
            noteCount: number;
            childCount: number;
            children: TreeNode[];
          };
          const tree = await window.readied.notebooks.tree();
          const mapNode = (node: {
            notebook: {
              id: string;
              name: string;
              parentId: string | null;
              noteCount?: number;
            };
            children: unknown[];
          }): TreeNode => ({
            id: node.notebook.id,
            name: node.notebook.name,
            parentId: node.notebook.parentId,
            noteCount: node.notebook.noteCount ?? 0,
            childCount: node.children.length,
            children: (node.children as typeof tree).map(mapNode),
          });
          return tree.map(mapNode);
        },
        async getNotebook(id) {
          const nb = await window.readied.notebooks.getWithMetadata(id);
          if (!nb) return null;
          return {
            id: nb.id,
            name: nb.name,
            parentId: nb.parentId,
            noteCount: nb.noteCount,
            childCount: nb.childCount,
          };
        },
        async getTags() {
          return window.readied.notes.tags();
        },
        async getTagsWithColors() {
          return window.readied.notes.tagsWithColors();
        },
        async getBacklinks(noteId) {
          const links = await window.readied.links.getBacklinks(noteId);
          return links.map(l => ({ noteId: l.noteId, noteTitle: l.noteTitle }));
        },
        async getOutgoingLinks(noteId) {
          const links = await window.readied.links.getOutgoing(noteId);
          return links.map(l => ({
            targetId: l.targetNoteId,
            targetTitle: l.targetTitle ?? l.targetRef,
            resolved: l.targetNoteId !== null,
          }));
        },
        async getGraphData() {
          return window.readied.links.getGraph();
        },
      }),
    []
  );

  // Search query
  const searchNotesQuery = useSearchNotes(debouncedSearch, 50);

  // Determine which notes to display
  const displayedNotes = debouncedSearch.trim() ? (searchNotesQuery.data ?? []) : filteredNotes;
  const isLoading = debouncedSearch.trim() !== '' && searchNotesQuery.isLoading;

  // Note CRUD actions (extracted hook)
  const {
    handleNewNote,
    handleSelectNote,
    handleWikilinkClick,
    handleUpdateNote,
    handleUpdateTitle,
    handleDeleteNote,
    handleArchiveNote,
    handleDuplicateNote,
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

  // Flush pending saves before window close
  useAutoSave(handleUpdateNote);

  // Commands, AI panel, keyboard shortcuts (extracted hook)
  const {
    isAiPanelOpen,
    aiPanelMode,
    pendingAiCommand,
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
    isGraphOpen,
    setIsGraphOpen,
    searchQuery,
    clearSearch,
    setSelectedNote,
  });

  // Determine selected quick filter for NoteList header
  const selectedQuickFilter = navigation.kind === 'global' ? navigation.filter : null;

  // AI Panel callbacks -- wired to existing app state
  const aiConfigCache = useRef<Record<string, unknown>>({});

  // Load AI plugin config once on mount
  useEffect(() => {
    void window.readied.pluginConfig.getAll('readied-ai-assistant').then(config => {
      aiConfigCache.current = config ?? {};
    });
  }, []);

  const aiGetCurrentNote = useCallback(() => {
    const note = selectedNoteRef.current;
    if (!note) return null;
    return { id: note.id, title: note.title, content: note.content };
  }, []);

  const aiSearchNotes = useCallback(async (query: string) => {
    const notes = await window.readied.notes.search(query, 20);
    return notes.map(n => ({ id: n.id, title: n.title }));
  }, []);

  const aiGetNoteById = useCallback(async (id: string) => {
    const result = await window.readied.notes.get(id);
    if (!result.ok) return null;
    return { id: result.data.id, title: result.data.title, content: result.data.content };
  }, []);

  const aiGetConfig = useCallback(<T,>(key: string): T | undefined => {
    return aiConfigCache.current[key] as T | undefined;
  }, []);

  // Plugin runtime: init once, React observes
  const discoveredPlugins = useStore(pluginRuntimeStore, s => s.plugins);
  const pluginErrors = useStore(pluginRuntimeStore, s => s.errors);
  const [builtInEnabledMap, setBuiltInEnabledMap] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    void pluginRuntimeStore.getState().init();
    // Load built-in plugin enabled states
    void (async () => {
      const stateList = await window.readied.plugins.listState();
      const map: Record<string, boolean> = {};
      for (const s of stateList) {
        map[s.pluginId] = s.enabled;
      }
      setBuiltInEnabledMap(map);
    })();
  }, []);

  // Re-check built-in enabled state when plugins reload
  useEffect(() => {
    const handler = () => {
      void (async () => {
        const stateList = await window.readied.plugins.listState();
        const map: Record<string, boolean> = {};
        for (const s of stateList) {
          map[s.pluginId] = s.enabled;
        }
        setBuiltInEnabledMap(map);
      })();
    };
    return window.readied.ipc.on('plugins:reload', handler);
  }, []);

  const allPlugins = useMemo(() => {
    // Don't mount built-in plugins until the enabled state is loaded
    // to avoid activating disabled plugins on the initial render
    const enabledBuiltIn = builtInEnabledMap
      ? builtInPlugins.filter(p => builtInEnabledMap[p.id] !== false)
      : [];
    return [...enabledBuiltIn, ...discoveredPlugins];
  }, [discoveredPlugins, builtInEnabledMap]);

  const configBridge = useMemo(
    () => ({
      getAll: (pluginId: string) => window.readied.pluginConfig.getAll(pluginId),
      set: (pluginId: string, key: string, value: unknown) =>
        window.readied.pluginConfig.set(pluginId, key, value),
    }),
    []
  );

  // Bridge: plugin commands -> global CommandRegistry
  const registerPluginCommand = useCallback(
    (cmd: Record<string, unknown>) => commandRegistry.register(cmd as unknown as RegisteredCommand),
    []
  );

  // Bridge: CM6 editor updates -> plugin EditorAPI events
  useEffect(() => {
    const ext = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        editorAPI._notifyDocChanged(update.state.doc.toString());
      }
      if (update.selectionSet) {
        const sel = update.state.selection.main;
        editorAPI._notifySelectionChanged({ from: sel.from, to: sel.to });
      }
    });

    editorPluginStore.getState().register({
      id: '__editor-event-bridge',
      pluginId: '__system',
      extensions: [ext],
    });

    return () => {
      editorPluginStore.getState().unregister('__editor-event-bridge');
    };
  }, [editorAPI]);

  // Welcome screen completion handler
  const handleWelcomeComplete = useCallback(
    (createNote: boolean) => {
      localStorage.setItem('readied-onboarding-done', 'true');
      setShowWelcome(false);
      if (createNote) {
        void handleNewNote();
      }
    },
    [handleNewNote]
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
                    void handleSelectNote(noteId);
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

            {/* AI Assistant Panel -- right side */}
            {isAiPanelOpen && (
              <aside className="app__ai-panel">
                <AiPanel
                  onClose={closeAiPanel}
                  getCurrentNote={aiGetCurrentNote}
                  searchNotes={aiSearchNotes}
                  getNoteById={aiGetNoteById}
                  getConfig={aiGetConfig}
                  insertAtCursor={aiInsertAtCursor}
                  initialMode={aiPanelMode}
                  initialCommand={pendingAiCommand}
                  replaceSelection={aiReplaceSelection}
                  onCommandExecuted={clearPendingAiCommand}
                />
              </aside>
            )}
          </div>

          {/* Plugin Host - manages plugin lifecycle */}
          <PluginHost
            plugins={allPlugins}
            editorAPI={editorAPI}
            appAPI={appAPI}
            dataAPI={dataAPI}
            registerCommand={registerPluginCommand}
            configBridge={configBridge}
            getView={getEditorView}
          />

          <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />

          <PluginErrorNotifier errors={pluginErrors} />
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
      <QueryClientProvider client={queryClient}>
        <NotesApp />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
