import { memo, useMemo } from 'react';
import { scanMarkdown, type MarkdownHeading } from '@dripnex/markdown';
import { cssm } from '../../lib/cssm';
import styles from './OutlinePanel.module.css';

const sc = cssm(styles);

interface OutlinePanelProps {
  readonly content: string;
  readonly onJump: (heading: MarkdownHeading) => void;
}

export const OutlinePanel = memo(function OutlinePanel({ content, onJump }: OutlinePanelProps) {
  const headings = useMemo(() => scanMarkdown(content).headings, [content]);

  return (
    <aside className={sc('outline')} aria-label="Note outline">
      <p className={sc('outline-label')}>Outline</p>
      {headings.length === 0 ? (
        <p className={sc('outline-empty')}>No headings</p>
      ) : (
        <nav>
          {headings.map(heading => (
            <button
              key={`${heading.line}-${heading.text}`}
              type="button"
              className={sc('outline-item', `outline-item--l${heading.level}`)}
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
