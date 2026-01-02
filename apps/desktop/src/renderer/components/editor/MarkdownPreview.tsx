import { useMemo, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  readonly content: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly onReady?: () => void;
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
  function MarkdownPreview({ content, createdAt, updatedAt, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Format dates for display
    const formattedDates = useMemo(() => {
      if (!createdAt && !updatedAt) return null;

      const formatDate = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      };

      return {
        created: createdAt ? formatDate(createdAt) : null,
        updated: updatedAt ? formatDate(updatedAt) : null,
      };
    }, [createdAt, updatedAt]);

    return (
      <div ref={containerRef} className="markdown-preview">
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml={true}
          components={{
            // Custom checkbox rendering for task lists
            input: ({ type, checked, ...props }) => {
              if (type === 'checkbox') {
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled
                    {...props}
                  />
                );
              }
              return <input type={type} {...props} />;
            },
          }}
        >
          {content}
        </Markdown>

        {formattedDates && (
          <div className="markdown-preview-meta">
            {formattedDates.created && (
              <span>Created: {formattedDates.created}</span>
            )}
            {formattedDates.updated && (
              <span>Updated: {formattedDates.updated}</span>
            )}
          </div>
        )}
      </div>
    );
  }
);
