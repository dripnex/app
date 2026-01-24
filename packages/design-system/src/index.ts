// Components
export * from './components';

// Token values as JS constants (for programmatic access)
export const tokens = {
  colors: {
    bgBase: '#0a0b0d',
    bgSurface: '#111214',
    bgElevated: '#18191c',
    bgInset: '#0d0e10',
    textPrimary: '#f4f4f5',
    accent: '#5eead4',
    accentStrong: '#2dd4bf',
    danger: '#f87171',
    warning: '#fbbf24',
    success: '#34d399',
  },
  spacing: {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  radii: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  fonts: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace",
  },
} as const;
