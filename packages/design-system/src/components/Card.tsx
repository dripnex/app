import { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  style,
  ...props
}: CardProps) {
  const baseStyles: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  };

  const paddingStyles: Record<string, React.CSSProperties> = {
    none: { padding: 0 },
    sm: { padding: 'var(--space-4)' },
    md: { padding: 'var(--space-6)' },
    lg: { padding: 'var(--space-8)' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
    },
    glass: {
      background: 'var(--glass-bg)',
      backdropFilter: 'var(--blur-md)',
      WebkitBackdropFilter: 'var(--blur-md)',
      border: '1px solid var(--glass-border)',
    },
    elevated: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
    },
  };

  return (
    <div
      className={className}
      style={{
        ...baseStyles,
        ...paddingStyles[padding],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
