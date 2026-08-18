import { X, Trash2, ArrowDownToLine, BookOpen, MessageSquare } from 'lucide-react';
import type { AiPanelMode } from '@dripnex/ai-core';
import { sc } from './sc';

interface AiPanelHeaderProps {
  mode: AiPanelMode;
  contextCount: number;
  lastAssistantExists: boolean;
  hasMessages: boolean;
  onToggleMode: () => void;
  onInsertLast: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function AiPanelHeader({
  mode,
  contextCount,
  lastAssistantExists,
  hasMessages,
  onToggleMode,
  onInsertLast,
  onClear,
  onClose,
}: AiPanelHeaderProps) {
  return (
    <div className={sc('ai-panel-header')}>
      <div className={sc('ai-panel-header-left')}>
        <span className={sc('ai-panel-title')}>
          {mode === 'ask-notes' ? 'Ask Your Notes' : 'AI Assistant'}
        </span>
        {contextCount > 0 && (
          <span
            className={sc('ai-panel-context-badge')}
            title={`${contextCount} passage(s) used as context`}
          >
            {contextCount} {contextCount === 1 ? 'passage' : 'passages'}
          </span>
        )}
      </div>
      <div className={sc('ai-panel-actions')}>
        <button
          className={sc('ai-panel-btn', mode === 'ask-notes' && 'active')}
          onClick={onToggleMode}
          title={mode === 'ask-notes' ? 'Switch to Chat mode' : 'Switch to Ask Notes mode'}
        >
          {mode === 'ask-notes' ? <MessageSquare size={14} /> : <BookOpen size={14} />}
        </button>
        {lastAssistantExists && (
          <button
            className={sc('ai-panel-btn')}
            onClick={onInsertLast}
            title="Insert last response into note"
          >
            <ArrowDownToLine size={14} />
          </button>
        )}
        {hasMessages && (
          <button className={sc('ai-panel-btn')} onClick={onClear} title="Clear conversation">
            <Trash2 size={14} />
          </button>
        )}
        <button className={sc('ai-panel-btn')} onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
