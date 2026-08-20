import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveWikilinkPeek, type WikilinkPeekResult } from '../../utils/resolveWikilinkPeek';
import { cssm } from '../../lib/cssm';
import styles from './WikilinkPeek.module.css';

const sc = cssm(styles);

interface WikilinkPeekProps {
  readonly target: string;
  readonly x: number;
  readonly y: number;
  readonly onOpen: (target: string) => void;
  readonly onHold: () => void;
  readonly onLeave: () => void;
}

export function WikilinkPeek({ target, x, y, onOpen, onHold, onLeave }: WikilinkPeekProps) {
  const [result, setResult] = useState<WikilinkPeekResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void resolveWikilinkPeek(target, query => window.dripnex.notes.search(query, 8)).then(next => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!result) return null;

  const left = Math.min(x, window.innerWidth - 300);
  const top = Math.min(y + 14, window.innerHeight - 120);

  return createPortal(
    <div
      className={sc('peek')}
      style={{ left, top }}
      role="tooltip"
      onMouseEnter={onHold}
      onMouseLeave={onLeave}
      onClick={() => onOpen(result.title)}
    >
      <div className={sc('title')}>{result.title}</div>
      {result.kind === 'note' ? (
        <p className={sc('excerpt')}>{result.excerpt || 'Empty note'}</p>
      ) : (
        <p className={sc('missing')}>Not in the library — click to create</p>
      )}
    </div>,
    document.body
  );
}
