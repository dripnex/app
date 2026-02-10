import { type InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', style, ...props }, ref) => {
    const inputStyles: React.CSSProperties = {
      width: '100%',
      padding: 'var(--space-3) var(--space-4)',
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)',
      background: 'var(--bg-inset)',
      border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      transition: 'border-color var(--duration-fast) var(--ease-out)',
      ...style,
    };

    const labelStyles: React.CSSProperties = {
      display: 'block',
      marginBottom: 'var(--space-2)',
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      color: 'var(--text-secondary)',
    };

    const errorStyles: React.CSSProperties = {
      marginTop: 'var(--space-2)',
      fontSize: 'var(--text-sm)',
      color: 'var(--danger)',
    };

    return (
      <div className={className}>
        {label && <label style={labelStyles}>{label}</label>}
        <input ref={ref} style={inputStyles} {...props} />
        {error && <span style={errorStyles}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
