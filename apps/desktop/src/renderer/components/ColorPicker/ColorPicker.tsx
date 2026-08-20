import { forwardRef } from 'react';
import { TAG_COLORS } from '../../ui/tokens/palette';
import styles from './ColorPicker.module.css';

export { TAG_COLORS };

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

export const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
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
        <button type="button" className={styles.clear} onClick={onClear}>
          Remove color
        </button>
      )}
    </>
  );

  if (!showContainer) {
    return (
      <div ref={ref} className={className}>
        {content}
      </div>
    );
  }

  return (
    <div ref={ref} className={`${styles.container} ${className ?? ''}`}>
      {content}
    </div>
  );
});
