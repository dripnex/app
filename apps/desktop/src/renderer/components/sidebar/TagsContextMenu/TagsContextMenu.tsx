import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Trash2 } from 'lucide-react';
import styles from './TagsContextMenu.module.css';

/** Predefined color palette for tags */
export const TAG_COLORS = [
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

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
}

export function TagsContextMenu({
  tag,
  position,
  currentColor,
  onClose,
  onColorSelect,
  onDelete,
}: TagsContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showColorSubmenu, setShowColorSubmenu] = useState(false);

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
      {/* Color option with submenu */}
      <button
        type="button"
        className={styles.item}
        onMouseEnter={() => setShowColorSubmenu(true)}
      >
        <Palette size={14} />
        <span>Set color</span>
        <span className={styles.arrow}>›</span>
      </button>

      {/* Color submenu */}
      {showColorSubmenu && (
        <div className={styles.submenu}>
          <div className="tags-color-picker-grid">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`tags-color-picker-swatch ${currentColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => handleColorSelect(c)}
                aria-label={`Set color to ${c}`}
              />
            ))}
          </div>
          {currentColor && (
            <button
              type="button"
              className="tags-color-picker-clear"
              onClick={() => handleColorSelect(null)}
            >
              Remove color
            </button>
          )}
        </div>
      )}

      {/* Divider */}
      <div className={styles.divider} />

      {/* Delete option */}
      <button
        type="button"
        className={styles.itemDanger}
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        <span>Delete tag</span>
      </button>
    </div>,
    document.body
  );
}
