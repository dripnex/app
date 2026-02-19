# API Reference

The plugin API is provided through the `PluginContext` object passed to your `activate()` function.

```typescript
activate(context: PluginContext): PluginDisposable | void
```

## PluginContext

| Property | Type | Description |
|----------|------|-------------|
| `editor` | `EditorAPI` | Read and manipulate editor content |
| `app` | `AppAPI` | Access notes, notebooks, and app events |
| `layout` | `LayoutManager` | Add UI components to layout zones |
| `decorations` | `EditorDecorationAPI` | Add line highlights and widgets |
| `config` | `PluginConfigAPI` | Read/write plugin configuration |
| `log` | `PluginLogger` | Log messages to the plugin console |

### Methods

#### `registerCommand(options, execute)`

Register a command in the command palette.

```typescript
const unregister = context.registerCommand(
  {
    id: 'my-command',
    name: 'Do Something',
    keybinding: { key: 'D', modifiers: ['Mod', 'Shift'] },
    icon: 'Wand',
  },
  () => {
    // Your logic here
    return true; // handled
  }
);
```

**PluginCommandOptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique command ID within your plugin |
| `name` | `string` | Yes | Display name in command palette |
| `keybinding` | `object` | No | Keyboard shortcut |
| `icon` | `string` | No | Lucide icon name |
| `category` | `string` | No | Command category |
| `showInPalette` | `boolean` | No | Show in palette (default: true) |

**Keybinding modifiers:** `'Mod'` (Cmd on Mac, Ctrl on Windows), `'Shift'`, `'Alt'`

#### `registerExtensions(id, extensions)`

Register CodeMirror 6 extensions for the editor.

```typescript
import { keymap } from '@codemirror/view';

const unregister = context.registerExtensions('my-ext', [
  keymap.of([{ key: 'Tab', run: () => { /* ... */ return true; } }]),
]);
```

#### `registerRemarkPlugin(id, plugin)`

Add a remark plugin to the markdown preview pipeline (mdast level).

#### `registerRehypePlugin(id, plugin)`

Add a rehype plugin to the preview pipeline (hast level).

#### `registerPreviewComponent(id, tagName, component)`

Replace an HTML element in the preview with a custom React component.

#### `registerCodeBlockRenderer(id, language, component)`

Render fenced code blocks of a specific language with a custom component.

```typescript
function MermaidRenderer({ code }: { code: string }) {
  return <div className="mermaid">{code}</div>;
}

context.registerCodeBlockRenderer('mermaid', 'mermaid', MermaidRenderer);
```

#### `registerCssVariables(id, variables)`

Register CSS custom properties for theming.

```typescript
context.registerCssVariables('my-theme', {
  '--my-plugin-bg': '#1a1b2e',
  '--my-plugin-accent': '#7c3aed',
});
```

---

## EditorAPI

Access via `context.editor`.

| Method | Returns | Description |
|--------|---------|-------------|
| `getContent()` | `string` | Full editor content |
| `getSelection()` | `{ from, to }` | Current selection range |
| `replaceRange(from, to, text)` | `void` | Replace text between positions |
| `insertAtCursor(text)` | `void` | Insert text at cursor |
| `getWordCount()` | `number` | Word count |
| `getCharCount()` | `number` | Character count |
| `getLineCount()` | `number` | Line count |
| `onDocChanged(callback)` | `() => void` | Subscribe to content changes |
| `onSelectionChanged(callback)` | `() => void` | Subscribe to selection changes |
| `focus()` | `void` | Focus the editor |

**Example: Word frequency counter**

```typescript
const content = context.editor.getContent();
const words = content.split(/\s+/).filter(Boolean);
const freq = new Map<string, number>();
words.forEach(w => {
  const lower = w.toLowerCase();
  freq.set(lower, (freq.get(lower) || 0) + 1);
});
```

---

## AppAPI

Access via `context.app`. All methods are read-only.

| Method | Returns | Description |
|--------|---------|-------------|
| `getCurrentNote()` | `NoteInfo \| null` | Currently open note |
| `searchNotes(query)` | `Promise<Array>` | Search notes by text |
| `getNoteById(id)` | `Promise<NoteInfo \| null>` | Get note by ID |
| `getNoteTags(noteId)` | `Promise<string[]>` | Get tags for a note |
| `getBacklinks(noteId)` | `Promise<Array>` | Get notes linking to this note |
| `listNotes()` | `Promise<NoteSummaryInfo[]>` | List all notes |
| `listNotebooks()` | `Promise<NotebookInfo[]>` | List all notebooks |
| `listTags()` | `Promise<string[]>` | List all tags |
| `onNoteSelected(callback)` | `() => void` | Note selection event |
| `onNoteCreated(callback)` | `() => void` | Note creation event |
| `onNoteDeleted(callback)` | `() => void` | Note deletion event |

**NoteInfo type:**

```typescript
interface NoteInfo {
  id: string;
  title: string;
  content: string;
}
```

---

## LayoutManager

Access via `context.layout`. See [Layout Zones](/plugins/layout-zones) for zone details.

| Method | Description |
|--------|-------------|
| `addComponent(zone, entry)` | Add a React component to a zone |
| `removeComponent(id)` | Remove a component by ID |
| `removeAllForPlugin(pluginId)` | Remove all components for a plugin |

**ZoneEntry:**

```typescript
context.layout.addComponent('editor-status-bar', {
  id: 'my-plugin:status',
  component: MyStatusComponent,
  order: 10,         // Lower = further left
  meta: { editor: context.editor },
});
```

Your component receives `{ meta }` as props:

```typescript
function MyStatusComponent({ meta }: ZoneComponentProps) {
  const editor = meta?.editor as EditorAPI;
  return <span>{editor.getWordCount()} words</span>;
}
```

---

## EditorDecorationAPI

Access via `context.decorations`.

| Method | Returns | Description |
|--------|---------|-------------|
| `addLineHighlight(line, className)` | `() => void` | Highlight a line (1-indexed) |
| `addWidget(pos, dom)` | `() => void` | Add a DOM widget at position |
| `clear()` | `void` | Remove all decorations |

---

## PluginConfigAPI

Access via `context.config`. Values persist across sessions.

| Method | Description |
|--------|-------------|
| `get<T>(key)` | Read a config value |
| `set(key, value)` | Write a config value |

Define your config schema in the manifest:

```typescript
export const plugin: PluginManifest = {
  // ...
  configSchema: {
    apiKey: {
      type: 'string',
      default: '',
      description: 'API key for the service',
    },
    maxResults: {
      type: 'range',
      default: 10,
      min: 1,
      max: 100,
      step: 1,
      description: 'Maximum results to show',
    },
    theme: {
      type: 'enum',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
      description: 'Plugin theme',
    },
    showNotifications: {
      type: 'boolean',
      default: true,
      description: 'Show notification popups',
    },
  },
};
```

Config fields automatically render in **Settings > Plugins** when users expand your plugin's settings.

---

## PluginLogger

Access via `context.log`.

| Method | Description |
|--------|-------------|
| `info(message, ...args)` | Log info message |
| `warn(message, ...args)` | Log warning |
| `error(message, ...args)` | Log error |

Messages appear in the developer console prefixed with your plugin ID.
