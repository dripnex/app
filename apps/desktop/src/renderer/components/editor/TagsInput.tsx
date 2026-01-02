import { memo, useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { Tag, X } from 'lucide-react';
import { useTagColorsStore } from '../../stores/tagColorsStore';

interface TagsInputProps {
  /** All tags (merged content + manual) */
  readonly tags: readonly string[];
  /** Manual tags only (these are removable) */
  readonly manualTags: readonly string[];
  /** Called when user adds a new manual tag */
  readonly onAddTag: (tag: string) => void;
  /** Called when user removes a manual tag */
  readonly onRemoveTag: (tag: string) => void;
}

/**
 * TagsInput - Editable display of note tags
 *
 * - Shows all tags (content-extracted + manual)
 * - Only manual tags are removable (show × button)
 * - Inline input to add new manual tags
 */
export const TagsInput = memo(function TagsInput({
  tags,
  manualTags,
  onAddTag,
  onRemoveTag,
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getColor = useTagColorsStore(state => state.getColor);

  const normalizeTag = useCallback((value: string): string => {
    return value.trim().toLowerCase().replace(/^#/, '');
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const normalized = normalizeTag(inputValue);
        if (normalized.length > 0 && !tags.includes(normalized)) {
          onAddTag(normalized);
          setInputValue('');
        }
      } else if (e.key === 'Escape') {
        setInputValue('');
        setIsInputVisible(false);
      }
    },
    [inputValue, tags, normalizeTag, onAddTag]
  );

  const handleBlur = useCallback(() => {
    // If there's a value, try to add it
    const normalized = normalizeTag(inputValue);
    if (normalized.length > 0 && !tags.includes(normalized)) {
      onAddTag(normalized);
    }
    setInputValue('');
    setIsInputVisible(false);
  }, [inputValue, tags, normalizeTag, onAddTag]);

  const showInput = useCallback(() => {
    setIsInputVisible(true);
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const isManualTag = useCallback(
    (tag: string) => manualTags.includes(tag),
    [manualTags]
  );

  if (tags.length === 0 && !isInputVisible) {
    return (
      <div className="tags-display" onClick={showInput} role="button" tabIndex={0}>
        <Tag size={14} className="dropdown-icon" style={{ color: 'var(--text-faint)' }} />
        <span className="tags-display-empty">Add Tags</span>
      </div>
    );
  }

  return (
    <div className="tags-display tags-display--editable">
      <Tag size={14} className="dropdown-icon" style={{ color: 'var(--text-muted)' }} />
      <div className="tags-display-chips">
        {tags.map(tag => {
          const color = getColor(tag);
          return (
            <span
              key={tag}
              className="tag-chip"
              style={color ? { borderLeft: `3px solid ${color}` } : undefined}
            >
              <span className="tag-hash">#</span>
              {tag}
              {isManualTag(tag) && (
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTag(tag);
                  }}
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}
        {isInputVisible ? (
          <input
            ref={inputRef}
            type="text"
            className="tags-input-field"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="tag..."
            aria-label="Add new tag"
          />
        ) : (
          <button
            type="button"
            className="tag-chip tag-chip--add"
            onClick={showInput}
            aria-label="Add tag"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
});
