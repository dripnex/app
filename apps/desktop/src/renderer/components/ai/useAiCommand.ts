import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ChatMessage, LLMEvent } from '@dripnex/ai-core';
import { useSettingsStore } from '../../stores/settings';
import { humanizeAiError } from './humanizeAiError';
import { resolveAiAuth } from './resolveAiAuth';
import type { AiInitialCommand } from './types';

const CHAT_MAX_RESPONSE_TOKENS = 2048;

interface UseAiCommandArgs {
  initialCommand: AiInitialCommand | null;
  getConfig: <T>(key: string) => T | undefined;
  insertAtCursor: (text: string) => void;
  replaceSelection?: (text: string) => void;
  onCommandExecuted?: () => void;
  activeRequestRef: MutableRefObject<string | null>;
  commandActiveRef: MutableRefObject<boolean>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}

export function useAiCommand({
  initialCommand,
  getConfig,
  insertAtCursor,
  replaceSelection,
  onCommandExecuted,
  activeRequestRef,
  commandActiveRef,
  setMessages,
  setError,
  setLoading,
}: UseAiCommandArgs): void {
  useEffect(() => {
    if (!initialCommand) return;

    let cancelled = false;
    let commandCleanup: (() => void) | null = null;

    const execute = async () => {
      const auth = resolveAiAuth(useSettingsStore.getState().settings.ai, getConfig);
      if (auth.missingKey) {
        setError('Please set your API key in Settings > AI Assistant');
        onCommandExecuted?.();
        return;
      }
      if (cancelled) return;

      setMessages(prev => [...prev, { role: 'user', content: initialCommand.userPrompt }]);
      setLoading(true);
      setError(null);

      const commandOutputTarget = initialCommand.outputTarget;
      let accumulatedText = '';
      commandActiveRef.current = true;

      commandCleanup = window.dripnex.ai.onEvent((requestId: string, rawEvent: unknown) => {
        if (requestId !== activeRequestRef.current) return;

        const event = rawEvent as LLMEvent;

        switch (event.type) {
          case 'text':
            accumulatedText += event.delta;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: accumulatedText };
                return updated;
              }
              return [...prev, { role: 'assistant', content: accumulatedText }];
            });
            break;

          case 'error':
            setError(humanizeAiError(event.code, event.error));
            setLoading(false);
            activeRequestRef.current = null;
            onCommandExecuted?.();
            commandActiveRef.current = false;
            commandCleanup?.();
            break;

          case 'done': {
            if (commandOutputTarget === 'replace' && replaceSelection) {
              replaceSelection(accumulatedText);
              appendAssistantNote(setMessages, accumulatedText, 'Selection replaced in editor');
            } else if (commandOutputTarget === 'insert') {
              insertAtCursor(accumulatedText);
              appendAssistantNote(setMessages, accumulatedText, 'Inserted into editor');
            }

            setLoading(false);
            activeRequestRef.current = null;
            onCommandExecuted?.();
            commandActiveRef.current = false;
            commandCleanup?.();
            break;
          }
        }
      });

      try {
        const { requestId } = await window.dripnex.ai.chat({
          query: initialCommand.userPrompt,
          currentNote: null,
          relevantNotes: [],
          history: [],
          mode: 'chat',
          provider: auth.provider,
          model: auth.model,
          providerConfig: { apiKey: auth.apiKey, baseUrl: auth.baseUrl },
          maxResponseTokens: CHAT_MAX_RESPONSE_TOKENS,
        });
        if (cancelled) {
          commandCleanup?.();
          commandActiveRef.current = false;
          return;
        }
        activeRequestRef.current = requestId;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        onCommandExecuted?.();
        commandCleanup?.();
        commandActiveRef.current = false;
      }
    };

    void execute();
    return () => {
      cancelled = true;
      commandCleanup?.();
      commandActiveRef.current = false;
    };
  }, [initialCommand]); // only re-run when the command itself changes
}

function appendAssistantNote(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  text: string,
  note: string
): void {
  setMessages(prev => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    if (last && last.role === 'assistant') {
      updated[updated.length - 1] = { ...last, content: `${text}\n\n*(${note})*` };
    }
    return updated;
  });
}
