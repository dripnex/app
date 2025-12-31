import { useRef, useCallback, lazy, Suspense } from 'react';
import type { NoteSnapshot } from '../../preload/index';

// Lazy load the markdown editor for better initial load performance
const MarkdownEditor = lazy(() =>
  import('./MarkdownEditor').then(mod => ({ default: mod.MarkdownEditor }))
);

/** Loading spinner for editor */
function EditorLoading() {
  return (
    <div className="note-editor-loading" aria-label="Loading editor">
      <div className="editor-spinner" />
    </div>
  );
}

interface NoteEditorProps {
  note: NoteSnapshot | null;
  onUpdate: (content: string) => void;
}

export function NoteEditor({ note, onUpdate }: NoteEditorProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Handle content change with debounce
  const handleChange = useCallback(
    (content: string) => {
      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce save (500ms)
      debounceRef.current = setTimeout(() => {
        onUpdate(content);
      }, 500);
    },
    [onUpdate]
  );

  if (!note) {
    return (
      <main className="note-editor" aria-label="Note editor">
        <div className="note-editor-empty" role="status">
          <span className="empty-icon" aria-hidden="true">
            📝
          </span>
          <p className="empty-title">Select a note to edit</p>
          <p className="empty-hint">Or press ⌘N to create a new one</p>
        </div>
      </main>
    );
  }

  return (
    <main className="note-editor" aria-label="Note editor">
      <header className="note-editor-header">
        <span className="note-editor-title">{note.title || 'Untitled'}</span>
        <span className="note-editor-meta" aria-label={`${note.wordCount} words`}>
          {note.wordCount} words
        </span>
      </header>
      <div className="note-editor-body">
        <Suspense fallback={<EditorLoading />}>
          <MarkdownEditor key={note.id} initialContent={note.content} onChange={handleChange} />
        </Suspense>
      </div>
    </main>
  );
}
