import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Trash2, ArrowDownToLine, BookOpen, MessageSquare } from 'lucide-react';
import type { ChatMessage, NoteContext, AiPanelMode, LLMEvent } from '@dripnex/ai-core';
import { useSettingsStore, selectAi } from '../../stores/settings';
import { AiMessage } from './AiMessage';
import { ToolCallBlock } from './ToolCallBlock';

/** Pre-filled command to auto-execute on mount (used by ai:summarize, ai:rewrite, ai:tweet) */
export interface AiInitialCommand {
  systemPrompt: string;
  userPrompt: string;
  outputTarget: 'replace' | 'insert' | 'panel';
}

interface AiPanelProps {
  onClose: () => void;
  getCurrentNote: () => { id: string; title: string; content: string } | null;
  searchNotes: (query: string) => Promise<Array<{ id: string; title: string }>>;
  getNoteById: (id: string) => Promise<{ id: string; title: string; content: string } | null>;
  getConfig: <T>(key: string) => T | undefined;
  insertAtCursor: (text: string) => void;
  /** Initial mode: 'chat' (default) or 'ask-notes' */
  initialMode?: AiPanelMode;
  /** Pre-filled command to auto-execute (skip input, go straight to AI) */
  initialCommand?: AiInitialCommand | null;
  /** Replace the current editor selection with text */
  replaceSelection?: (text: string) => void;
  /** Callback to clear initialCommand after execution */
  onCommandExecuted?: () => void;
}

/** Map raw LLM error codes to user-friendly messages */
function humanizeAiError(code: string, rawMessage: string): string {
  switch (code) {
    case 'auth_failed':
      return 'API key is invalid or expired. Check your key in Settings > AI.';
    case 'rate_limit':
      return 'Rate limit reached. Please wait a moment and try again.';
    case 'provider_error':
      return 'The AI provider returned an error. Try again or switch models.';
    case 'network':
      return "Can't reach the AI service. Check your internet connection.";
    case 'context_overflow':
      return 'Your note is too long for this model. Try selecting less text.';
    case 'model_not_found':
      return 'The selected model is not available. Check Settings > AI.';
    case 'cancelled':
      return 'Request was cancelled.';
    case 'timeout':
      return 'Request timed out. Please try again.';
    default:
      return rawMessage || 'Something went wrong. Please try again.';
  }
}

export function AiPanel({
  onClose,
  getCurrentNote,
  searchNotes,
  getNoteById,
  getConfig,
  insertAtCursor,
  initialMode = 'chat',
  initialCommand = null,
  replaceSelection,
  onCommandExecuted,
}: AiPanelProps) {
  const aiSettings = useSettingsStore(selectAi);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AiPanelMode>(initialMode);
  const [contextCount, setContextCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRequestRef = useRef<string | null>(null);
  const commandActiveRef = useRef(false);

  // Tool call tracking
  const [toolCalls, setToolCalls] = useState<
    Map<
      string,
      {
        name: string;
        args: Record<string, unknown>;
        status: 'pending_confirmation' | 'executing' | 'complete' | 'rejected' | 'error';
        result?: { ok: boolean; content: string; error?: string };
      }
    >
  >(new Map());

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Rehydrate the API key from safeStorage (OS keychain) into the in-memory
  // store. The key is intentionally NOT persisted to localStorage (see
  // settingsStore partialize), so after an app restart it must be loaded from
  // the encrypted keychain before the chat flow can use it.
  //
  // Keyed on provider only: whenever the provider changes we must load THAT
  // provider's key (and clear a stale key from the previous provider), so we
  // don't send provider A's key to provider B. Depending on apiKey too would
  // both loop and skip reloads when a stale key is present.
  useEffect(() => {
    if (aiSettings.provider === 'ollama') return;
    let cancelled = false;
    void (async () => {
      try {
        const key = await window.dripnex.ai.getKey(aiSettings.provider);
        if (!cancelled) {
          useSettingsStore.getState().updateAi({ apiKey: key ?? '' });
        }
      } catch {
        // safeStorage unavailable (e.g. locked keychain) — leave key empty;
        // the submit handler surfaces a "set your API key" message.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aiSettings.provider]);

  // Sync mode when initialMode prop changes (e.g. ai:ask-notes command while panel open)
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Listen for renderer-executed tool requests from main process
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

  // Subscribe to AI streaming events
  useEffect(() => {
    const cleanup = window.dripnex.ai.onEvent((requestId: string, rawEvent: unknown) => {
      // Only process events for the active request; skip when a command listener owns the stream
      if (requestId !== activeRequestRef.current) return;
      if (commandActiveRef.current) return;

      const event = rawEvent as LLMEvent;

      switch (event.type) {
        case 'text':
          // Accumulate text delta into the last assistant message
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
            // First text event — create the assistant message
            return [...prev, { role: 'assistant', content: event.delta }];
          });
          break;

        case 'error': {
          const errorEvent = event as LLMEvent & { type: 'error'; retryable?: boolean };
          if (errorEvent.retryable) {
            // Transient retry — show message but don't tear down the stream
            setError(humanizeAiError(event.code, event.error));
          } else {
            setError(humanizeAiError(event.code, event.error));
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
              const status = e.result.ok ? 'complete' : 'error';
              next.set(e.call.id, { ...existing, status, result: e.result });
            }
            return next;
          });
          break;
      }
    });

    return cleanup;
  }, []);

  // Auto-execute a pre-filled command (ai:summarize, ai:rewrite, ai:tweet)
  useEffect(() => {
    if (!initialCommand) return;

    const execute = async () => {
      const aiSettings_ = useSettingsStore.getState().settings.ai;
      const hasSettingsKey = Boolean(aiSettings_.apiKey);
      const apiKey = hasSettingsKey ? aiSettings_.apiKey : getConfig<string>('apiKey');
      if (!apiKey) {
        setError('Please set your API key in Settings > AI Assistant');
        onCommandExecuted?.();
        return;
      }

      const model = hasSettingsKey
        ? aiSettings_.model
        : getConfig<string>('model') || 'claude-sonnet-4-20250514';
      const provider = aiSettings_.provider;

      // Show user message in chat
      const userMsg: ChatMessage = { role: 'user', content: initialCommand.userPrompt };
      setMessages(prev => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      // Track the output target for when the response arrives
      const commandOutputTarget = initialCommand.outputTarget;
      let accumulatedText = '';
      commandActiveRef.current = true;

      // Set up a one-time listener for this command's events
      const commandCleanup = window.dripnex.ai.onEvent((requestId: string, rawEvent: unknown) => {
        if (requestId !== activeRequestRef.current) return;

        const event = rawEvent as LLMEvent;

        switch (event.type) {
          case 'text':
            accumulatedText += event.delta;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...last,
                  content: accumulatedText,
                };
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
            commandCleanup();
            break;

          case 'done': {
            // Apply the output action
            if (commandOutputTarget === 'replace' && replaceSelection) {
              replaceSelection(accumulatedText);
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: accumulatedText + '\n\n*(Selection replaced in editor)*',
                  };
                }
                return updated;
              });
            } else if (commandOutputTarget === 'insert') {
              insertAtCursor(accumulatedText);
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: accumulatedText + '\n\n*(Inserted into editor)*',
                  };
                }
                return updated;
              });
            }
            // 'panel' — text already shown in chat

            setLoading(false);
            activeRequestRef.current = null;
            onCommandExecuted?.();
            commandActiveRef.current = false;
            commandCleanup();
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
          provider,
          model,
          providerConfig: { apiKey },
          maxResponseTokens: 2048,
        });
        activeRequestRef.current = requestId;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        onCommandExecuted?.();
        commandCleanup();
      }
    };

    void execute();
  }, [initialCommand]); // intentionally depends only on initialCommand

  const handleSubmit = useCallback(async () => {
    const query = input.trim();
    if (!query || loading) return;

    // Prefer settings store, fall back to plugin config for backwards compatibility
    const hasSettingsKey = Boolean(aiSettings.apiKey);
    const apiKey = hasSettingsKey ? aiSettings.apiKey : getConfig<string>('apiKey');
    if (!apiKey) {
      setError('Please set your API key in Settings > AI Assistant');
      return;
    }

    const model = hasSettingsKey
      ? aiSettings.model
      : getConfig<string>('model') || 'claude-sonnet-4-20250514';
    const provider = aiSettings.provider;
    const maxContextNotes = hasSettingsKey
      ? aiSettings.maxContextNotes
      : getConfig<number>('maxContextNotes') || 5;

    setInput('');
    setError(null);

    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Gather context
      const currentNote = getCurrentNote();
      const relevantNotes: NoteContext[] = [];

      // In ask-notes mode, search for relevant notes across the vault
      // In chat mode, only use the current note as context
      if (mode === 'ask-notes') {
        const searchResults = await searchNotes(query);

        for (const result of searchResults.slice(0, maxContextNotes)) {
          const note = await getNoteById(result.id);
          if (note) {
            relevantNotes.push({
              id: note.id,
              title: note.title,
              content: note.content,
            });
          }
        }

        // Also search for notes related to the current note's title
        if (currentNote && relevantNotes.length < maxContextNotes) {
          const relatedResults = await searchNotes(currentNote.title);
          const existingIds = new Set([...relevantNotes.map(n => n.id), currentNote.id]);
          for (const result of relatedResults) {
            if (relevantNotes.length >= maxContextNotes) break;
            if (existingIds.has(result.id)) continue;
            const note = await getNoteById(result.id);
            if (note) {
              relevantNotes.push({
                id: note.id,
                title: note.title,
                content: note.content,
              });
              existingIds.add(note.id);
            }
          }
        }
      }

      // Track how many notes are being used as context
      const totalContext = relevantNotes.length + (currentNote ? 1 : 0);
      setContextCount(totalContext);

      // Build history from existing messages (string content only for IPC)
      const history = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      }));

      // Start streaming chat via IPC
      const { requestId } = await window.dripnex.ai.chat({
        query,
        currentNote: currentNote
          ? { id: currentNote.id, title: currentNote.title, content: currentNote.content }
          : null,
        relevantNotes,
        history,
        mode,
        provider,
        model,
        providerConfig: { apiKey },
        maxResponseTokens: 2048,
        tools: true,
      });
      activeRequestRef.current = requestId;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [
    input,
    loading,
    messages,
    aiSettings,
    getConfig,
    getCurrentNote,
    searchNotes,
    getNoteById,
    mode,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleToolConfirm = useCallback((callId: string) => {
    if (activeRequestRef.current) {
      void window.dripnex.ai.confirmTool(activeRequestRef.current, callId, true);
    }
  }, []);

  const handleToolReject = useCallback((callId: string) => {
    if (activeRequestRef.current) {
      void window.dripnex.ai.confirmTool(activeRequestRef.current, callId, false);
      setToolCalls(prev => {
        const next = new Map(prev);
        const existing = next.get(callId);
        if (existing) next.set(callId, { ...existing, status: 'rejected' });
        return next;
      });
    }
  }, []);

  const handleClear = useCallback(() => {
    // Cancel any active request
    if (activeRequestRef.current) {
      void window.dripnex.ai.cancel(activeRequestRef.current);
      activeRequestRef.current = null;
    }
    setMessages([]);
    setError(null);
    setContextCount(0);
    setToolCalls(new Map());
    setLoading(false);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(prev => (prev === 'chat' ? 'ask-notes' : 'chat'));
  }, []);

  const handleInsertLast = useCallback(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      insertAtCursor(typeof lastAssistant.content === 'string' ? lastAssistant.content : '');
    }
  }, [messages, insertAtCursor]);

  const lastAssistantExists = messages.some(m => m.role === 'assistant');

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-header-left">
          <span className="ai-panel-title">
            {mode === 'ask-notes' ? 'Ask Your Notes' : 'AI Assistant'}
          </span>
          {contextCount > 0 && (
            <span
              className="ai-panel-context-badge"
              title={`${contextCount} note(s) used as context`}
            >
              {contextCount} {contextCount === 1 ? 'note' : 'notes'}
            </span>
          )}
        </div>
        <div className="ai-panel-actions">
          <button
            className={`ai-panel-btn${mode === 'ask-notes' ? ' active' : ''}`}
            onClick={toggleMode}
            title={mode === 'ask-notes' ? 'Switch to Chat mode' : 'Switch to Ask Notes mode'}
          >
            {mode === 'ask-notes' ? <MessageSquare size={14} /> : <BookOpen size={14} />}
          </button>
          {lastAssistantExists && (
            <button
              className="ai-panel-btn"
              onClick={handleInsertLast}
              title="Insert last response into note"
            >
              <ArrowDownToLine size={14} />
            </button>
          )}
          {messages.length > 0 && (
            <button className="ai-panel-btn" onClick={handleClear} title="Clear conversation">
              <Trash2 size={14} />
            </button>
          )}
          <button className="ai-panel-btn" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="ai-panel-messages">
        {messages.length === 0 && !loading && (
          <div className="ai-panel-empty">
            {mode === 'ask-notes'
              ? 'Ask a question and the AI will answer using your notes as context.'
              : 'Ask a question about your notes or the current document.'}
          </div>
        )}
        {messages.map((msg, i) => (
          <AiMessage
            key={i}
            role={msg.role}
            content={typeof msg.content === 'string' ? msg.content : ''}
          />
        ))}
        {toolCalls.size > 0 &&
          Array.from(toolCalls.entries()).map(([callId, tc]) => (
            <ToolCallBlock
              key={callId}
              name={tc.name}
              args={tc.args}
              status={tc.status}
              result={tc.result}
              onConfirm={() => handleToolConfirm(callId)}
              onReject={() => handleToolReject(callId)}
            />
          ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="ai-message ai-message--assistant">
            <div className="ai-message-label">AI</div>
            <div className="ai-message-content ai-typing">Thinking...</div>
          </div>
        )}
        {error && <div className="ai-panel-error">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-panel-input">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === 'ask-notes' ? 'Ask your notes a question...' : 'Ask about your notes...'
          }
          rows={2}
          disabled={loading}
        />
        <button
          className="ai-panel-send"
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          title="Send (Enter)"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
