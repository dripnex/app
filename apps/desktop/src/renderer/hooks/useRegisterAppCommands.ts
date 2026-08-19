import { useEffect, useRef } from 'react';
import { appCommands } from '@dripnex/command-registry/definitions';
import { registry } from './useCommandRegistry';

interface AppCommandHandlers {
  onOpenNote: (noteId: string) => void;
  onNewNote: () => void;
  onDuplicateNote: () => void;
  onFocusSearch: () => void;
  onFindInNote: () => void;
  onCycleViewMode: () => void;
  onTogglePreview: () => void;
  onToggleSplit: () => void;
  onNextNote: () => void;
  onPrevNote: () => void;
  onSaveNote: () => void;
  onToggleOutline: () => void;
  onToggleGraph: () => void;
  onOpenSettings: () => void;
  onCommandPalette: () => void;
  onQuickOpen: () => void;
  onJumpNotebook: () => void;
  onJumpTag: () => void;
  onOpenNowBoard: () => void;
  onOpenInitScript: () => void;
  onOpenUserStyles: () => void;
  onOpenKeymap: () => void;
  onReloadPlugins: () => void;
  onNoteBack: () => void;
  onNoteForward: () => void;
  onToggleZen: () => void;
  onOpenInWindow: () => void;
}

/**
 * Register app-level commands (new note, duplicate, search, etc.)
 * Closes over the provided handler functions.
 */
export function useRegisterAppCommands(handlers: AppCommandHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const executors: Record<string, (payload?: Record<string, unknown>) => void> = {
      'app:open-note': payload => {
        const noteId = typeof payload?.noteId === 'string' ? payload.noteId : null;
        if (noteId) handlersRef.current.onOpenNote(noteId);
      },
      'app:new-note': () => handlersRef.current.onNewNote(),
      'app:duplicate-note': () => handlersRef.current.onDuplicateNote(),
      'app:focus-search': () => handlersRef.current.onFocusSearch(),
      'app:find-in-note': () => handlersRef.current.onFindInNote(),
      'app:cycle-view-mode': () => handlersRef.current.onCycleViewMode(),
      'app:toggle-preview': () => handlersRef.current.onTogglePreview(),
      'app:toggle-split': () => handlersRef.current.onToggleSplit(),
      'app:next-note': () => handlersRef.current.onNextNote(),
      'app:prev-note': () => handlersRef.current.onPrevNote(),
      'app:save-note': () => handlersRef.current.onSaveNote(),
      'app:toggle-outline': () => handlersRef.current.onToggleOutline(),
      'app:toggle-graph': () => handlersRef.current.onToggleGraph(),
      'app:open-settings': () => handlersRef.current.onOpenSettings(),
      'app:command-palette': () => handlersRef.current.onCommandPalette(),
      'app:quick-open': () => handlersRef.current.onQuickOpen(),
      'app:jump-notebook': () => handlersRef.current.onJumpNotebook(),
      'app:jump-tag': () => handlersRef.current.onJumpTag(),
      'app:open-now-board': () => handlersRef.current.onOpenNowBoard(),
      'app:open-init-script': () => handlersRef.current.onOpenInitScript(),
      'app:open-user-styles': () => handlersRef.current.onOpenUserStyles(),
      'app:open-keymap': () => handlersRef.current.onOpenKeymap(),
      'app:reload-plugins': () => handlersRef.current.onReloadPlugins(),
      'app:note-back': () => handlersRef.current.onNoteBack(),
      'app:note-forward': () => handlersRef.current.onNoteForward(),
      'app:toggle-zen': () => handlersRef.current.onToggleZen(),
      'app:open-in-window': () => handlersRef.current.onOpenInWindow(),
    };

    const unregisters: Array<() => void> = [];

    for (const def of appCommands) {
      const executor = executors[def.id];
      if (executor) {
        const unregister = registry.register({
          ...def,
          execute: payload => {
            executor(payload);
            return true;
          },
        });
        unregisters.push(unregister);
      }
    }

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, []);
}
