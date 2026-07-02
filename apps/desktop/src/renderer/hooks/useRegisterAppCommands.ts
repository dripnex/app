import { useEffect, useRef } from 'react';
import { appCommands } from '@dripnex/command-registry/definitions';
import { registry } from './useCommandRegistry';

interface AppCommandHandlers {
  onNewNote: () => void;
  onDuplicateNote: () => void;
  onFocusSearch: () => void;
  onCycleViewMode: () => void;
  onToggleGraph: () => void;
  onOpenSettings: () => void;
  onCommandPalette: () => void;
}

/**
 * Register app-level commands (new note, duplicate, search, etc.)
 * Closes over the provided handler functions.
 */
export function useRegisterAppCommands(handlers: AppCommandHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const executors: Record<string, () => void> = {
      'app:new-note': () => handlersRef.current.onNewNote(),
      'app:duplicate-note': () => handlersRef.current.onDuplicateNote(),
      'app:focus-search': () => handlersRef.current.onFocusSearch(),
      'app:cycle-view-mode': () => handlersRef.current.onCycleViewMode(),
      'app:toggle-graph': () => handlersRef.current.onToggleGraph(),
      'app:open-settings': () => handlersRef.current.onOpenSettings(),
      'app:command-palette': () => handlersRef.current.onCommandPalette(),
    };

    const unregisters: Array<() => void> = [];

    for (const def of appCommands) {
      const executor = executors[def.id];
      if (executor) {
        const unregister = registry.register({
          ...def,
          execute: () => {
            executor();
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
