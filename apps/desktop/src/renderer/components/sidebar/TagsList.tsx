import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useTags, noteKeys } from '../../hooks/useNotes';
import { useTagColorsStore } from '../../stores/tagColorsStore';
import { ColorPickerModal } from '../ColorPicker';
import { fallbackTagColor } from '../../ui/tokens/palette';
import { TagsContextMenu } from './TagsContextMenu';
import { sc } from './sc';

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
  readonly counts?: Record<string, number>;
  readonly filterQuery?: string;
}

export function TagsList({ selectedTag, onSelectTag, counts, filterQuery = '' }: TagsListProps) {
  const queryClient = useQueryClient();
  const { data: tags = [], isLoading } = useTags();
  const getColor = useTagColorsStore(state => state.getColor);
  const setColor = useTagColorsStore(state => state.setColor);

  // Color picker state
  const [colorPickerTag, setColorPickerTag] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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
      await window.dripnex.notes.deleteTag(tag);
      // Invalidate tags query for sidebar
      void queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
      // Remove from colors cache (tag no longer exists)
      useTagColorsStore.getState().removeTag(tag);
    },
    [selectedTag, onSelectTag, queryClient]
  );

  const handleRenameTag = useCallback(
    async (oldTag: string, newTag: string) => {
      const result = await window.dripnex.notes.renameTag(oldTag, newTag);
      if (result.ok) {
        // Update selected tag filter if renaming the active filter
        if (selectedTag === oldTag) {
          onSelectTag(newTag);
        }
        // Invalidate queries to refresh sidebar and notes
        void queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
        void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
        // Update colors cache (move color from old to new)
        const oldColor = useTagColorsStore.getState().getColor(oldTag);
        if (oldColor) {
          void useTagColorsStore.getState().setColor(newTag, oldColor);
        }
        useTagColorsStore.getState().removeTag(oldTag);
      }
    },
    [selectedTag, onSelectTag, queryClient]
  );

  const visibleTags = tags.filter(tag => {
    if (filterQuery && !tag.toLowerCase().includes(filterQuery.toLowerCase())) return false;
    if (counts && (counts[tag] ?? 0) === 0) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className={sc('tags-list-loading')} aria-busy="true">
        <span className={sc('tags-list-loading-text')}>Loading tags...</span>
      </div>
    );
  }

  if (visibleTags.length === 0) {
    return (
      <div className={sc('tags-list-empty')}>
        <span className={sc('tags-list-empty-text')}>No tags yet</span>
        <span className={sc('tags-list-empty-hint')}>Add #tags in your notes</span>
      </div>
    );
  }

  return (
    <>
      <ul className={sc('tags-list')} role="listbox" aria-label="Tags">
        {visibleTags.map(tag => {
          const color = getColor(tag) ?? fallbackTagColor(tag);
          const count = counts?.[tag];

          return (
            <li
              key={tag}
              role="option"
              aria-selected={tag === selectedTag}
              className={sc('tags-list-item-container')}
              onContextMenu={e => handleContextMenu(e, tag)}
            >
              <button
                type="button"
                className={sc('sidebar-row', 'tags-list-item', tag === selectedTag && 'selected')}
                onClick={() => handleTagClick(tag)}
              >
                <span
                  className={sc('tags-list-item-dot')}
                  style={{ backgroundColor: color }}
                  onClick={e => handleColorDotClick(e, tag)}
                  role="presentation"
                />
                <span className={sc('tags-list-item-name')}>{tag}</span>
                {count !== undefined && (
                  <span className={sc('sidebar-row-count')} aria-label={`${count} notes`}>
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Context menu component */}
      {colorPickerTag ? (
        <ColorPickerModal
          title={`Color · ${colorPickerTag}`}
          currentColor={getColor(colorPickerTag) ?? fallbackTagColor(colorPickerTag)}
          onSelect={c => handleColorSelect(colorPickerTag, c)}
          onClear={() => handleColorSelect(colorPickerTag, null)}
          onClose={() => setColorPickerTag(null)}
        />
      ) : null}

      {contextMenu && (
        <TagsContextMenu
          tag={contextMenu.tag}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          currentColor={getColor(contextMenu.tag)}
          onClose={() => setContextMenu(null)}
          onColorSelect={handleColorSelect}
          onDelete={handleDeleteTag}
          onRename={handleRenameTag}
        />
      )}
    </>
  );
}
