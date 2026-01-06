/**
 * TextInput Control
 *
 * A text input for string settings.
 */

import styles from './Controls.module.css';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
}: TextInputProps) {
  return (
    <input
      type="text"
      id={id}
      className={styles.textInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
