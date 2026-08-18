import { useState, useCallback, useEffect } from 'react';
import type { AiPanelMode } from '@dripnex/ai-core';
import {
  SUMMARIZE_SYSTEM_PROMPT,
  SUMMARIZE_USER_TEMPLATE,
  REWRITE_SYSTEM_PROMPT,
  REWRITE_USER_TEMPLATE,
  TWEET_SYSTEM_PROMPT,
  TWEET_USER_TEMPLATE,
  resolveTemplate,
} from '@dripnex/ai-core';
import type { AiInitialCommand } from '../components/ai/AiPanel';
import { openSearchPanel } from '@codemirror/search';
import { useEditorPreferencesStore } from '../stores/editorPreferencesStore';
import { usePreviewFindStore } from '../stores/previewFindStore';
import type { NoteSnapshot } from '../../preload/index';
import { neighborId } from '../utils/neighborId';
import { useRegisterAiCommands } from './useRegisterAiCommands';
import { useRegisterPluginAiCommands } from './useRegisterPluginAiCommands';
import { useCommandKeybindings } from './useCommandKeybindings';
import { useRegisterAppCommands } from './useRegisterAppCommands';
import { getEditorView } from './useCommandRegistry';
import { useNavigationActions } from './useNavigation';
import { ensureNowBoard } from './useNowBoard';

interface UseAppCommandsOptions {
  handleNewNote: () => Promise<void>;
  handleDuplicateNote: (id: string) => Promise<void>;
  selectedNote: NoteSnapshot | null;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isGraphOpen: boolean;
  setIsGraphOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  searchQuery: string;
  clearSearch: () => void;
  setSelectedNote: (note: NoteSnapshot | null) => void;
  displayedNotes: ReadonlyArray<{ id: string }>;
  onSelectNote: (id: string) => void;
}

export function useAppCommands({
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
  displayedNotes,
  onSelectNote,
}: UseAppCommandsOptions) {
  const cycleViewMode = useEditorPreferencesStore(state => state.cycleViewMode);
  const togglePreview = useEditorPreferencesStore(state => state.togglePreview);
  const toggleSplit = useEditorPreferencesStore(state => state.toggleSplit);
  const toggleOutline = useEditorPreferencesStore(state => state.toggleOutline);
  const { goToAllNotes } = useNavigationActions();

  // AI panel state
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPanelMode, setAiPanelMode] = useState<AiPanelMode>('chat');
  const [pendingAiCommand, setPendingAiCommand] = useState<AiInitialCommand | null>(null);

  const toggleCommandPalette = useCallback(
    () => setIsCommandPaletteOpen(prev => !prev),
    [setIsCommandPaletteOpen]
  );
  const closeCommandPalette = useCallback(
    () => setIsCommandPaletteOpen(false),
    [setIsCommandPaletteOpen]
  );

  // Register app commands (new note, duplicate, search, etc.)
  useRegisterAppCommands({
    onNewNote: handleNewNote,
    onDuplicateNote: useCallback(() => {
      if (selectedNote) void handleDuplicateNote(selectedNote.id);
    }, [selectedNote, handleDuplicateNote]),
    onFocusSearch: useCallback(() => {
      const searchInput = document.getElementById('note-search') as HTMLInputElement | null;
      searchInput?.focus();
    }, []),
    onFindInNote: useCallback(() => {
      const viewMode = useEditorPreferencesStore.getState().viewMode;
      const view = getEditorView();
      if (view && (viewMode === 'editor' || viewMode === 'split')) {
        openSearchPanel(view);
        view.focus();
        return;
      }
      if (viewMode === 'preview' || viewMode === 'split') {
        usePreviewFindStore.getState().openPanel();
        return;
      }
      const searchInput = document.getElementById('note-search') as HTMLInputElement | null;
      searchInput?.focus();
    }, []),
    onCycleViewMode: cycleViewMode,
    onTogglePreview: togglePreview,
    onToggleSplit: toggleSplit,
    onNextNote: useCallback(() => {
      const next = neighborId(
        displayedNotes.map(n => n.id),
        selectedNote?.id ?? null,
        1
      );
      if (next) onSelectNote(next);
    }, [displayedNotes, selectedNote?.id, onSelectNote]),
    onPrevNote: useCallback(() => {
      const prev = neighborId(
        displayedNotes.map(n => n.id),
        selectedNote?.id ?? null,
        -1
      );
      if (prev) onSelectNote(prev);
    }, [displayedNotes, selectedNote?.id, onSelectNote]),
    onSaveNote: useCallback(() => {
      window.dispatchEvent(new Event('dripnex:save-note'));
    }, []),
    onToggleOutline: toggleOutline,
    onToggleGraph: useCallback(() => setIsGraphOpen(prev => !prev), [setIsGraphOpen]),
    onOpenSettings: useCallback(() => window.dripnex.windows.openSettings(), []),
    onCommandPalette: toggleCommandPalette,
    onOpenNowBoard: useCallback(() => {
      void (async () => {
        const result = await ensureNowBoard();
        if (!result) return;
        goToAllNotes();
        setSelectedNote(result.note);
        clearSearch();
      })();
    }, [goToAllNotes, setSelectedNote, clearSearch]),
    onOpenInitScript: useCallback(() => {
      void window.dripnex.plugins.openUserFile('init');
    }, []),
    onOpenUserStyles: useCallback(() => {
      void window.dripnex.plugins.openUserFile('styles');
    }, []),
    onOpenKeymap: useCallback(() => {
      void window.dripnex.plugins.openUserFile('keymap');
    }, []),
    onReloadPlugins: useCallback(() => {
      window.dripnex.plugins.requestReload();
    }, []),
  });

  // AI panel toggle/modes
  const toggleAiPanel = useCallback(() => {
    setIsAiPanelOpen(prev => {
      if (!prev) setAiPanelMode('ask-notes');
      return !prev;
    });
  }, []);
  const closeAiPanel = useCallback(() => {
    setIsAiPanelOpen(false);
    setAiPanelMode('ask-notes');
  }, []);
  const openAskNotes = useCallback(() => {
    setAiPanelMode('ask-notes');
    setIsAiPanelOpen(true);
  }, []);

  // Listen for the plugin's Sparkles button CustomEvent
  useEffect(() => {
    const handler = () => toggleAiPanel();
    window.addEventListener('dripnex:ai:toggle-panel', handler);
    return () => window.removeEventListener('dripnex:ai:toggle-panel', handler);
  }, [toggleAiPanel]);

  /** Helper: get selection text from editor */
  const getSelectionText = useCallback(() => {
    const view = getEditorView();
    if (!view) return '';
    const { from, to } = view.state.selection.main;
    return view.state.sliceDoc(from, to);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ system?: string; instruction?: string }>).detail;
      const selection = getSelectionText();
      if (!selection || !detail?.system) return;
      const extra = detail.instruction ? `\n\nInstruction: ${detail.instruction}` : '';
      setPendingAiCommand({
        systemPrompt: detail.system,
        userPrompt: `Selection:\n${selection}${extra}`,
        outputTarget: 'replace',
      });
      setAiPanelMode('chat');
      setIsAiPanelOpen(true);
    };
    window.addEventListener('dripnex:ai:edit', handler);
    return () => window.removeEventListener('dripnex:ai:edit', handler);
  }, [getSelectionText]);

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
      if (!selection) return;
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

  // Bridge: plugin-registered AI commands -> command palette -> AI panel
  const handlePluginAiCommand = useCallback((command: AiInitialCommand) => {
    setPendingAiCommand(command);
    setAiPanelMode('chat');
    setIsAiPanelOpen(true);
  }, []);
  useRegisterPluginAiCommands(handlePluginAiCommand);

  // Global keyboard handler (routes through CommandRegistry)
  useCommandKeybindings({
    onEscape: useCallback(() => {
      // Cascading escape: command palette -> AI panel -> graph -> search -> deselect note
      if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      } else if (isAiPanelOpen) {
        setIsAiPanelOpen(false);
      } else if (isGraphOpen) {
        setIsGraphOpen(false);
      } else if (usePreviewFindStore.getState().open) {
        usePreviewFindStore.getState().closePanel();
      } else if (searchQuery) {
        clearSearch();
      } else if (selectedNote) {
        setSelectedNote(null);
      }
    }, [
      isCommandPaletteOpen,
      isAiPanelOpen,
      isGraphOpen,
      searchQuery,
      selectedNote,
      clearSearch,
      setIsCommandPaletteOpen,
      setIsGraphOpen,
      setSelectedNote,
    ]),
  });

  /** Helper: insert at cursor in editor */
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

  return {
    isAiPanelOpen,
    aiPanelMode,
    pendingAiCommand,
    openAskNotes,
    closeAiPanel,
    clearPendingAiCommand,
    aiReplaceSelection,
    aiInsertAtCursor,
    toggleCommandPalette,
    closeCommandPalette,
  };
}
