# Readied Design System - Tokens

This document describes the design token system used throughout Readied. All design tokens are defined in `tokens.css` and should be used via CSS custom properties.

## Philosophy

- **Single Source of Truth**: All colors, spacing, typography, and effects are defined in `tokens.css`
- **No Hardcoded Values**: Never use hardcoded colors, spacing, or shadows in component CSS
- **Light/Dark Support**: All tokens have light and dark theme variants
- **Semantic Naming**: Token names describe their purpose, not their value

## Token Categories

### Spacing Scale

Use these for margins, padding, and gaps:

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

**Example:**

```css
.card {
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}
```

### Colors - Background

```css
--bg-base: #0a0b0d; /* Main background */
--bg-surface: #111214; /* Cards, panels */
--bg-elevated: #18191c; /* Modals, popovers */
--bg-inset: #0d0e10; /* Input fields, code blocks */
--bg-hover: rgba(255, 255, 255, 0.05); /* Hover state */
--bg-active: rgba(255, 255, 255, 0.08); /* Active/pressed state */
```

**Example:**

```css
.button {
  background: var(--bg-surface);
}

.button:hover {
  background: var(--bg-hover);
}
```

### Colors - Border

```css
--border: rgba(255, 255, 255, 0.08); /* Default borders */
--border-subtle: rgba(255, 255, 255, 0.04); /* Subtle dividers */
--border-strong: rgba(255, 255, 255, 0.12); /* Emphasized borders */
--border-hover: rgba(255, 255, 255, 0.12); /* Hover state */
```

**Example:**

```css
.input {
  border: 1px solid var(--border);
}

.input:focus {
  border-color: var(--accent-primary);
}
```

### Colors - Text

```css
--text-primary: #f4f4f5; /* Headings, primary content */
--text-secondary: rgba(255, 255, 255, 0.7); /* Body text */
--text-muted: rgba(255, 255, 255, 0.5); /* Captions, labels */
--text-faint: rgba(255, 255, 255, 0.3); /* Placeholders, disabled */
```

**Example:**

```css
.heading {
  color: var(--text-primary);
}

.caption {
  color: var(--text-muted);
}
```

### Colors - Accent

```css
--accent: #5eead4; /* Primary accent (customizable) */
--accent-primary: var(--accent); /* Same as accent */
--accent-muted: rgba(94, 234, 212, 0.15); /* Subtle backgrounds */
--accent-strong: #2dd4bf; /* Darker variant */
--accent-hover: (computed); /* Hover state (auto-computed) */
```

**Example:**

```css
.button-primary {
  background: var(--accent);
  color: white;
}

.button-primary:hover {
  background: var(--accent-hover);
}
```

### Colors - Semantic

```css
--danger: #f87171; /* Destructive actions */
--danger-muted: rgba(248, 113, 113, 0.15);
--warning: #fbbf24; /* Warnings */
--warning-muted: rgba(251, 191, 36, 0.15);
--success: #34d399; /* Success states */
--success-muted: rgba(52, 211, 153, 0.15);
```

**Example:**

```css
.alert-error {
  background: var(--danger-muted);
  border-color: var(--danger);
  color: var(--danger);
}
```

### Colors - Status

Use these for note status indicators:

```css
--status-active: var(--text-secondary); /* Active notes */
--status-on-hold: #f59e0b; /* On hold (amber) */
--status-completed: #22c55e; /* Completed (green) */
--status-dropped: #ef4444; /* Dropped (red) */
```

**Example:**

```css
.status-icon[data-status='completed'] {
  color: var(--status-completed);
}
```

### Glass Effects

Use these for glassmorphism effects:

```css
--glass-bg: rgba(20, 22, 26, 0.85); /* Main glass background */
--glass-bg-menu: rgba(40, 45, 55, 0.92); /* Context menus */
--glass-border: rgba(255, 255, 255, 0.08); /* Glass borders */
--glass-border-menu: rgba(255, 255, 255, 0.06); /* Menu borders */
--glass-blur: 28px; /* Backdrop blur amount */
--glass-saturate: 180%; /* Saturation boost */
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); /* Glass shadow */
```

**Example:**

```css
.modal {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05); /* Small elements */
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1); /* Cards, buttons */
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1); /* Dropdowns, popovers */
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15); /* Modals */
```

**Example:**

```css
.dropdown {
  box-shadow: var(--shadow-lg);
}
```

### Typography

```css
/* Fonts */
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
--font-mono: 'JetBrains Mono', 'SF Mono', ...;

/* Sizes */
--text-xs: 11px; /* Small labels */
--text-sm: 12px; /* UI text */
--text-base: 13px; /* Body text */
--text-lg: 14px; /* Emphasized text */
--text-xl: 16px; /* Headings */
--text-2xl: 18px; /* Large headings */
```

**Example:**

```css
.body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
}

.heading {
  font-size: var(--text-xl);
}
```

### Radii

```css
--radius-sm: 4px; /* Small buttons, chips */
--radius-md: 6px; /* Inputs, cards */
--radius-lg: 8px; /* Modals, panels */
--radius-xl: 12px; /* Large containers */
```

**Example:**

```css
.card {
  border-radius: var(--radius-lg);
}
```

### Transitions

```css
--transition-fast: 150ms ease; /* Quick interactions */
--transition-normal: 200ms ease; /* Standard transitions */
--transition-slow: 300ms ease; /* Emphasized animations */
```

**Example:**

```css
.button {
  transition: background var(--transition-normal);
}
```

## Light Theme

All tokens automatically switch when `data-theme="light"` is set on `:root`.

**Light theme adjustments:**

- Background colors are inverted (white base)
- Text colors are dark
- Borders use black with low opacity
- Status colors are slightly darker for better contrast
- Glass effects use white backgrounds

## Usage Guidelines

### ✅ DO

```css
/* Use semantic tokens */
.button {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

/* Use spacing scale */
.container {
  padding: var(--space-4);
  gap: var(--space-2);
}

/* Use shadows */
.card {
  box-shadow: var(--shadow-md);
}
```

### ❌ DON'T

```css
/* Don't hardcode colors */
.button {
  background: #111214; /* ❌ Use var(--bg-surface) */
  color: #f4f4f5; /* ❌ Use var(--text-primary) */
}

/* Don't hardcode spacing */
.container {
  padding: 16px; /* ❌ Use var(--space-4) */
}

/* Don't hardcode shadows */
.card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* ❌ Use var(--shadow-md) */
}
```

## Adding New Tokens

When adding new tokens:

1. **Add to `tokens.css`** in the appropriate category
2. **Add light theme override** in `:root[data-theme="light"]`
3. **Document it** in this README
4. **Update existing hardcoded values** to use the new token

**Example:**

```css
/* In tokens.css */
:root {
  --new-token: value-dark;
}

:root[data-theme='light'] {
  --new-token: value-light;
}
```

## Testing

When making token changes:

1. **Test both themes**: Switch between dark and light
2. **Test all accent colors**: Try different accent colors (8 options)
3. **Test zoom levels**: Verify at 80%, 100%, 130%
4. **Check contrast**: Ensure WCAG AA compliance

## Migration

To migrate hardcoded colors to tokens:

1. **Find hardcoded colors**: Search for `rgba(`, `rgb(`, `#[0-9a-f]{6}`
2. **Identify semantic meaning**: What does this color represent?
3. **Replace with token**: Use the appropriate semantic token
4. **Test light theme**: Verify the color works in both themes

## Color Utilities

For programmatic color manipulation, use `utils/colorUtils.ts`:

```typescript
import { darkenColor, lightenColor, computeHoverColor } from '@/utils/colorUtils';

// Darken a color by 20%
const darker = darkenColor('#5eead4', 0.2);

// Lighten a color by 15%
const lighter = lightenColor('#5eead4', 0.15);

// Compute hover state (auto-darkens by 15%)
const hoverColor = computeHoverColor('#5eead4');
```

## Performance Considerations

- **CSS custom properties are fast**: No performance penalty
- **Use CSS variables over inline styles**: Better for browser optimization
- **Avoid `style.setProperty` in hot paths**: Use classes when possible

## Accessibility

All color tokens are designed with accessibility in mind:

- **Contrast ratios**: All text/background combinations meet WCAG AA
- **Color blindness**: Status colors use distinct hues
- **High contrast mode**: Tokens work with OS high contrast settings

## Related Files

- **`tokens.css`**: Token definitions
- **`global.css`**: Global styles using tokens
- **`colorUtils.ts`**: Programmatic color manipulation
- **`useAppearanceSettings.ts`**: Theme/accent color application

---

Last updated: Phase 1, Week 1 - Design System Fixes
