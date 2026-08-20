import { X, Trash2, ArrowDownToLine, BookOpen, MessageSquare } from 'lucide';
import type { AiPanelMode } from '@dripnex/ai-core';
import { Icon } from '../../ui/icons/Icon';
import { sc } from './sc';

interface AiPanelHeaderProps {
  mode: AiPanelMode;
  contextCount: number;
  matchHint?: string | null;
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
  matchHint,
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
        {matchHint ? (
          <span
            className={sc('ai-panel-mode-hint')}
            title="No embeddings yet. Ask Notes matches words. Settings → AI."
          >
            {matchHint}
          </span>
        ) : null}
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
          {mode === 'ask-notes' ? (
            <Icon icon={MessageSquare} size={14} />
          ) : (
            <Icon icon={BookOpen} size={14} />
          )}
        </button>
        {lastAssistantExists && (
          <button
            className={sc('ai-panel-btn')}
            onClick={onInsertLast}
            title="Insert last response into note"
          >
            <Icon icon={ArrowDownToLine} size={14} />
          </button>
        )}
        {hasMessages && (
          <button className={sc('ai-panel-btn')} onClick={onClear} title="Clear conversation">
            <Icon icon={Trash2} size={14} />
          </button>
        )}
        <button className={sc('ai-panel-btn')} onClick={onClose} title="Close">
          <Icon icon={X} size={14} />
        </button>
      </div>
    </div>
  );
}
