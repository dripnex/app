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
} from 'lucide-react';

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
  const Icon = TOOL_ICONS[name] ?? Search;

  return (
    <div className="ai-tool-call">
      <div
        className="ai-tool-call-header"
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
        <div className="ai-tool-call-left">
          {status === 'executing' ? (
            <Loader2 size={14} className="ai-tool-call-spinning" />
          ) : status === 'complete' && result?.ok ? (
            <CheckCircle size={14} className="ai-tool-call-success" />
          ) : status === 'error' || (status === 'complete' && !result?.ok) ? (
            <XCircle size={14} className="ai-tool-call-error" />
          ) : (
            <Icon size={14} />
          )}
          <span className="ai-tool-call-name">{name}</span>
          <span className="ai-tool-call-status">
            {status === 'pending_confirmation' && '— needs approval'}
            {status === 'executing' && '— running...'}
            {status === 'rejected' && '— cancelled'}
          </span>
        </div>
        <div className="ai-tool-call-right">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </div>

      {status === 'pending_confirmation' && (
        <div className="ai-tool-call-actions">
          <button className="ai-tool-call-btn approve" onClick={onConfirm}>
            Run
          </button>
          <button className="ai-tool-call-btn reject" onClick={onReject}>
            Cancel
          </button>
        </div>
      )}

      {expanded && (
        <div className="ai-tool-call-details">
          {Object.keys(args).length > 0 && (
            <div className="ai-tool-call-args">
              <div className="ai-tool-call-label">Args</div>
              <pre>{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {result && (
            <div className="ai-tool-call-result">
              <div className="ai-tool-call-label">Result</div>
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
