# Layout Zones

Plugins can place React components into predefined layout zones using `context.layout.addComponent()`.

## Available Zones

| Zone | Location | Typical Use |
|------|----------|-------------|
| `editor-status-bar` | Bottom of editor | Statistics, indicators |
| `editor-header-actions` | Right side of note header | Toggle buttons, quick actions |
| `editor-toolbar` | Above editor content | Formatting tools |
| `panel` | Side panel area | Large interactive UI (AI, search) |
| `sidebar-section` | Left sidebar | Navigation, note lists |
| `modal` | Overlay | Dialogs, forms |
| `settings-section` | Settings page | Plugin settings UI |
| `note-list-footer` | Bottom of note list | Note list actions |
| `command-palette-footer` | Below command palette | Contextual actions |

## Zone Diagram

```
┌─────────────────────────────────────────────────────┐
│ sidebar-section │  editor-header-actions             │
│                 ├───────────────────────────────┐    │
│                 │  editor-toolbar                │    │
│                 ├───────────────────────────────┤    │
│                 │                               │panel│
│                 │  [Editor Content]              │    │
│                 │                               │    │
│                 ├───────────────────────────────┤    │
│ note-list-footer│  editor-status-bar             │    │
└─────────────────────────────────────────────────────┘
```

## Usage

### Status Bar Component

```typescript
import { useState, useEffect } from 'react';
import type { ZoneComponentProps, EditorAPI } from '@readied/plugin-api';

function MyStatus({ meta }: ZoneComponentProps) {
  const editor = meta?.editor as EditorAPI;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const update = () => setCount(editor.getWordCount());
    update();
    return editor.onDocChanged(update);
  }, [editor]);

  return <span>{count} words</span>;
}

// In activate():
context.layout.addComponent('editor-status-bar', {
  id: 'my-plugin:status',
  component: MyStatus,
  order: 10,
  meta: { editor: context.editor },
});
```

### Header Action Button

```typescript
function MyToggleButton() {
  const [active, setActive] = useState(false);
  return (
    <button
      className={`note-editor-actions-btn${active ? ' active' : ''}`}
      onClick={() => setActive(!active)}
      title="My Feature"
    >
      <Star size={18} />
    </button>
  );
}

context.layout.addComponent('editor-header-actions', {
  id: 'my-plugin:toggle',
  component: MyToggleButton,
  order: 20,
});
```

### Side Panel

```typescript
function MyPanel({ meta }: ZoneComponentProps) {
  // Only render when visible
  if (!meta?.visible) return null;

  return (
    <div className="my-panel">
      <h3>My Panel</h3>
      <p>Panel content here</p>
    </div>
  );
}

context.layout.addComponent('panel', {
  id: 'my-plugin:panel',
  component: MyPanel,
  order: 50,
  meta: { context },
});
```

## Ordering

The `order` property controls position within a zone. Lower numbers appear first (further left in horizontal zones, further up in vertical zones).

| Range | Convention |
|-------|-----------|
| 1-9 | Core app components |
| 10-29 | Built-in plugins |
| 30-99 | Community plugins |

## Cleanup

Always remove your components when the plugin is deactivated:

```typescript
activate(context) {
  context.layout.addComponent('editor-status-bar', {
    id: 'my-plugin:status',
    component: MyStatus,
    order: 30,
    meta: { editor: context.editor },
  });

  return {
    dispose() {
      context.layout.removeComponent('my-plugin:status');
    },
  };
}
```
