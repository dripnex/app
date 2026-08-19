import { type ButtonHTMLAttributes, type ReactNode, forwardRef, useEffect } from 'react';
import { ensurePluginComponentStyles } from './styles.js';

export interface PluginButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, PluginButtonProps>(function Button(
  { variant = 'secondary', type = 'button', className, children, ...rest },
  ref
) {
  useEffect(() => {
    ensurePluginComponentStyles();
  }, []);
  const cls = [
    'dripnex-plugin-btn',
    variant === 'primary' ? 'dripnex-plugin-btn--primary' : '',
    variant === 'danger' ? 'dripnex-plugin-btn--danger' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {children}
    </button>
  );
});
