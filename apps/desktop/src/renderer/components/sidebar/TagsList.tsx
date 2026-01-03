import { useCallback, useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Hash, X, Circle } from 'lucide-react';
import { useTags, noteKeys } from '../../hooks/useNotes';
import { useTagColorsStore } from '../../stores/tagColorsStore';
import { ColorPicker } from '../ColorPicker';
import { TagsContextMenu } from './TagsContextMenu';

/** Context menu state */
interface ContextMenuState {
  tag: string;
  x: number;
  y: number;
}

/**
 * NOTE: Tag Persistence Model
 *
 * Tags are persistent entities that exist independently of notes.
 * Deleting a tag here removes it from the system AND all note associations.
 *
 * CAVEAT: If a tag exists in note content (#tag), deleting it here will
 * remove it from the system, but it will reappear when notes are re-parsed
 * on the next save. This is expected behavior - content is the source of truth
 * for content-extracted tags.
 */

interface TagsListProps {
  /** Currently selected tag filter (null if none) */
  readonly selectedTag: string | null;
  /** Called when user clicks a tag - pass null to clear */
  readonly onSelectTag: (tag: string | null) => void;
}

export function TagsList({ selectedTag, onSelectTag }: TagsListProps) {
  const queryClient = useQueryClient();
  const { data: tags = [], isLoading } = useTags();
  const getColor = useTagColorsStore(state => state.getColor);
  const setColor = useTagColorsStore(state => state.setColor);

  // Color picker state
  const [colorPickerTag, setColorPickerTag] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Close color picker on click outside
  useEffect(() => {
    if (!colorPickerTag) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerTag(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colorPickerTag]);

  const handleTagClick = (tag: string) => {
    // Toggle: if same tag clicked, clear filter; otherwise set filter
    onSelectTag(tag === selectedTag ? null : tag);
  };

  const handleColorDotClick = useCallback((e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setColorPickerTag(prev => (prev === tag ? null : tag));
  }, []);

  const handleColorSelect = useCallback(
    async (tag: string, color: string | null) => {
      await setColor(tag, color);
      setColorPickerTag(null);
    },
    [setColor]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ tag, x: e.clientX, y: e.clientY });
    setColorPickerTag(null); // Close any open color picker
  }, []);

  const handleDeleteTag = useCallback(
    async (tag: string) => {
      // If deleting the currently selected tag filter, clear it
      if (selectedTag === tag) {
        onSelectTag(null);
      }
      await window.readied.notes.deleteTag(tag);
      // Invalidate tags query for sidebar
      queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
      // Remove from colors cache (tag no longer exists)
      useTagColorsStore.getState().removeTag(tag);
    },
    [selectedTag, onSelectTag, queryClient]
  );

  if (isLoading) {
    return (
      <div className="tags-list-loading" aria-busy="true">
        <span className="tags-list-loading-text">Loading tags...</span>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="tags-list-empty">
        <span className="tags-list-empty-text">No tags yet</span>
        <span className="tags-list-empty-hint">Add #tags in your notes</span>
      </div>
    );
  }

  return (
    <>
      <ul className="tags-list" role="listbox" aria-label="Tags">
        {tags.map(tag => {
          const color = getColor(tag);
          const isColorPickerOpen = colorPickerTag === tag;

          return (
            <li
              key={tag}
              role="option"
              aria-selected={tag === selectedTag}
              className="tags-list-item-container"
              onContextMenu={e => handleContextMenu(e, tag)}
            >
              {/* Color dot button - always visible, opens color picker */}
              <button
                type="button"
                className="tags-list-item-color-btn"
                onClick={e => handleColorDotClick(e, tag)}
                aria-label={`Set color for tag ${tag}`}
              >
                {color ? (
                  <span className="tags-list-item-dot" style={{ backgroundColor: color }} />
                ) : (
                  <Circle size={10} className="tags-list-item-dot-empty" />
                )}
              </button>

              {/* Color picker popover */}
              {isColorPickerOpen && (
                <ColorPicker
                  ref={colorPickerRef}
                  currentColor={color}
                  onSelect={c => handleColorSelect(tag, c)}
                  onClear={() => handleColorSelect(tag, null)}
                />
              )}

              {/* Main tag button */}
              <button
                type="button"
                className={`tags-list-item ${tag === selectedTag ? 'selected' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                <Hash size={14} className="tags-list-item-icon" aria-hidden="true" />
                <span className="tags-list-item-name">{tag}</span>
              </button>

              {/* Delete button */}
              <button
                type="button"
                className="tags-list-item-delete"
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteTag(tag);
                }}
                aria-label={`Delete tag ${tag}`}
              >
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Context menu component */}
      {contextMenu && (
        <TagsContextMenu
          tag={contextMenu.tag}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          currentColor={getColor(contextMenu.tag)}
          onClose={() => setContextMenu(null)}
          onColorSelect={handleColorSelect}
          onDelete={handleDeleteTag}
        />
      )}
    </>
  );
}
