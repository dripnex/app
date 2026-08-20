import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide';
import { Icon } from '../../ui/icons/Icon';
import { usePreviewFindStore } from '../../stores/previewFindStore';
import { cssm } from '../../lib/cssm';
import styles from './PreviewFindBar.module.css';

const sc = cssm(styles);

interface PreviewFindBarProps {
  matchCount: number;
}

export function PreviewFindBar({ matchCount }: PreviewFindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const query = usePreviewFindStore(s => s.query);
  const index = usePreviewFindStore(s => s.index);
  const setQuery = usePreviewFindStore(s => s.setQuery);
  const step = usePreviewFindStore(s => s.step);
  const closePanel = usePreviewFindStore(s => s.closePanel);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className={sc('preview-find')} role="search">
      <input
        ref={inputRef}
        type="search"
        className={sc('preview-find-input')}
        placeholder="Find in preview"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1, matchCount);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            closePanel();
          }
        }}
        aria-label="Find in preview"
      />
      <span className={sc('preview-find-count')}>
        {query.trim() ? (matchCount === 0 ? '0/0' : `${index + 1}/${matchCount}`) : ''}
      </span>
      <button
        type="button"
        className={sc('preview-find-btn')}
        onClick={() => step(-1, matchCount)}
        aria-label="Previous match"
      >
        <Icon icon={ChevronUp} size={14} />
      </button>
      <button
        type="button"
        className={sc('preview-find-btn')}
        onClick={() => step(1, matchCount)}
        aria-label="Next match"
      >
        <Icon icon={ChevronDown} size={14} />
      </button>
      <button
        type="button"
        className={sc('preview-find-btn')}
        onClick={closePanel}
        aria-label="Close find"
      >
        <Icon icon={X} size={14} />
      </button>
    </div>
  );
}
