import { forwardRef } from 'react';
import styles from './ColorPicker.module.css';

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

export interface ColorPickerProps {
  /** Currently selected color (null if none) */
  currentColor: string | null;
  /** Called when a color is selected */
  onSelect: (color: string) => void;
  /** Called when clear is clicked */
  onClear: () => void;
  /** Whether to show the container wrapper (default: true) */
  showContainer?: boolean;
  /** Additional className for the root element */
  className?: string;
}

export const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(
  function ColorPicker(
    { currentColor, onSelect, onClear, showContainer = true, className },
    ref
  ) {
    const content = (
      <>
        <div className={styles.grid}>
          {TAG_COLORS.map(color => (
            <button
              key={color}
              type="button"
              className={currentColor === color ? styles.swatchSelected : styles.swatch}
              style={{ backgroundColor: color }}
              onClick={() => onSelect(color)}
              aria-label={`Set color to ${color}`}
            />
          ))}
        </div>
        {currentColor && (
          <button
            type="button"
            className={styles.clear}
            onClick={onClear}
          >
            Remove color
          </button>
        )}
      </>
    );

    if (!showContainer) {
      return <div ref={ref} className={className}>{content}</div>;
    }

    return (
      <div ref={ref} className={`${styles.container} ${className ?? ''}`}>
        {content}
      </div>
    );
  }
);
