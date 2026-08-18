import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FileStack } from 'lucide-react';
import type { NoteSnapshot } from '../../../preload/index';
import { useNotes } from '../../hooks/useNotes';
import styles from '../NotebookPicker/NotebookPicker.module.css';

export interface TemplatePickerProps {
  onSelect: (templateNoteId: string) => void;
  onClose: () => void;
}

export function TemplatePicker({ onSelect, onClose }: TemplatePickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const { data: templates = [], isLoading } = useNotes({
    notebookId: 'templates',
    archived: 'active',
    isDeleted: false,
    sortBy: 'title',
    sortOrder: 'asc',
    limit: 200,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const term = search.toLowerCase();
    return templates.filter(note => note.title.toLowerCase().includes(term));
  }, [templates, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelect = useCallback(
    (note: NoteSnapshot) => {
      onSelect(note.id);
      onClose();
    },
    [onSelect, onClose]
  );

  return createPortal(
    <div
      className={styles.overlay}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={pickerRef} className={styles.picker} role="dialog" aria-label="New from template">
        <div className={styles.searchWrapper}>
          <FileStack size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="search"
            className={styles.searchInput}
            placeholder="New from template…"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <ul className={styles.list}>
          {isLoading ? (
            <li className={styles.empty}>Loading templates…</li>
          ) : filtered.length === 0 ? (
            <li className={styles.empty}>No templates yet</li>
          ) : (
            filtered.map(note => (
              <li key={note.id}>
                <button type="button" className={styles.item} onClick={() => handleSelect(note)}>
                  <FileStack size={14} />
                  <span>{note.title || 'Untitled'}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
}
