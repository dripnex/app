# Editor

Readied uses CodeMirror 6 for markdown editing.

## Why CodeMirror 6?

| Feature    | Benefit                    |
| ---------- | -------------------------- |
| Modular    | Only include what we need  |
| Performant | Handles large documents    |
| Extensible | Custom extensions possible |
| Modern     | Built with TypeScript      |
| Active     | Well maintained            |

## Integration

```typescript
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

const view = new EditorView({
  doc: initialContent,
  extensions: [
    basicSetup,
    markdown({ codeLanguages: languages }),
    // Custom extensions...
  ],
  parent: containerElement,
});
```

## Key Extensions

- `@codemirror/lang-markdown` - Markdown syntax
- `@codemirror/language-data` - Code block highlighting
- `@codemirror/commands` - Keyboard commands
- Custom theme (matches app design tokens)

## Editor <-> Note Sync

1. User types in editor
2. Content saved on debounced change
3. Note updated via IPC
4. Sidebar reflects new metadata

```typescript
// Debounced save
const saveNote = useDebouncedCallback((content: string) => {
  window.readied.notes.update({ id: noteId, content });
}, 500);
```

## Styling

Editor styles are isolated from the main UI:

```css
/* Editor-specific styles */
.cm-editor {
  height: 100%;
  font-family: 'JetBrains Mono', monospace;
}

.cm-content {
  padding: 1rem;
}
```

## Plugin Extensions

Plugins can register custom CodeMirror extensions that are injected into the editor. This enables plugins to extend the editor without modifying core code.

```typescript
// In a plugin's activate()
context.registerEditorExtension(myExtension);
```

Plugin extensions are collected and merged into the editor's extension array. When a plugin is enabled or disabled, the editor reconfigures itself with the updated set of extensions.

### What Plugins Can Add

- **Keybindings** - Custom keyboard shortcuts
- **Syntax extensions** - Additional highlighting or parsing rules
- **Widgets** - Inline or block-level UI elements within the editor
- **Decorations** - Line highlights, markers, and visual annotations

## Decoration API

The editor supports decorations for visual enhancements:

- **Line decorations** - Highlight entire lines (e.g., active line highlight)
- **Mark decorations** - Style ranges of text inline
- **Widget decorations** - Insert arbitrary DOM elements at positions
- **Replace decorations** - Replace text ranges with widgets

The built-in active line highlight plugin uses line decorations to visually distinguish the current cursor line.

## Wikilink Support

The `@readied/wikilinks` package integrates with the editor to provide:

- **Autocomplete** - Typing `[[` triggers a completion popup with matching note titles
- **Navigation** - Clicking or activating a `[[wikilink]]` navigates to the linked note
- **Syntax highlighting** - Wikilink syntax is highlighted distinctly in the editor

Wikilinks are parsed in real-time as the user types, and the link targets are resolved against the current note database.

## Embed Resolution

The `@readied/embeds` package resolves URLs in the editor preview:

- Recognized URLs (YouTube, images, etc.) are rendered as rich embeds
- Embed resolution happens during preview rendering, not in the editor itself
- The editor displays the raw URL; the preview shows the resolved embed

## Active Line Highlight

A built-in plugin highlights the line where the cursor is positioned. This uses CodeMirror's decoration system to apply a subtle background color to the active line, improving focus during editing.
