import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { NOTEBOOK_ICON_IDS, notebookLucideIcon } from './notebookIcons';
import { sc } from './sc';

export interface IconPickerAnchor {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

interface NotebookIconPickerProps {
  current: string | null;
  anchor: IconPickerAnchor;
  onSelect: (icon: string | null) => void;
  onClose: () => void;
}

const WIDTH = 220;
const HEIGHT = 220;
const PAD = 8;

export function NotebookIconPicker({
  current,
  anchor,
  onSelect,
  onClose,
}: NotebookIconPickerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const style = useMemo(() => {
    let left = anchor.left;
    let top = anchor.bottom + 6;
    if (left + WIDTH > window.innerWidth - PAD) left = window.innerWidth - WIDTH - PAD;
    if (top + HEIGHT > window.innerHeight - PAD) top = anchor.top - HEIGHT - 6;
    if (left < PAD) left = PAD;
    if (top < PAD) top = PAD;
    return { left, top };
  }, [anchor]);

  return createPortal(
    <div className={sc('notebook-icon-backdrop')} onClick={onClose} role="presentation">
      <div
        className={sc('notebook-icon-popover')}
        role="dialog"
        aria-label="Notebook icon"
        style={style}
        onClick={event => event.stopPropagation()}
      >
        <p className={sc('notebook-icon-title')}>Icon</p>
        <div className={sc('notebook-icon-grid')}>
          {NOTEBOOK_ICON_IDS.map(id => {
            const Icon = notebookLucideIcon(id);
            return (
              <button
                key={id}
                type="button"
                className={sc('notebook-icon-swatch', current === id && 'selected')}
                onClick={() => onSelect(id)}
                aria-label={id}
                title={id}
              >
                <Icon size={15} strokeWidth={2} />
              </button>
            );
          })}
        </div>
        {current ? (
          <button
            type="button"
            className={sc('notebook-icon-clear')}
            onClick={() => onSelect(null)}
          >
            Default icon
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
