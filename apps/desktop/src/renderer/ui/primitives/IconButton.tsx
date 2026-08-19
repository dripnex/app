import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  label: string;
  pressed?: boolean;
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, pressed, className, type = 'button', disabled = false, children, ...rest }, ref) => {
    const cls = [styles.button, pressed ? styles.pressed : '', className ?? '']
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={cls}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        title={rest.title ?? label}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
