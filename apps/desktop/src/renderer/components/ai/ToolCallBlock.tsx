import { useState } from 'react';
import {
  Search,
  FileText,
  FolderOpen,
  PenLine,
  Replace,
  FilePlus,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide';
import { Icon } from '../../ui/icons/Icon';
import { sc } from './sc';

type ToolCallStatus = 'pending_confirmation' | 'executing' | 'complete' | 'rejected' | 'error';

interface ToolCallBlockProps {
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: { ok: boolean; content: string; error?: string };
  onConfirm?: () => void;
  onReject?: () => void;
}

const TOOL_ICONS: Record<string, typeof Search> = {
  search_notes: Search,
  read_note: FileText,
  list_notebooks: FolderOpen,
  insert_text: PenLine,
  replace_selection: Replace,
  create_note: FilePlus,
};

export function ToolCallBlock({
  name,
  args,
  status,
  result,
  onConfirm,
  onReject,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const toolIcon = TOOL_ICONS[name] ?? Search;

  return (
    <div className={sc('ai-tool-call')}>
      <div
        className={sc('ai-tool-call-header')}
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(prev => !prev)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(prev => !prev);
          }
        }}
        aria-expanded={expanded}
      >
        <div className={sc('ai-tool-call-left')}>
          {status === 'executing' ? (
            <Icon icon={Loader2} size={14} className={sc('ai-tool-call-spinning')} />
          ) : status === 'complete' && result?.ok ? (
            <Icon icon={CheckCircle} size={14} className={sc('ai-tool-call-success')} />
          ) : status === 'error' || (status === 'complete' && !result?.ok) ? (
            <Icon icon={XCircle} size={14} className={sc('ai-tool-call-error')} />
          ) : (
            <Icon icon={toolIcon} size={14} />
          )}
          <span className={sc('ai-tool-call-name')}>{name}</span>
          <span className={sc('ai-tool-call-status')}>
            {status === 'pending_confirmation' && '— needs approval'}
            {status === 'executing' && '— running...'}
            {status === 'rejected' && '— cancelled'}
          </span>
        </div>
        <div className={sc('ai-tool-call-right')}>
          <Icon icon={expanded ? ChevronDown : ChevronRight} size={12} />
        </div>
      </div>

      {status === 'pending_confirmation' && (
        <div className={sc('ai-tool-call-actions')}>
          <button className={sc('ai-tool-call-btn', 'approve')} onClick={onConfirm}>
            Run
          </button>
          <button className={sc('ai-tool-call-btn', 'reject')} onClick={onReject}>
            Cancel
          </button>
        </div>
      )}

      {expanded && (
        <div className={sc('ai-tool-call-details')}>
          {Object.keys(args).length > 0 && (
            <div className={sc('ai-tool-call-args')}>
              <div className={sc('ai-tool-call-label')}>Args</div>
              <pre>{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {result && (
            <div className={sc('ai-tool-call-result')}>
              <div className={sc('ai-tool-call-label')}>Result</div>
              <pre>
                {result.content.slice(0, 500)}
                {result.content.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
