import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessage, NoteContext, AiPanelMode } from '@dripnex/ai-core';
import { useSettingsStore, selectAi } from '../../stores/settings';
import { AiMessage } from './AiMessage';
import { AiPanelHeader } from './AiPanelHeader';
import { ToolCallBlock } from './ToolCallBlock';
import { resolveAiAuth } from './resolveAiAuth';
import { useAiCommand } from './useAiCommand';
import { useAiKeyHydration } from './useAiKeyHydration';
import { useAiStream } from './useAiStream';
import { sc } from './sc';
import type { AiCitation, AiInitialCommand, ToolCallRecord } from './types';

export type { AiInitialCommand } from './types';

const CHAT_MAX_RESPONSE_TOKENS = 2048;

interface AiPanelProps {
  onClose: () => void;
  getCurrentNote: () => { id: string; title: string; content: string } | null;
  getConfig: <T>(key: string) => T | undefined;
  insertAtCursor: (text: string) => void;
  initialMode?: AiPanelMode;
  initialCommand?: AiInitialCommand | null;
  replaceSelection?: (text: string) => void;
  onCommandExecuted?: () => void;
  onOpenNote?: (noteId: string) => void;
}

export function AiPanel({
  onClose,
  getCurrentNote,
  getConfig,
  insertAtCursor,
  initialMode = 'chat',
  initialCommand = null,
  replaceSelection,
  onCommandExecuted,
  onOpenNote,
}: AiPanelProps) {
  const aiSettings = useSettingsStore(selectAi);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AiPanelMode>(initialMode);
  const [contextCount, setContextCount] = useState(0);
  const [citations, setCitations] = useState<AiCitation[]>([]);
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCallRecord>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRequestRef = useRef<string | null>(null);
  const commandActiveRef = useRef(false);

  useAiKeyHydration();
  useAiStream({
    activeRequestRef,
    commandActiveRef,
    insertAtCursor,
    replaceSelection,
    setMessages,
    setError,
    setLoading,
    setToolCalls,
  });
  useAiCommand({
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
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleSubmit = useCallback(async () => {
    const query = input.trim();
    if (!query || loading) return;

    const auth = resolveAiAuth(aiSettings, getConfig);
    if (auth.missingKey) {
      setError('Please set your API key in Settings > AI Assistant');
      return;
    }

    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const currentNote = getCurrentNote();
      const relevantNotes: NoteContext[] = [];

      if (mode === 'ask-notes') {
        const hits = await window.dripnex.ai.retrieve({
          query,
          relatedQuery: currentNote?.title,
          topK: auth.maxContextNotes,
          excludeIds: currentNote ? [currentNote.id] : [],
        });
        relevantNotes.push(...hits);
        setCitations(
          hits.map(hit => ({
            id: hit.id,
            title: hit.title,
            heading: hit.heading ?? null,
          }))
        );
      } else {
        setCitations([]);
      }

      setContextCount(relevantNotes.length + (currentNote ? 1 : 0));

      const { requestId } = await window.dripnex.ai.chat({
        query,
        currentNote: currentNote
          ? { id: currentNote.id, title: currentNote.title, content: currentNote.content }
          : null,
        relevantNotes,
        history: messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : '',
        })),
        mode,
        provider: auth.provider,
        model: auth.model,
        providerConfig: { apiKey: auth.apiKey, baseUrl: auth.baseUrl },
        maxResponseTokens: CHAT_MAX_RESPONSE_TOKENS,
        tools: true,
      });
      activeRequestRef.current = requestId;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [input, loading, messages, aiSettings, getConfig, getCurrentNote, mode]);

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
    if (activeRequestRef.current) {
      void window.dripnex.ai.cancel(activeRequestRef.current);
      activeRequestRef.current = null;
    }
    setMessages([]);
    setError(null);
    setContextCount(0);
    setCitations([]);
    setToolCalls(new Map());
    setLoading(false);
  }, []);

  return (
    <div className={sc('ai-panel')}>
      <AiPanelHeader
        mode={mode}
        contextCount={contextCount}
        lastAssistantExists={messages.some(m => m.role === 'assistant')}
        hasMessages={messages.length > 0}
        onToggleMode={() => setMode(prev => (prev === 'chat' ? 'ask-notes' : 'chat'))}
        onInsertLast={() => {
          const last = [...messages].reverse().find(m => m.role === 'assistant');
          if (last) insertAtCursor(typeof last.content === 'string' ? last.content : '');
        }}
        onClear={handleClear}
        onClose={onClose}
      />

      {citations.length > 0 ? (
        <div className={sc('ai-panel-sources')} aria-label="Sources">
          {citations.map((cite, index) => {
            const label = cite.heading ? `${cite.title} › ${cite.heading}` : cite.title;
            return (
              <button
                key={`${cite.id}-${index}`}
                type="button"
                className={sc('ai-panel-source')}
                title={label}
                onClick={() => onOpenNote?.(cite.id)}
              >
                <span className={sc('ai-panel-source-index')}>[{index + 1}]</span>
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={sc('ai-panel-messages')}>
        {messages.length === 0 && !loading && (
          <div className={sc('ai-panel-empty')}>
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
        {Array.from(toolCalls.entries()).map(([callId, tc]) => (
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
          <div className={sc('ai-message', 'ai-message--assistant')}>
            <div className={sc('ai-message-label')}>AI</div>
            <div className={sc('ai-message-content', 'ai-typing')}>Thinking...</div>
          </div>
        )}
        {error && <div className={sc('ai-panel-error')}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className={sc('ai-panel-input')}>
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
          className={sc('ai-panel-send')}
          onClick={() => void handleSubmit()}
          disabled={!input.trim() || loading}
          title="Send (Enter)"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
