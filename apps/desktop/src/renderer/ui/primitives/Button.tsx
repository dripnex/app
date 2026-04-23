/**
 * Button — Design system primitive
 *
 * Variants: primary | secondary | danger | ghost
 * Sizes:    sm | md
 */

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled = false,
      icon,
      children,
      className,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const cls = [
      styles.button,
      styles[variant],
      styles[size],
      loading ? styles.loading : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} type={type} className={cls} disabled={disabled || loading} {...rest}>
        {loading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
