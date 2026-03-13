import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Trash2, ArrowDownToLine, BookOpen, MessageSquare } from 'lucide-react';
import { buildRagPrompt } from '@readied/ai-assistant';
import type { ClaudeMessage, NoteContext, AiPanelMode } from '@readied/ai-assistant';
import { useSettingsStore, selectAi } from '../../stores/settings';
import { AiMessage } from './AiMessage';

interface AiPanelProps {
  onClose: () => void;
  getCurrentNote: () => { id: string; title: string; content: string } | null;
  searchNotes: (query: string) => Promise<Array<{ id: string; title: string }>>;
  getNoteById: (id: string) => Promise<{ id: string; title: string; content: string } | null>;
  getConfig: <T>(key: string) => T | undefined;
  insertAtCursor: (text: string) => void;
  /** Initial mode: 'chat' (default) or 'ask-notes' */
  initialMode?: AiPanelMode;
}

export function AiPanel({
  onClose,
  getCurrentNote,
  searchNotes,
  getNoteById,
  getConfig,
  insertAtCursor,
  initialMode = 'chat',
}: AiPanelProps) {
  const aiSettings = useSettingsStore(selectAi);
  const [messages, setMessages] = useState<ClaudeMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AiPanelMode>(initialMode);
  const [contextCount, setContextCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync mode when initialMode prop changes (e.g. ai:ask-notes command while panel open)
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleSubmit = useCallback(async () => {
    const query = input.trim();
    if (!query || loading) return;

    // Prefer settings store, fall back to plugin config for backwards compatibility
    const useSettingsStore = Boolean(aiSettings.apiKey);
    const apiKey = useSettingsStore ? aiSettings.apiKey : getConfig<string>('apiKey');
    if (!apiKey) {
      setError('Please set your Anthropic API key in Settings > AI Assistant');
      return;
    }

    const model = useSettingsStore
      ? aiSettings.model
      : getConfig<string>('model') || 'claude-sonnet-4-20250514';
    const maxContextNotes = useSettingsStore
      ? aiSettings.maxContextNotes
      : getConfig<number>('maxContextNotes') || 5;

    setInput('');
    setError(null);

    // Add user message
    const userMsg: ClaudeMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Gather context
      const currentNote = getCurrentNote();

      // Search for relevant notes matching the user's query
      const searchResults = await searchNotes(query);
      const relevantNotes: NoteContext[] = [];

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

      // In ask-notes mode or when a current note is selected, also search
      // for notes related to the current note's title (if not already found)
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

      // Track how many notes are being used as context
      const totalContext = relevantNotes.length + (currentNote ? 1 : 0);
      setContextCount(totalContext);

      // Build RAG prompt (mode determines the system prompt variant)
      const { system, messages: ragMessages } = buildRagPrompt({
        query,
        currentNote: currentNote
          ? { id: currentNote.id, title: currentNote.title, content: currentNote.content }
          : null,
        relevantNotes,
        history: messages,
        mode,
      });

      // Call Claude API via IPC proxy
      const result = await window.readied.ai.query({
        apiKey,
        model,
        system,
        messages: ragMessages,
        maxTokens: 2048,
      });

      if (result.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
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
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setError(null);
    setContextCount(0);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(prev => (prev === 'chat' ? 'ask-notes' : 'chat'));
  }, []);

  const handleInsertLast = useCallback(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      insertAtCursor(lastAssistant.content);
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
          <AiMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && (
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
