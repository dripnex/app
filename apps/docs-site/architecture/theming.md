# Theming

Readied uses CSS custom properties (design tokens) for theming, with full dark/light mode support and a plugin theme system.

## Color Scheme

The app supports three modes:

- **Dark** - Dark background, light text
- **Light** - Light background, dark text
- **System** - Automatically follows the OS preference

The active scheme is applied via a `data-color-scheme` attribute on the root element:

```html
<html data-color-scheme="dark">
```

## Design Tokens

All visual properties are defined as CSS custom properties in `tokens.css` (~50 variables). These tokens cover backgrounds, text, accents, borders, and semantic colors.

### Core Variables

```css
:root {
  /* Backgrounds */
  --bg-base: ...;
  --bg-surface: ...;
  --bg-elevated: ...;
  --bg-hover: ...;

  /* Text */
  --text-primary: ...;
  --text-secondary: ...;
  --text-muted: ...;
  --text-inverse: ...;

  /* Accent */
  --accent-primary: ...;
  --accent-hover: ...;
  --accent-muted: ...;

  /* Borders */
  --border-default: ...;
  --border-subtle: ...;

  /* Semantic */
  --success: ...;
  --warning: ...;
  --danger: ...;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
  --spacing-8: 2rem;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}
```

Each color variable has different values depending on `data-color-scheme`:

```css
[data-color-scheme='dark'] {
  --bg-base: #0a0b0d;
  --bg-surface: #131417;
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --accent-primary: #3b82f6;
  /* ... */
}

[data-color-scheme='light'] {
  --bg-base: #ffffff;
  --bg-surface: #f4f4f5;
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --accent-primary: #2563eb;
  /* ... */
}
```

## Component Styling

Components use CSS Modules with CSS custom properties:

```css
/* Button.module.css */
.button {
  background: var(--accent-primary);
  color: var(--text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-md);
}

.button:hover {
  background: var(--accent-hover);
}
```

```tsx
import styles from './Button.module.css';

<button className={styles.button}>Create Note</button>;
```

## Editor Theme

CodeMirror has its own theme system, synchronized with app tokens:

```typescript
const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-primary)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent-primary)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--accent-muted)',
  },
});
```

## Plugin Theme System

Plugins can define and register custom themes using the plugin API.

### Registering a Theme

The `data-theme` attribute identifies the active plugin theme:

```html
<html data-color-scheme="dark" data-theme="solarized">
```

Plugins register CSS variable overrides via the plugin context:

```typescript
// In a theme plugin's activate()
context.registerCssVariables({
  '--bg-base': '#002b36',
  '--bg-surface': '#073642',
  '--text-primary': '#839496',
  '--accent-primary': '#268bd2',
  // ...
});
```

### Theme API

Plugins have access to theme-related APIs:

```typescript
// Get current theme info
const theme = context.getTheme();
// { colorScheme: 'dark', activeTheme: 'solarized' }

// React to theme changes
context.onThemeChanged((newTheme) => {
  console.log('Theme changed to:', newTheme.colorScheme);
});
```

### Theme Registry

The app uses a theme registry store to manage multiple theme plugins:

- Plugins register themes during activation
- The active theme is selected in **Settings > Appearance**
- `cssVariableStore` holds the current overrides
- `useCssVariables` hook applies overrides to the DOM

### Built-in Reference: Solarized Theme

A built-in Solarized theme plugin serves as a reference implementation for theme plugin authors. It demonstrates the full lifecycle: registering variables for both dark and light schemes, responding to color scheme changes, and cleaning up on deactivation.

## Theme Settings

Users configure theming in **Settings > Appearance**:

- **Color scheme:** Dark, Light, or System (auto-detect)
- **Active theme:** Choose from installed theme plugins or default
- **Accent color:** Override the accent color
- **Zoom level:** Adjust the UI scale
