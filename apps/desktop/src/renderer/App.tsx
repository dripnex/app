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
import type { AiPanelMode } from '@readied/ai-assistant';
import {
  SUMMARIZE_SYSTEM_PROMPT,
  SUMMARIZE_USER_TEMPLATE,
  REWRITE_SYSTEM_PROMPT,
  REWRITE_USER_TEMPLATE,
  TWEET_SYSTEM_PROMPT,
  TWEET_USER_TEMPLATE,
  resolveTemplate,
} from '@readied/ai-assistant';
import { useStore } from 'zustand';
import type { NoteSnapshot, NoteStatus } from '../preload/index';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { NoteWindow } from './components/NoteWindow';
import { Sidebar } from './components/sidebar';
import { GraphView } from './components/GraphView';
import { CommandPalette } from './components/CommandPalette';
import { AiPanel } from './components/ai/AiPanel';
import type { AiInitialCommand } from './components/ai/AiPanel';
import { LicenseProvider } from './contexts/LicenseContext';
import { ToastProvider, useToast } from './components/Toast';
import type { PluginLoadError } from './stores/pluginRuntimeStore';
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
import { useCommandKeybindings } from './hooks/useCommandKeybindings';
import { useRegisterAppCommands } from './hooks/useRegisterAppCommands';
import { useRegisterAiCommands } from './hooks/useRegisterAiCommands';
import { useRegisterPluginAiCommands } from './hooks/useRegisterPluginAiCommands';
import { getEditorView, registry as commandRegistry } from './hooks/useCommandRegistry';
import { builtInPlugins } from './plugins';
import { useEditorPreferencesStore } from './stores/editorPreferencesStore';
import { useTagColorsStore } from './stores/tagColorsStore';
import { usePerformanceMode } from './hooks/usePerformanceMode';
import { useAppearanceSettings } from './hooks/useAppearanceSettings';
import { useResizableLayout } from './hooks/useResizableLayout';
import { useAuthStore } from './stores/authStore';
import { useSyncStore } from './stores/syncStore';
import { useSettingsStore, selectAppearance } from './stores/settings';
import { pluginRuntimeStore } from './stores/pluginRuntimeStore';

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

  // Restore saved plugin theme on startup
  const appearance = useSettingsStore(selectAppearance);
  const registeredThemeCount = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().themes.length
  );

  useEffect(() => {
    const savedThemeId = appearance?.activeThemeId;
    if (savedThemeId && registeredThemeCount > 0) {
      // Only restore if the theme is actually registered (plugin loaded)
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

  // Auto-resume sync on network reconnect
  useEffect(() => {
    const cleanup = useSyncStore.getState().initNetworkListeners();
    return cleanup;
  }, []);

  // Listen for sync status events pushed from main process (auto-sync backoff, auth errors)
  useEffect(() => {
    const cleanup = useSyncStore.getState().initSyncStatusListener();
    return cleanup;
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
  const selectedNoteRef = useRef<NoteSnapshot | null>(null);
  selectedNoteRef.current = selectedNote;
  const { searchQuery, debouncedSearch, handleSearch, clearSearch } = useDebouncedSearch(300);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPanelMode, setAiPanelMode] = useState<AiPanelMode>('chat');
  const [pendingAiCommand, setPendingAiCommand] = useState<AiInitialCommand | null>(null);

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
          // Fetch all notes (no limit/offset) so we can filter first, then paginate
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

          // Client-side sort for wordCount (not supported by bridge)
          if (options?.sortBy === 'wordCount') {
            const dir = options.sortOrder === 'asc' ? 1 : -1;
            filtered = [...filtered].sort((a, b) => dir * (a.wordCount - b.wordCount));
          }

          const total = filtered.length;

          // Apply pagination after filtering
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

  const toggleCommandPalette = useCallback(() => setIsCommandPaletteOpen(prev => !prev), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);

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
    appAPI._notifyNoteCreated({ id: newNote.id, title: newNote.title, content: newNote.content });
    dataAPI._notifyNotesChanged({ kind: 'note', action: 'created', id: newNote.id });
  }, [createNote, selectedNotebookId, clearSearch, appAPI, dataAPI]);

  // Select note
  const handleSelectNote = useCallback(
    async (id: string) => {
      const result = await window.readied.notes.get(id);
      if (result.ok) {
        setSelectedNote(result.data);
        appAPI._notifyNoteSelected({
          id: result.data.id,
          title: result.data.title,
          content: result.data.content,
        });
      }
    },
    [appAPI]
  );

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
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'updated', id: selectedNote.id });
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
    [selectedNote, updateNote, syncLinks, dataAPI]
  );

  // Update note title
  const handleUpdateTitle = useCallback(
    async (title: string) => {
      if (!selectedNote) return;
      const updated = await updateNoteTitle.mutateAsync({ id: selectedNote.id, title });
      setSelectedNote(updated);
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'updated', id: selectedNote.id });

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
    [selectedNote, updateNoteTitle, dataAPI]
  );

  // Delete note
  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote.mutateAsync(id);
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
      appAPI._notifyNoteDeleted(id);
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'deleted', id });
    },
    [selectedNote, deleteNote, appAPI, dataAPI]
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

  // Register app commands (new note, duplicate, search, etc.)
  useRegisterAppCommands({
    onNewNote: handleNewNote,
    onDuplicateNote: useCallback(() => {
      if (selectedNote) handleDuplicateNote(selectedNote.id);
    }, [selectedNote, handleDuplicateNote]),
    onFocusSearch: useCallback(() => {
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      searchInput?.focus();
    }, []),
    onCycleViewMode: cycleViewMode,
    onToggleGraph: useCallback(() => setIsGraphOpen(prev => !prev), []),
    onOpenSettings: useCallback(() => window.readied.windows.openSettings(), []),
    onCommandPalette: toggleCommandPalette,
  });

  // Register AI commands (toggle panel, ask-notes)
  const toggleAiPanel = useCallback(() => {
    setIsAiPanelOpen(prev => {
      if (!prev) setAiPanelMode('chat');
      return !prev;
    });
  }, []);
  const closeAiPanel = useCallback(() => {
    setIsAiPanelOpen(false);
    setAiPanelMode('chat');
  }, []);
  const openAskNotes = useCallback(() => {
    setAiPanelMode('ask-notes');
    setIsAiPanelOpen(true);
  }, []);

  /** Helper: get selection text from editor */
  const getSelectionText = useCallback(() => {
    const view = getEditorView();
    if (!view) return '';
    const { from, to } = view.state.selection.main;
    return view.state.sliceDoc(from, to);
  }, []);

  /** Helper: replace selection in editor */
  const aiReplaceSelection = useCallback((text: string) => {
    const view = getEditorView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  /** Build and dispatch an AI command with given prompts and output target */
  const dispatchAiCommand = useCallback(
    (systemPrompt: string, userTemplate: string, outputTarget: 'replace' | 'insert' | 'panel') => {
      const selection = getSelectionText();
      if (!selection) return; // Nothing selected — no-op
      const userPrompt = resolveTemplate(userTemplate, { selection });
      setPendingAiCommand({ systemPrompt, userPrompt, outputTarget });
      setAiPanelMode('chat');
      setIsAiPanelOpen(true);
    },
    [getSelectionText]
  );

  const handleSummarize = useCallback(() => {
    dispatchAiCommand(SUMMARIZE_SYSTEM_PROMPT, SUMMARIZE_USER_TEMPLATE, 'panel');
  }, [dispatchAiCommand]);

  const handleRewrite = useCallback(() => {
    dispatchAiCommand(REWRITE_SYSTEM_PROMPT, REWRITE_USER_TEMPLATE, 'replace');
  }, [dispatchAiCommand]);

  const handleTweet = useCallback(() => {
    dispatchAiCommand(TWEET_SYSTEM_PROMPT, TWEET_USER_TEMPLATE, 'panel');
  }, [dispatchAiCommand]);

  const clearPendingAiCommand = useCallback(() => {
    setPendingAiCommand(null);
  }, []);

  useRegisterAiCommands({
    onTogglePanel: toggleAiPanel,
    onAskNotes: openAskNotes,
    onSummarize: handleSummarize,
    onRewrite: handleRewrite,
    onTweet: handleTweet,
  });

  // Bridge: plugin-registered AI commands → command palette → AI panel
  const handlePluginAiCommand = useCallback((command: AiInitialCommand) => {
    setPendingAiCommand(command);
    setAiPanelMode('chat');
    setIsAiPanelOpen(true);
  }, []);
  useRegisterPluginAiCommands(handlePluginAiCommand);

  // AI Panel callbacks — wired to existing app state
  const aiConfigCache = useRef<Record<string, unknown>>({});

  // Load AI plugin config once on mount
  useEffect(() => {
    window.readied.pluginConfig.getAll('readied-ai-assistant').then(config => {
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

  const aiInsertAtCursor = useCallback((text: string) => {
    const view = getEditorView();
    if (!view) return;
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  // Plugin runtime: init once, React observes
  const discoveredPlugins = useStore(pluginRuntimeStore, s => s.plugins);
  const pluginErrors = useStore(pluginRuntimeStore, s => s.errors);

  useEffect(() => {
    pluginRuntimeStore.getState().init();
  }, []);

  const allPlugins = useMemo(() => [...builtInPlugins, ...discoveredPlugins], [discoveredPlugins]);

  const configBridge = useMemo(
    () => ({
      getAll: (pluginId: string) => window.readied.pluginConfig.getAll(pluginId),
      set: (pluginId: string, key: string, value: unknown) =>
        window.readied.pluginConfig.set(pluginId, key, value),
    }),
    []
  );

  // Bridge: plugin commands → global CommandRegistry
  const registerPluginCommand = useCallback(
    (cmd: Record<string, unknown>) => commandRegistry.register(cmd as unknown as RegisteredCommand),
    []
  );

  // Bridge: CM6 editor updates → plugin EditorAPI events
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

  // Global keyboard handler (routes through CommandRegistry)
  useCommandKeybindings({
    onEscape: useCallback(() => {
      // Cascading escape: command palette → AI panel → graph → search → deselect note
      if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      } else if (isAiPanelOpen) {
        setIsAiPanelOpen(false);
      } else if (isGraphOpen) {
        setIsGraphOpen(false);
      } else if (searchQuery) {
        clearSearch();
      } else if (selectedNote) {
        setSelectedNote(null);
      }
    }, [isCommandPaletteOpen, isAiPanelOpen, isGraphOpen, searchQuery, selectedNote, clearSearch]),
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

            {/* AI Assistant Panel — right side */}
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
