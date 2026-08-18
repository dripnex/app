import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ColorPicker } from './ColorPicker';
import styles from './ColorPickerModal.module.css';

interface ColorPickerModalProps {
  title: string;
  currentColor: string | null;
  onSelect: (color: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ColorPickerModal({
  title,
  currentColor,
  onSelect,
  onClear,
  onClose,
}: ColorPickerModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
