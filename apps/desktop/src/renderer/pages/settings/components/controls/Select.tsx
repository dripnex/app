/**
 * Select Control
 *
 * A dropdown for selecting from predefined options.
 */

import styles from './Controls.module.css';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  disabled?: boolean;
  id?: string;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
  id,
}: SelectProps<T>) {
  return (
    <select
      id={id}
      className={styles.select}
      value={value}
      onChange={e => onChange(e.target.value as T)}
      disabled={disabled}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
