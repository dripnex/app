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
- Custom theme (matches app design)

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
