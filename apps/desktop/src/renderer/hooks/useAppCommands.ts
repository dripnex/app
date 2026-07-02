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
import { useEditorPreferencesStore } from '../stores/editorPreferencesStore';
import type { NoteSnapshot } from '../../preload/index';
import { useRegisterAiCommands } from './useRegisterAiCommands';
import { useRegisterPluginAiCommands } from './useRegisterPluginAiCommands';
import { useCommandKeybindings } from './useCommandKeybindings';
import { useRegisterAppCommands } from './useRegisterAppCommands';
import { getEditorView } from './useCommandRegistry';

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
}: UseAppCommandsOptions) {
  const cycleViewMode = useEditorPreferencesStore(state => state.cycleViewMode);

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
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      searchInput?.focus();
    }, []),
    onCycleViewMode: cycleViewMode,
    onToggleGraph: useCallback(() => setIsGraphOpen(prev => !prev), [setIsGraphOpen]),
    onOpenSettings: useCallback(() => window.dripnex.windows.openSettings(), []),
    onCommandPalette: toggleCommandPalette,
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
    closeAiPanel,
    clearPendingAiCommand,
    aiReplaceSelection,
    aiInsertAtCursor,
    toggleCommandPalette,
    closeCommandPalette,
  };
}
