# Dripnex UI System

Canonical UI layer for the desktop renderer.

## Structure

```
ui/
  tokens/        # Design tokens (CSS custom properties)
  primitives/    # Base components (Button, Modal, Tooltip, etc.)
  patterns/      # Composed patterns (SlidePanel, ContextMenu, Toast)
  components/    # Feature components (Sidebar, NoteList, EditorHeader)
```

## Tokens

`tokens/tokens.css` is the single source of truth for all design tokens.
All colors, spacing, radii, and transitions are defined here.

## Primitives

Low-level native components: Button, Input, Select, NumberInput, Field, Toggle, Toast.
No Radix / shadcn — desktop stays on CSS modules + tokens.

## Patterns

Composed from primitives. These encode specific Dripnex UX patterns
like slide-in panels, context menus, and toasts.

## Components

Feature-specific components that compose primitives and patterns.
These will gradually migrate from `../components/` as the UI stabilizes.
