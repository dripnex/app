import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';

interface TitleInputProps {
  /** Current title value */
  value: string;
  /** Callback when title changes (debounced) */
  onChange: (title: string) => void;
  /** Callback when Enter is pressed (to focus editor) */
  onEnter?: () => void;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Editable title input for notes.
 *
 * Behavior:
 * - Enter: Triggers onEnter (typically focuses editor), does NOT submit
 * - Escape: Reverts to original value
 * - Blur: Saves if changed
 * - Auto-save with 500ms debounce while typing
 */
export function TitleInput({
  value,
  onChange,
  onEnter,
  placeholder = 'Untitled',
}: TitleInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [originalValue, setOriginalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with external value changes (e.g., switching notes)
  useEffect(() => {
    setLocalValue(value);
    setOriginalValue(value);
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const saveTitle = useCallback(
    (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (trimmed && trimmed !== originalValue) {
        onChange(trimmed);
        setOriginalValue(trimmed);
      }
    },
    [onChange, originalValue]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce save (500ms)
      debounceRef.current = setTimeout(() => {
        saveTitle(newValue);
      }, 500);
    },
    [saveTitle]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Clear pending debounce and save immediately
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        saveTitle(localValue);
        onEnter?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Clear pending debounce and revert
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        setLocalValue(originalValue);
        inputRef.current?.blur();
      }
    },
    [localValue, originalValue, saveTitle, onEnter]
  );

  const handleBlur = useCallback(() => {
    // Clear pending debounce and save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    saveTitle(localValue);
  }, [localValue, saveTitle]);

  return (
    <input
      ref={inputRef}
      type="text"
      className="title-input"
      value={localValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label="Note title"
    />
  );
}
