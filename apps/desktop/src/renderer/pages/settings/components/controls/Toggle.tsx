/**
 * Toggle Control
 *
 * A switch/checkbox for boolean settings.
 */

import styles from './Controls.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, disabled = false, id }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}
