import { useMemo, useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock, CalendarPlus, ListChecks } from 'lucide-react';
import { remarkWikilink } from '@readied/wikilinks';
import { countMarkdownTasks } from '@readied/tasks';
import { formatDateTime } from '../../utils/date';

interface MarkdownPreviewProps {
  readonly content: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly onReady?: () => void;
  readonly onWikilinkClick?: (target: string) => void;
}

/** Imperative handle for scroll sync */
export interface MarkdownPreviewHandle {
  getScrollFraction: () => number;
  setScrollFraction: (fraction: number) => void;
  onScroll: (callback: (fraction: number) => void) => () => void;
  canScroll: () => boolean;
}

/**
 * MarkdownPreview - Renders markdown content as HTML
 *
 * Uses react-markdown with GFM (GitHub Flavored Markdown) support.
 * Exposes scroll methods via ref for sync with editor.
 */
export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview({ content, createdAt, updatedAt, onReady, onWikilinkClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Delegated click handler for wikilinks
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        const target = (e.target as HTMLElement).closest('.wikilink');
        if (target) {
          const noteTitle = target.getAttribute('data-target');
          if (noteTitle && onWikilinkClick) {
            e.preventDefault();
            onWikilinkClick(noteTitle);
          }
        }
      },
      [onWikilinkClick]
    );

    // Notify parent when mounted
    useEffect(() => {
      onReady?.();
    }, []);

    // Expose scroll methods via ref
    useImperativeHandle(ref, () => ({
      getScrollFraction: () => {
        const el = containerRef.current;
        if (!el) return 0;
        const maxScroll = el.scrollHeight - el.clientHeight;
        return maxScroll > 0 ? el.scrollTop / maxScroll : 0;
      },
      setScrollFraction: (fraction: number) => {
        const el = containerRef.current;
        if (!el) return;
        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollTop = fraction * maxScroll;
      },
      onScroll: (callback: (fraction: number) => void) => {
        const el = containerRef.current;
        if (!el) return () => {};
        const handler = () => {
          const maxScroll = el.scrollHeight - el.clientHeight;
          const fraction = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
          callback(fraction);
        };
        el.addEventListener('scroll', handler);
        return () => el.removeEventListener('scroll', handler);
      },
      canScroll: () => {
        const el = containerRef.current;
        if (!el) return false;
        return el.scrollHeight > el.clientHeight + 1;
      },
    }));

    // Count tasks for progress display
    const tasks = useMemo(() => countMarkdownTasks(content), [content]);
    const hasProgress = tasks.total > 0;
    const progressPercent = hasProgress ? (tasks.completed / tasks.total) * 100 : 0;

    return (
      <div ref={containerRef} className="markdown-preview" onClick={handleClick}>
        {/* Metadata header - Inkdrop style */}
        <div className="preview-metadata-header">
          {hasProgress && (
            <div className="preview-meta-item">
              <ListChecks size={20} className="preview-meta-icon" aria-hidden="true" />
              <div className="preview-meta-content">
                <span className="preview-meta-label">PROGRESS</span>
                <div className="preview-meta-progress">
                  <div className="preview-progress-bar">
                    <div
                      className="preview-progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="preview-progress-text">
                    {tasks.completed} of {tasks.total} tasks
                  </span>
                </div>
              </div>
            </div>
          )}

          {createdAt && (
            <div className="preview-meta-item">
              <Clock size={20} className="preview-meta-icon" aria-hidden="true" />
              <div className="preview-meta-content">
                <span className="preview-meta-label">CREATED AT</span>
                <span className="preview-meta-value">{formatDateTime(createdAt)}</span>
              </div>
            </div>
          )}

          {updatedAt && (
            <div className="preview-meta-item">
              <CalendarPlus size={20} className="preview-meta-icon" aria-hidden="true" />
              <div className="preview-meta-content">
                <span className="preview-meta-label">UPDATED AT</span>
                <span className="preview-meta-value">{formatDateTime(updatedAt)}</span>
              </div>
            </div>
          )}
        </div>

        <Markdown
          remarkPlugins={[remarkGfm, remarkWikilink]}
          skipHtml={true}
          components={{
            // Custom checkbox rendering for task lists
            input: ({ type, checked, ...props }) => {
              if (type === 'checkbox') {
                return <input type="checkbox" checked={checked} disabled {...props} />;
              }
              return <input type={type} {...props} />;
            },
          }}
        >
          {content}
        </Markdown>
      </div>
    );
  }
);
