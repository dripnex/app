/**
 * Input — Design system primitive
 *
 * Sizes: sm | md
 */

import { type InputHTMLAttributes, forwardRef } from 'react';
import styles from './Input.module.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  invalid?: boolean;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { size = 'md', invalid = false, mono = false, className, type = 'text', ...rest },
    ref
  ) => {
    const cls = [
      styles.input,
      styles[size],
      invalid ? styles.invalid : '',
      mono ? styles.mono : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return <input ref={ref} type={type} className={cls} aria-invalid={invalid || undefined} {...rest} />;
  }
);

Input.displayName = 'Input';
