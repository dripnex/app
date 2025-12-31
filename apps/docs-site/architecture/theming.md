# Theming

Readied uses CSS variables for theming.

## Design Tokens

```css
:root {
  /* Colors */
  --color-bg: #0a0b0d;
  --color-bg-secondary: #131417;
  --color-text: #e4e4e7;
  --color-text-muted: #71717a;
  --color-accent: #3b82f6;
  --color-border: #27272a;

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

## Component Styling

Using Tailwind CSS with design tokens:

```tsx
<button
  className="
  bg-[var(--color-accent)]
  text-white
  px-4 py-2
  rounded-[var(--radius-md)]
  hover:opacity-90
"
>
  Create Note
</button>
```

## Dark Mode

Currently dark-only. Light mode planned for v0.2+.

## Editor Theme

CodeMirror has its own theme system, synchronized with app tokens:

```typescript
const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-accent)',
  },
});
```
