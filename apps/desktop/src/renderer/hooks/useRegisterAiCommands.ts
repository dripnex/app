import { useEffect, useRef } from 'react';
import { aiCommands } from '@readied/command-registry/definitions';
import { registry } from './useCommandRegistry';

interface AiCommandHandlers {
  onTogglePanel: () => void;
  onAskNotes: () => void;
  onSummarize: () => void;
  onRewrite: () => void;
  onTweet: () => void;
}

/**
 * Register AI-related commands (toggle panel, ask-notes, summarize, rewrite, tweet)
 * Follows the same pattern as useRegisterAppCommands.
 */
export function useRegisterAiCommands(handlers: AiCommandHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const executors: Record<string, () => void> = {
      'ai:toggle-panel': () => handlersRef.current.onTogglePanel(),
      'ai:ask-notes': () => handlersRef.current.onAskNotes(),
      'ai:summarize': () => handlersRef.current.onSummarize(),
      'ai:rewrite': () => handlersRef.current.onRewrite(),
      'ai:tweet': () => handlersRef.current.onTweet(),
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
