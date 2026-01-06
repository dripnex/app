import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Trash2, Pencil } from 'lucide-react';
import { ColorPicker, TAG_COLORS } from '../../ColorPicker';
import styles from './TagsContextMenu.module.css';

// Re-export TAG_COLORS for backward compatibility
export { TAG_COLORS };

export interface TagsContextMenuProps {
  /** Tag name */
  tag: string;
  /** Menu position */
  position: { x: number; y: number };
  /** Current color of the tag (null if none) */
  currentColor: string | null;
  /** Called when menu should close */
  onClose: () => void;
  /** Called when a color is selected (null to remove) */
  onColorSelect: (tag: string, color: string | null) => void;
  /** Called when delete is clicked */
  onDelete: (tag: string) => void;
  /** Called when rename is confirmed */
  onRename?: (oldTag: string, newTag: string) => void;
}

export function TagsContextMenu({
  tag,
  position,
  currentColor,
  onClose,
  onColorSelect,
  onDelete,
  onRename,
}: TagsContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [showColorSubmenu, setShowColorSubmenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(tag);

  // Close on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRenaming) {
          setIsRenaming(false);
          setRenameValue(tag);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, isRenaming, tag]);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleColorSelect = useCallback(
    (color: string | null) => {
      onColorSelect(tag, color);
      onClose();
    },
    [tag, onColorSelect, onClose]
  );

  const handleDelete = useCallback(() => {
    onDelete(tag);
    onClose();
  }, [tag, onDelete, onClose]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim().toLowerCase().replace(/^#/, '');
    if (trimmed && trimmed !== tag && onRename) {
      onRename(tag, trimmed);
    }
    onClose();
  }, [tag, renameValue, onRename, onClose]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRenameSubmit();
      }
    },
    [handleRenameSubmit]
  );

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
      }}
    >
      {isRenaming ? (
        /* Rename input mode */
        <div className={styles.renameContainer}>
          <input
            ref={renameInputRef}
            type="text"
            className={styles.renameInput}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            placeholder="New tag name"
          />
        </div>
      ) : (
        <>
          {/* Rename option */}
          {onRename && (
            <button
              type="button"
              className={styles.item}
              onClick={() => setIsRenaming(true)}
            >
              <Pencil size={14} />
              <span>Rename</span>
            </button>
          )}

          {/* Color option with submenu */}
          <button type="button" className={styles.item} onMouseEnter={() => setShowColorSubmenu(true)}>
            <Palette size={14} />
            <span>Set color</span>
            <span className={styles.arrow}>›</span>
          </button>

          {/* Color submenu */}
          {showColorSubmenu && (
            <ColorPicker
              currentColor={currentColor}
              onSelect={color => handleColorSelect(color)}
              onClear={() => handleColorSelect(null)}
              className={styles.submenu}
            />
          )}

          {/* Divider */}
          <div className={styles.divider} />

          {/* Delete option */}
          <button type="button" className={styles.itemDanger} onClick={handleDelete}>
            <Trash2 size={14} />
            <span>Delete tag</span>
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
