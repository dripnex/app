# Tables Plugin — How It Works

## Overview

Built-in plugin (`readied-tables`) that adds full GFM table support: insert wizard, WYSIWYG editing, sortable preview, and CSV export.

**File:** `apps/desktop/src/renderer/plugins/tables.tsx`

---

## Features

### 1. Insert Table Wizard

- **Shortcut:** `Cmd+Alt+T` (Mac) / `Ctrl+Alt+T` (Win/Linux)
- Opens a 10x6 grid modal
- Hover to select dimensions, click to insert
- Generates GFM markdown at cursor position:

```markdown
| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
|          |          |          |
|          |          |          |
```

**Flow:** Command registered -> `context.layout.addComponent('modal', ...)` -> user clicks -> `context.editor.insertAtCursor()` -> modal closes

### 2. WYSIWYG Table Rendering (Editor)

- CodeMirror 6 `ViewPlugin` scans document for table ranges
- Renders visual `<table>` HTML as widget decorations
- When cursor enters the table, shows raw markdown for editing
- When cursor leaves, re-renders the visual table
- Respects alignment markers: `:---` (left), `:---:` (center), `---:` (right)
- Toggleable via command, state persisted in plugin config

**Key functions:**

- `findTableRanges()` — scans doc for all table boundaries
- `parseGfmTable()` — parses headers, alignments, rows
- `buildTableDecorations()` — creates CM6 decorations, skips table under cursor
- `TableWidget` — custom `WidgetType` that builds DOM `<table>`

### 3. Sortable Preview Tables

- `SortableTable` React component replaces all `<table>` in markdown preview
- Registered via `context.registerPreviewComponent('table', SortableTable)`
- Click column header to sort ascending, click again for descending
- Auto-detects numeric columns (sorts as numbers vs strings)

### 4. Export to CSV

- Command: "Export Table to CSV"
- Finds table at current cursor position
- Converts to RFC 4180 CSV (proper escaping of commas, quotes, newlines)
- Copies to clipboard via `navigator.clipboard.writeText()`

---

## Plugin API Usage

| API Call                             | Purpose                                        |
| ------------------------------------ | ---------------------------------------------- |
| `context.editor.insertAtCursor()`    | Insert generated table markdown                |
| `context.editor.getContent()`        | Read full doc to find tables                   |
| `context.editor.getSelection()`      | Get cursor position for CSV export             |
| `context.editor.focus()`             | Return focus after modal                       |
| `context.registerCommand()`          | 3 commands: Insert, Toggle WYSIWYG, Export CSV |
| `context.registerExtensions()`       | CM6 ViewPlugin for WYSIWYG                     |
| `context.registerPreviewComponent()` | SortableTable in preview                       |
| `context.layout.addComponent()`      | Show insert modal                              |
| `context.layout.removeComponent()`   | Close modal                                    |
| `context.config.get/set()`           | Persist WYSIWYG toggle                         |

---

## Registration

```tsx
// App.tsx
import { tablesPlugin } from './plugins/tables';

const builtInPlugins = useMemo(
  () => [wordCountPlugin, typewriterModePlugin, activeLineHighlightPlugin, tablesPlugin],
  []
);
```

Activated by `<PluginHost>` via `PluginRegistry.activate()`.

---

## Lifecycle

**Activate:** registers 3 commands + WYSIWYG extension + preview component + loads config

**Deactivate:** dispose function unregisters everything (commands, extensions, preview components, layout entries). Auto-cleanup of event listeners.

---

## CSS

Styles live in `apps/desktop/src/renderer/styles/global.css`:

- `.cm-table-widget` / `.cm-table-visual` — WYSIWYG editor tables
- `.sortable-table` / `.sortable-th` / `.sort-indicator` — Preview sortable tables
- `.insert-table-modal` / `.table-grid-cell` — Insert wizard modal

---

## Design Principles

1. **Markdown is sacred** — plugin generates/parses GFM, never modifies user text unexpectedly
2. **AST is ephemeral** — WYSIWYG is a decoration layer, raw markdown is the source of truth
3. **Composition** — table parser reused by WYSIWYG, CSV export, and cursor detection
4. **Safe lifecycle** — all registrations cleaned up on deactivate
