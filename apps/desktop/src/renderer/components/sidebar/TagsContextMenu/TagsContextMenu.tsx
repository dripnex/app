import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Trash2 } from 'lucide-react';
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
    </div>,
    document.body
  );
}
