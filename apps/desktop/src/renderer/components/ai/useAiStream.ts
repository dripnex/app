import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ChatMessage, LLMEvent } from '@dripnex/ai-core';
import { humanizeAiError } from './humanizeAiError';
import type { ToolCallRecord } from './types';

interface UseAiStreamArgs {
  activeRequestRef: MutableRefObject<string | null>;
  commandActiveRef: MutableRefObject<boolean>;
  insertAtCursor: (text: string) => void;
  replaceSelection?: (text: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setToolCalls: Dispatch<SetStateAction<Map<string, ToolCallRecord>>>;
}

export function useAiStream({
  activeRequestRef,
  commandActiveRef,
  insertAtCursor,
  replaceSelection,
  setMessages,
  setError,
  setLoading,
  setToolCalls,
}: UseAiStreamArgs): void {
  useEffect(() => {
    const cleanup = window.dripnex.ai.onToolExecuteRequest(
      async (requestId: string, callId: string, toolName: string, args: unknown) => {
        const toolArgs = args as Record<string, unknown>;
        try {
          if (toolName === 'insert_text') {
            const text = toolArgs.text as string;
            insertAtCursor(text);
            await window.dripnex.ai.sendToolResult(requestId, callId, {
              ok: true,
              content: `Inserted ${text.length} characters at cursor`,
            });
          } else if (toolName === 'replace_selection' && replaceSelection) {
            const text = toolArgs.text as string;
            replaceSelection(text);
            await window.dripnex.ai.sendToolResult(requestId, callId, {
              ok: true,
              content: `Replaced selection with ${text.length} characters`,
            });
          } else {
            await window.dripnex.ai.sendToolResult(requestId, callId, {
              ok: false,
              content: `Unknown renderer tool: ${toolName}`,
              error: `Unknown renderer tool: ${toolName}`,
            });
          }
        } catch (err) {
          await window.dripnex.ai.sendToolResult(requestId, callId, {
            ok: false,
            content: err instanceof Error ? err.message : String(err),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    );
    return cleanup;
  }, [insertAtCursor, replaceSelection]);

  useEffect(() => {
    const cleanup = window.dripnex.ai.onEvent((requestId: string, rawEvent: unknown) => {
      if (requestId !== activeRequestRef.current) return;
      if (commandActiveRef.current) return;

      const event = rawEvent as LLMEvent;

      switch (event.type) {
        case 'text':
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                content: (last.content as string) + event.delta,
              };
              return updated;
            }
            return [...prev, { role: 'assistant', content: event.delta }];
          });
          break;

        case 'error': {
          const errorEvent = event as LLMEvent & { type: 'error'; retryable?: boolean };
          setError(humanizeAiError(event.code, event.error));
          if (!errorEvent.retryable) {
            setLoading(false);
            activeRequestRef.current = null;
          }
          break;
        }

        case 'done':
          setLoading(false);
          activeRequestRef.current = null;
          break;

        case 'tool_call':
          setToolCalls(prev => {
            const next = new Map(prev);
            const e = event as LLMEvent & {
              type: 'tool_call';
              id: string;
              name: string;
              args: unknown;
            };
            next.set(e.id, {
              name: e.name,
              args: (e.args as Record<string, unknown>) ?? {},
              status: 'executing',
            });
            return next;
          });
          break;

        case 'tool_confirm_needed' as string:
          setToolCalls(prev => {
            const next = new Map(prev);
            const e = event as unknown as { callId: string };
            const existing = next.get(e.callId);
            if (existing) {
              next.set(e.callId, { ...existing, status: 'pending_confirmation' });
            }
            return next;
          });
          break;

        case 'tool_executing' as string:
          setToolCalls(prev => {
            const next = new Map(prev);
            const e = event as unknown as {
              call: { id: string; name: string; args: Record<string, unknown> };
            };
            const existing = next.get(e.call.id);
            if (existing) {
              next.set(e.call.id, { ...existing, status: 'executing' });
            } else {
              next.set(e.call.id, { name: e.call.name, args: e.call.args, status: 'executing' });
            }
            return next;
          });
          break;

        case 'tool_complete' as string:
          setToolCalls(prev => {
            const next = new Map(prev);
            const e = event as unknown as {
              call: { id: string };
              result: { ok: boolean; content: string; error?: string };
            };
            const existing = next.get(e.call.id);
            if (existing) {
              next.set(e.call.id, {
                ...existing,
                status: e.result.ok ? 'complete' : 'error',
                result: e.result,
              });
            }
            return next;
          });
          break;
      }
    });

    return cleanup;
  }, [activeRequestRef, commandActiveRef, setError, setLoading, setMessages, setToolCalls]);
}
