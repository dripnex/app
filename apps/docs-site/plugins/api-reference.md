# API Reference

The plugin API is provided through the `PluginContext` object passed to your `activate()` function.

```typescript
activate(context: PluginContext): PluginDisposable | void
```

## PluginContext

| Property      | Type                  | Description                             |
| ------------- | --------------------- | --------------------------------------- |
| `editor`      | `EditorAPI`           | Read and manipulate editor content      |
| `app`         | `AppAPI`              | Access notes, notebooks, and app events |
| `layout`      | `LayoutManager`       | Add UI components to layout zones       |
| `decorations` | `EditorDecorationAPI` | Add line highlights and widgets         |
| `config`      | `PluginConfigAPI`     | Read/write plugin configuration         |
| `log`         | `PluginLogger`        | Log messages to the plugin console      |

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

| Field           | Type      | Required | Description                          |
| --------------- | --------- | -------- | ------------------------------------ |
| `id`            | `string`  | Yes      | Unique command ID within your plugin |
| `name`          | `string`  | Yes      | Display name in command palette      |
| `keybinding`    | `object`  | No       | Keyboard shortcut                    |
| `icon`          | `string`  | No       | Lucide icon name                     |
| `category`      | `string`  | No       | Command category                     |
| `showInPalette` | `boolean` | No       | Show in palette (default: true)      |

**Keybinding modifiers:** `'Mod'` (Cmd on Mac, Ctrl on Windows), `'Shift'`, `'Alt'`

#### `registerExtensions(id, extensions)`

Register CodeMirror 6 extensions for the editor.

```typescript
import { keymap } from '@codemirror/view';

const unregister = context.registerExtensions('my-ext', [
  keymap.of([
    {
      key: 'Tab',
      run: () => {
        /* ... */ return true;
      },
    },
  ]),
]);
```

#### `registerRemarkPlugin(id, plugin)`

Add a remark plugin to the markdown preview pipeline. Remark plugins operate on the **mdast** (markdown abstract syntax tree) level. They receive `(tree, file)` and can transform the tree in place.

Errors thrown by remark plugins are caught and displayed as inline markers in the preview, so a buggy plugin will not break the entire preview.

```typescript
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

function myRemarkPlugin() {
  return (tree: Root) => {
    visit(tree, 'text', (node) => {
      // Transform text nodes
      node.value = node.value.replace(/TODO/g, '[ ] TODO');
    });
  };
}

context.registerRemarkPlugin('my-remark', myRemarkPlugin);
```

#### `registerRehypePlugin(id, plugin)`

Add a rehype plugin to the preview pipeline. Rehype plugins operate on the **hast** (HTML abstract syntax tree) level, after markdown has been converted to HTML. They receive `(tree, file)` and can transform the HTML tree.

Like remark plugins, errors are caught and shown as inline markers in preview.

```typescript
function myRehypePlugin() {
  return (tree) => {
    // Transform the HTML AST
  };
}

context.registerRehypePlugin('my-rehype', myRehypePlugin);
```

#### `registerPreviewComponent(id, tagName, component)`

Replace an HTML element in the markdown preview with a custom React component. Every instance of the specified tag in the rendered preview will be replaced with your component.

```typescript
function CustomAccordion({ children, ...props }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="accordion" onClick={() => setOpen(!open)}>
      {open ? children : <span>Click to expand</span>}
    </div>
  );
}

// Replace all <details> elements with a custom accordion
context.registerPreviewComponent('my-accordion', 'details', CustomAccordion);
```

#### `registerCodeBlockRenderer(id, language, component)`

Render fenced code blocks of a specific language with a custom React component. The component receives `{ code, language, meta }` as props.

````typescript
function MermaidRenderer({ code, language, meta }: {
  code: string;
  language: string;
  meta?: string;
}) {
  return <div className="mermaid">{code}</div>;
}

context.registerCodeBlockRenderer('mermaid', 'mermaid', MermaidRenderer);
````

#### `registerCssVariables(id, variables)`

Register CSS custom properties for theming.

```typescript
context.registerCssVariables('my-theme', {
  '--my-plugin-bg': '#1a1b2e',
  '--my-plugin-accent': '#7c3aed',
});
```

#### `getTheme()`

Returns the current resolved theme as `'dark' | 'light'`.

```typescript
const theme = context.getTheme();
// 'dark' or 'light'
```

#### `onThemeChanged(callback)`

Subscribe to theme changes. The callback fires whenever the user switches between dark and light mode. Returns an unsubscribe function.

```typescript
const unsubscribe = context.onThemeChanged(() => {
  const theme = context.getTheme();
  context.log.info(`Theme changed to ${theme}`);
});

// Later, to stop listening:
unsubscribe();
```

---

## PluginManifest

The `PluginManifest` is the top-level object you export from your plugin. It defines metadata, configuration, and the `activate()` entry point.

| Field            | Type                          | Required | Description                                        |
| ---------------- | ----------------------------- | -------- | -------------------------------------------------- |
| `id`             | `string`                      | Yes      | Unique plugin identifier                           |
| `name`           | `string`                      | Yes      | Display name                                       |
| `version`        | `string`                      | Yes      | Semver version                                     |
| `description`    | `string`                      | No       | Short description                                  |
| `configSchema`   | `Record<string, ConfigField>` | No       | User-configurable settings                         |
| `apiVersion`     | `string`                      | No       | Plugin API version this plugin targets (e.g. `"1"`) |
| `dependencies`   | `Record<string, string>`      | No       | Plugin dependencies: map of pluginId to semver range |
| `themeType`      | `'ui'`                        | No       | Mark this plugin as a theme plugin                 |
| `activate`       | `(context) => Disposable`     | Yes      | Entry point, receives `PluginContext`               |

**Example with new fields:**

```typescript
export const plugin: PluginManifest = {
  id: 'my-theme',
  name: 'My Theme',
  version: '1.0.0',
  apiVersion: '1',
  themeType: 'ui',
  dependencies: {
    'color-utils': '^1.0.0',
  },

  activate(context) {
    // ...
  },
};
```

---

## Config Validation

The `@readied/plugin-api` package exports a `validateConfigValue()` function for validating config values against their schema. This is useful when building custom settings UI or validating values programmatically.

```typescript
import { validateConfigValue } from '@readied/plugin-api';

const result = validateConfigValue(field, value);
// result: { valid: boolean, error?: string }
```

Supports all 5 config field types:

| Type      | Validates                                    |
| --------- | -------------------------------------------- |
| `boolean` | Value is a boolean                           |
| `string`  | Value is a string                            |
| `number`  | Value is a number                            |
| `enum`    | Value matches one of the defined options     |
| `range`   | Value is a number within `min`/`max` bounds  |

**Example:**

```typescript
const field = {
  type: 'range',
  default: 10,
  min: 1,
  max: 100,
  step: 1,
  description: 'Max results',
};

validateConfigValue(field, 50);   // { valid: true }
validateConfigValue(field, 200);  // { valid: false, error: 'Value must be between 1 and 100' }
validateConfigValue(field, 'hi'); // { valid: false, error: 'Expected a number' }
```

---

## EditorAPI

Access via `context.editor`.

| Method                         | Returns        | Description                    |
| ------------------------------ | -------------- | ------------------------------ |
| `getContent()`                 | `string`       | Full editor content            |
| `getSelection()`               | `{ from, to }` | Current selection range        |
| `replaceRange(from, to, text)` | `void`         | Replace text between positions |
| `insertAtCursor(text)`         | `void`         | Insert text at cursor          |
| `getWordCount()`               | `number`       | Word count                     |
| `getCharCount()`               | `number`       | Character count                |
| `getLineCount()`               | `number`       | Line count                     |
| `onDocChanged(callback)`       | `() => void`   | Subscribe to content changes   |
| `onSelectionChanged(callback)` | `() => void`   | Subscribe to selection changes |
| `focus()`                      | `void`         | Focus the editor               |

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

| Method                     | Returns                      | Description                    |
| -------------------------- | ---------------------------- | ------------------------------ |
| `getCurrentNote()`         | `NoteInfo \| null`           | Currently open note            |
| `searchNotes(query)`       | `Promise<Array>`             | Search notes by text           |
| `getNoteById(id)`          | `Promise<NoteInfo \| null>`  | Get note by ID                 |
| `getNoteTags(noteId)`      | `Promise<string[]>`          | Get tags for a note            |
| `getBacklinks(noteId)`     | `Promise<Array>`             | Get notes linking to this note |
| `listNotes()`              | `Promise<NoteSummaryInfo[]>` | List all notes                 |
| `listNotebooks()`          | `Promise<NotebookInfo[]>`    | List all notebooks             |
| `listTags()`               | `Promise<string[]>`          | List all tags                  |
| `onNoteSelected(callback)` | `() => void`                 | Note selection event           |
| `onNoteCreated(callback)`  | `() => void`                 | Note creation event            |
| `onNoteDeleted(callback)`  | `() => void`                 | Note deletion event            |

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

| Method                         | Description                        |
| ------------------------------ | ---------------------------------- |
| `addComponent(zone, entry)`    | Add a React component to a zone    |
| `removeComponent(id)`          | Remove a component by ID           |
| `removeAllForPlugin(pluginId)` | Remove all components for a plugin |

**ZoneEntry:**

```typescript
context.layout.addComponent('editor-status-bar', {
  id: 'my-plugin:status',
  component: MyStatusComponent,
  order: 10, // Lower = further left
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

| Method                              | Returns      | Description                  |
| ----------------------------------- | ------------ | ---------------------------- |
| `addLineHighlight(line, className)` | `() => void` | Highlight a line (1-indexed) |
| `addWidget(pos, dom)`               | `() => void` | Add a DOM widget at position |
| `clear()`                           | `void`       | Remove all decorations       |

---

## PluginConfigAPI

Access via `context.config`. Values persist across sessions.

| Method            | Description          |
| ----------------- | -------------------- |
| `get<T>(key)`     | Read a config value  |
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

| Method                    | Description      |
| ------------------------- | ---------------- |
| `info(message, ...args)`  | Log info message |
| `warn(message, ...args)`  | Log warning      |
| `error(message, ...args)` | Log error        |

Messages appear in the developer console prefixed with your plugin ID.
