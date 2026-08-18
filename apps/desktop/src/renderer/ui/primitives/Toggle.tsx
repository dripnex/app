/**
 * Toggle — Design system primitive
 */

import styles from './Toggle.module.css';

export interface ToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ id, checked, onChange, disabled }: ToggleProps) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      disabled={disabled}
      className={styles.toggle}
      role="switch"
      aria-checked={checked}
    />
  );
}
