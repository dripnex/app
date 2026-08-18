/**
 * Select — Design system primitive
 *
 * Native <select>. Sizes match Input / Button.
 */

import { type SelectHTMLAttributes, forwardRef } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  size?: 'sm' | 'md';
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      value,
      onChange,
      options,
      size = 'md',
      invalid = false,
      disabled,
      className,
      id,
      ...rest
    },
    ref
  ) => {
    const cls = [
      styles.select,
      styles[size],
      invalid ? styles.invalid : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <select
        ref={ref}
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        className={cls}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';
