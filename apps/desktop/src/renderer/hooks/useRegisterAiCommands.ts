import { useEffect, useRef } from 'react';
import { aiCommands } from '@readied/command-registry/definitions';
import { registry } from './useCommandRegistry';

interface AiCommandHandlers {
  onTogglePanel: () => void;
  onAskNotes: () => void;
}

/**
 * Register AI-related commands (toggle panel, ask-notes, etc.)
 * Follows the same pattern as useRegisterAppCommands.
 */
export function useRegisterAiCommands(handlers: AiCommandHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const executors: Record<string, () => void> = {
      'ai:toggle-panel': () => handlersRef.current.onTogglePanel(),
      'ai:ask-notes': () => handlersRef.current.onAskNotes(),
    };

    const unregisters: Array<() => void> = [];

    for (const def of aiCommands) {
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
