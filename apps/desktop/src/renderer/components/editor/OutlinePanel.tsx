import { memo, useMemo } from 'react';
import { scanMarkdown, type MarkdownHeading } from '@dripnex/markdown';
import { cssm } from '../../lib/cssm';
import { headingIndexAtOrBefore, headingIndexByText } from '../../utils/outlineActive';
import styles from './OutlinePanel.module.css';

const sc = cssm(styles);

interface OutlinePanelProps {
  readonly content: string;
  readonly onJump: (heading: MarkdownHeading) => void;
  readonly activeLine?: number | null;
  readonly activeText?: string | null;
}

export const OutlinePanel = memo(function OutlinePanel({
  content,
  onJump,
  activeLine,
  activeText,
}: OutlinePanelProps) {
  const headings = useMemo(() => scanMarkdown(content).headings, [content]);
  const activeIndex = useMemo(() => {
    if (activeLine != null) {
      const fromLine = headingIndexAtOrBefore(headings, activeLine);
      if (fromLine >= 0) return fromLine;
    }
    return headingIndexByText(headings, activeText ?? null);
  }, [headings, activeLine, activeText]);

  return (
    <aside className={sc('outline')} aria-label="Note outline">
      <p className={sc('outline-label')}>Outline</p>
      {headings.length === 0 ? (
        <p className={sc('outline-empty')}>No headings</p>
      ) : (
        <nav>
          {headings.map((heading, index) => (
            <button
              key={`${heading.line}-${heading.text}`}
              type="button"
              className={sc(
                'outline-item',
                `outline-item--l${heading.level}`,
                index === activeIndex && 'outline-item-active'
              )}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => onJump(heading)}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
});
