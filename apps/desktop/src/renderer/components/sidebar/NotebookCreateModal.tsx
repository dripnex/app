import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen } from 'lucide-react';
import styles from './NotebookCreateModal.module.css';

interface NotebookCreateModalProps {
  readonly parentId?: string | null;
  readonly onSubmit: (name: string, parentId: string | null) => void;
  readonly onCancel: () => void;
}

export function NotebookCreateModal({ parentId, onSubmit, onCancel }: NotebookCreateModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (trimmedName) {
        onSubmit(trimmedName, parentId ?? null);
      }
    },
    [name, parentId, onSubmit]
  );

  // Close when clicking overlay (outside modal)
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel]
  );

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <BookOpen size={20} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Add New Notebook</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.inputWrapper}>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter notebook name"
              className={styles.input}
              aria-label="New notebook name"
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.createBtn} disabled={!name.trim()}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
