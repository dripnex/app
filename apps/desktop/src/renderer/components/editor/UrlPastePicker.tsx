import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorSelection } from '@codemirror/state';
import { formatPastedUrl, type UrlPasteFormat } from '@dripnex/commands';
import { getEditorView } from '../../hooks/useCommandRegistry';
import { cssm } from '../../lib/cssm';
import styles from './UrlPastePicker.module.css';

const sc = cssm(styles);

export interface UrlPastePickerProps {
  readonly url: string;
  readonly from: number;
  readonly to: number;
  readonly top: number;
  readonly left: number;
  readonly onClose: () => void;
}

export function UrlPastePicker({ url, from, to, top, left, onClose }: UrlPastePickerProps) {
  const [busy, setBusy] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const replace = useCallback(
    (text: string) => {
      const view = getEditorView();
      if (!view) {
        onClose();
        return;
      }
      const current = view.state.doc.sliceString(from, to);
      if (current !== url) {
        onClose();
        return;
      }
      view.dispatch({
        changes: { from, to, insert: text },
        selection: EditorSelection.cursor(from + text.length),
        userEvent: 'input.paste',
      });
      view.focus();
      onClose();
    },
    [from, to, url, onClose]
  );

  const apply = useCallback(
    (format: UrlPasteFormat) => {
      replace(formatPastedUrl(url, format));
    },
    [replace, url]
  );

  const applyTitle = useCallback(async () => {
    setBusy(true);
    try {
      const { title } = await window.dripnex.editor.fetchUrlTitle(url);
      replace(formatPastedUrl(url, 'markdown', title ?? url));
    } catch {
      replace(formatPastedUrl(url, 'markdown'));
    }
  }, [replace, url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={barRef}
      className={sc('bar')}
      style={{ top, left }}
      role="toolbar"
      aria-label="Link format"
    >
      <button type="button" className={sc('btn')} onClick={() => void applyTitle()} disabled={busy}>
        {busy ? 'Title…' : 'Title'}
      </button>
      <button type="button" className={sc('btn')} onClick={() => apply('markdown')}>
        Link
      </button>
      <button type="button" className={sc('btn')} onClick={() => apply('angle')}>
        {'<url>'}
      </button>
    </div>,
    document.body
  );
}
