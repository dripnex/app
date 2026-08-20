import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ColorPicker } from './ColorPicker';
import styles from './ColorPickerModal.module.css';

export interface ColorPickerAnchor {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

interface ColorPickerModalProps {
  title: string;
  currentColor: string | null;
  onSelect: (color: string) => void;
  onClear: () => void;
  onClose: () => void;
  /** When set, opens as an anchored popover instead of a centered modal. */
  anchor?: ColorPickerAnchor;
}

const POPOVER_WIDTH = 168;
const POPOVER_HEIGHT = 148;
const PAD = 8;

export function ColorPickerModal({
  title,
  currentColor,
  onSelect,
  onClear,
  onClose,
  anchor,
}: ColorPickerModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const popoverStyle = useMemo(() => {
    if (!anchor) return undefined;
    let left = anchor.left;
    let top = anchor.bottom + 6;
    if (left + POPOVER_WIDTH > window.innerWidth - PAD) {
      left = window.innerWidth - POPOVER_WIDTH - PAD;
    }
    if (top + POPOVER_HEIGHT > window.innerHeight - PAD) {
      top = anchor.top - POPOVER_HEIGHT - 6;
    }
    if (left < PAD) left = PAD;
    if (top < PAD) top = PAD;
    return { left, top };
  }, [anchor]);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={anchor ? styles.popover : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={popoverStyle}
        onClick={event => event.stopPropagation()}
      >
        <p className={styles.title}>{title}</p>
        <ColorPicker
          currentColor={currentColor}
          onSelect={onSelect}
          onClear={onClear}
          showContainer={false}
        />
      </div>
    </div>,
    document.body
  );
}
