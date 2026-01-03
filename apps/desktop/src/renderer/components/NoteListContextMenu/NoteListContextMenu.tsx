import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Copy, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import styles from './NoteListContextMenu.module.css';

export interface NoteListContextMenuProps {
  /** Note ID */
  noteId: string;
  /** Current notebook ID of the note */
  currentNotebookId: string | null;
  /** Whether the note is archived */
  isArchived: boolean;
  /** Menu position */
  position: { x: number; y: number };
  /** Called when menu should close */
  onClose: () => void;
  /** Called when duplicate is clicked */
  onDuplicate: (id: string) => void;
  /** Called when archive/restore is clicked */
  onArchive: (id: string) => void;
  /** Called when delete is clicked */
  onDelete: (id: string) => void;
  /** Called when "Move to Notebook" is clicked - opens the picker */
  onOpenPicker: (noteId: string, currentNotebookId: string | null) => void;
}

export function NoteListContextMenu({
  noteId,
  currentNotebookId,
  isArchived,
  position,
  onClose,
  onDuplicate,
  onArchive,
  onDelete,
  onOpenPicker,
}: NoteListContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to keep menu in viewport
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // Adjust if menu would overflow right edge
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 8;
      }

      // Adjust if menu would overflow bottom edge
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 8;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  // Close on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleDuplicate = useCallback(() => {
    onDuplicate(noteId);
    onClose();
  }, [noteId, onDuplicate, onClose]);

  const handleArchive = useCallback(() => {
    onArchive(noteId);
    onClose();
  }, [noteId, onArchive, onClose]);

  const handleDelete = useCallback(() => {
    onDelete(noteId);
    onClose();
  }, [noteId, onDelete, onClose]);

  const handleOpenPicker = useCallback(() => {
    onOpenPicker(noteId, currentNotebookId);
    onClose();
  }, [noteId, currentNotebookId, onOpenPicker, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Move to Notebook */}
      <button type="button" className={styles.item} onClick={handleOpenPicker}>
        <FolderOpen size={14} />
        <span className={styles.label}>Move to Notebook</span>
        <span className={styles.shortcut}>M</span>
      </button>

      {/* Duplicate */}
      <button type="button" className={styles.item} onClick={handleDuplicate}>
        <Copy size={14} />
        <span className={styles.label}>Duplicate</span>
        <span className={styles.shortcut}>⌘D</span>
      </button>

      <div className={styles.divider} />

      {/* Archive / Restore */}
      <button type="button" className={styles.item} onClick={handleArchive}>
        {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        <span className={styles.label}>{isArchived ? 'Restore' : 'Archive'}</span>
      </button>

      {/* Delete */}
      <button type="button" className={styles.item} onClick={handleDelete}>
        <Trash2 size={14} />
        <span className={styles.label}>Move to Trash</span>
        <span className={styles.shortcut}>⌘⌫</span>
      </button>
    </div>,
    document.body
  );
}
