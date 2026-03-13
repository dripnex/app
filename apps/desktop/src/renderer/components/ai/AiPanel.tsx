import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Trash2, ArrowDownToLine } from 'lucide-react';
import { buildRagPrompt } from '@readied/ai-assistant';
import type { ClaudeMessage, NoteContext } from '@readied/ai-assistant';
import { useSettingsStore, selectAi } from '../../stores/settings';
import { AiMessage } from './AiMessage';

interface AiPanelProps {
  onClose: () => void;
  getCurrentNote: () => { id: string; title: string; content: string } | null;
  searchNotes: (query: string) => Promise<Array<{ id: string; title: string }>>;
  getNoteById: (id: string) => Promise<{ id: string; title: string; content: string } | null>;
  getConfig: <T>(key: string) => T | undefined;
  insertAtCursor: (text: string) => void;
}

export function AiPanel({
  onClose,
  getCurrentNote,
  searchNotes,
  getNoteById,
  getConfig,
  insertAtCursor,
}: AiPanelProps) {
  const aiSettings = useSettingsStore(selectAi);
  const [messages, setMessages] = useState<ClaudeMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleSubmit = useCallback(async () => {
    const query = input.trim();
    if (!query || loading) return;

    // Prefer settings store, fall back to plugin config for backwards compatibility
    const apiKey = aiSettings.apiKey || getConfig<string>('apiKey');
    if (!apiKey) {
      setError('Please set your Anthropic API key in Settings > AI Assistant');
      return;
    }

    const model = aiSettings.apiKey
      ? aiSettings.model
      : getConfig<string>('model') || 'claude-sonnet-4-20250514';
    const maxContextNotes = aiSettings.apiKey
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

      // Search for relevant notes
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

      // Build RAG prompt
      const { system, messages: ragMessages } = buildRagPrompt({
        query,
        currentNote: currentNote
          ? { id: currentNote.id, title: currentNote.title, content: currentNote.content }
          : null,
        relevantNotes,
        history: messages,
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
  }, [input, loading, messages, aiSettings, getConfig, getCurrentNote, searchNotes, getNoteById]);

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
        <span className="ai-panel-title">AI Assistant</span>
        <div className="ai-panel-actions">
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
            Ask a question about your notes or the current document.
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
          placeholder="Ask about your notes..."
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
