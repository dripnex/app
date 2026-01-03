import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen } from 'lucide-react';
import type { NotebookSnapshot } from '../../../preload/index';
import styles from './NotebookPicker.module.css';

export interface NotebookPickerProps {
  /** Current notebook ID of the note being moved */
  currentNotebookId: string | null;
  /** Available notebooks */
  notebooks: NotebookSnapshot[];
  /** Called when a notebook is selected */
  onSelect: (notebookId: string) => void;
  /** Called when picker should close */
  onClose: () => void;
}

export function NotebookPicker({
  currentNotebookId,
  notebooks,
  onSelect,
  onClose,
}: NotebookPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  // Filter notebooks by search term
  const filteredNotebooks = useMemo(() => {
    if (!search.trim()) return notebooks;
    const term = search.toLowerCase();
    return notebooks.filter(nb => nb.name.toLowerCase().includes(term));
  }, [notebooks, search]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSelect = useCallback(
    (notebookId: string) => {
      if (notebookId !== currentNotebookId) {
        onSelect(notebookId);
      }
      onClose();
    },
    [currentNotebookId, onSelect, onClose]
  );

  // Handle overlay click (close when clicking outside picker)
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div ref={pickerRef} className={styles.picker}>
        {/* Search input */}
        <div className={styles.searchWrapper}>
          <FolderOpen size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Move to..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Notebook list */}
        <div className={styles.list}>
          {filteredNotebooks.length === 0 ? (
            <div className={styles.empty}>No notebooks found</div>
          ) : (
            filteredNotebooks.map(nb => (
              <button
                key={nb.id}
                type="button"
                className={`${styles.item} ${nb.id === currentNotebookId ? styles.current : ''}`}
                style={{ paddingLeft: `${nb.depth * 16 + 16}px` }}
                onClick={() => handleSelect(nb.id)}
              >
                {nb.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
