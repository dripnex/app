import { memo, useState, useCallback, useRef, useMemo, type KeyboardEvent } from 'react';
import { Tag, X } from 'lucide-react';
import { useTagColorsStore } from '../../stores/tagColorsStore';
import { useTags } from '../../hooks/useNotes';

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

  // Subscribe to colors directly for reactivity (not getColor function)
  const colors = useTagColorsStore(state => state.colors);
  const getColor = useMemo(() => (tag: string) => colors[tag] ?? null, [colors]);

  // Autocomplete: fetch all existing tags
  const { data: allTags = [] } = useTags();
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Fuzzy match: returns score (higher = better match), -1 = no match
  const fuzzyMatch = useCallback((tag: string, query: string): number => {
    if (tag.startsWith(query)) return 1000 + (100 - tag.length); // Exact prefix = highest
    if (tag.includes(query)) return 500 + (100 - tag.length); // Contains = high

    // Character-by-character fuzzy matching
    let queryIdx = 0;
    let score = 0;
    let consecutive = 0;

    for (let i = 0; i < tag.length && queryIdx < query.length; i++) {
      if (tag[i] === query[queryIdx]) {
        queryIdx++;
        consecutive++;
        score += consecutive * 10; // Bonus for consecutive matches
        if (i === 0) score += 50; // Bonus for match at start
      } else {
        consecutive = 0;
      }
    }

    return queryIdx === query.length ? score : -1;
  }, []);

  // Filter suggestions based on input with fuzzy search
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    const query = inputValue.toLowerCase();

    return allTags
      .filter(tag => !tags.includes(tag))
      .map(tag => ({ tag, score: fuzzyMatch(tag, query) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.tag);
  }, [inputValue, allTags, tags, fuzzyMatch]);

  const normalizeTag = useCallback((value: string): string => {
    return value.trim().toLowerCase().replace(/^#/, '');
  }, []);

  // Select a suggestion from autocomplete
  const selectSuggestion = useCallback(
    (tag: string) => {
      onAddTag(tag);
      setInputValue('');
      setSelectedSuggestionIndex(-1);
    },
    [onAddTag]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Arrow navigation for suggestions
      if (filteredSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedSuggestionIndex(prev =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedSuggestionIndex(prev =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
          return;
        }
        if (e.key === 'Tab' && selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
          e.preventDefault();
          selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        // If a suggestion is selected, use it
        if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
          selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
          return;
        }
        // Otherwise add the typed value
        const normalized = normalizeTag(inputValue);
        if (normalized.length > 0 && !tags.includes(normalized)) {
          onAddTag(normalized);
          setInputValue('');
        }
      } else if (e.key === 'Escape') {
        setInputValue('');
        setIsInputVisible(false);
        setSelectedSuggestionIndex(-1);
      }
    },
    [inputValue, tags, normalizeTag, onAddTag, filteredSuggestions, selectedSuggestionIndex, selectSuggestion]
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow click on suggestion to register
    setTimeout(() => {
      // If there's a value, try to add it
      const normalized = normalizeTag(inputValue);
      if (normalized.length > 0 && !tags.includes(normalized)) {
        onAddTag(normalized);
      }
      setInputValue('');
      setIsInputVisible(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
  }, [inputValue, tags, normalizeTag, onAddTag]);

  // Reset suggestion index when input changes
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setSelectedSuggestionIndex(-1);
  }, []);

  const showInput = useCallback(() => {
    setIsInputVisible(true);
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const isManualTag = useCallback((tag: string) => manualTags.includes(tag), [manualTags]);

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
              className={`tag-chip ${color ? 'tag-chip--colored' : ''}`}
              style={
                color
                  ? {
                      '--tag-color': color,
                      '--tag-color-bg': `${color}20`,
                    } as React.CSSProperties
                  : undefined
              }
            >
              <span className="tag-hash">#</span>
              {tag}
              {isManualTag(tag) && (
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={e => {
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
          <div className="tags-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="tags-input-field"
              value={inputValue}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="tag..."
              aria-label="Add new tag"
              autoComplete="off"
            />
            {filteredSuggestions.length > 0 && (
              <div className="tags-suggestions">
                {filteredSuggestions.map((tag, index) => {
                  const color = getColor(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`tags-suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                      onMouseDown={() => selectSuggestion(tag)}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                    >
                      <span
                        className="tags-suggestion-color"
                        style={color ? { background: color } : undefined}
                      />
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
