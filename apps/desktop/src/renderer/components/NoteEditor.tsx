import { useRef, useCallback, lazy, Suspense } from 'react';
import { FileText } from 'lucide-react';
import { TitleInput } from './TitleInput';
import { EditorHeader, EditorViewToggle, FormattingToolbar, MarkdownPreview } from './editor';
import type { MarkdownPreviewHandle } from './editor';
import type { MarkdownEditorHandle } from './MarkdownEditor';
import type { NoteSnapshot, NoteStatus } from '../../preload/index';
import { useEditorPreferencesStore } from '../stores/editorPreferencesStore';
import { useScrollSync } from '../hooks/useScrollSync';

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
  onTitleUpdate?: (title: string) => void;
  onMoveToNotebook?: (notebookId: string) => void;
  onStatusChange?: (status: NoteStatus) => void;
}

export function NoteEditor({
  note,
  onUpdate,
  onTitleUpdate,
  onMoveToNotebook,
  onStatusChange,
}: NoteEditorProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);

  // View mode from preferences store
  const viewMode = useEditorPreferencesStore(state => state.viewMode);
  const setViewMode = useEditorPreferencesStore(state => state.setViewMode);

  const showEditor = viewMode === 'editor' || viewMode === 'split';
  const showPreview = viewMode === 'preview' || viewMode === 'split';
  const isSplitMode = viewMode === 'split';

  // Scroll sync for split mode (see useScrollSync for architecture docs)
  const { masterRef, handleEditorReady, handlePreviewReady } = useScrollSync({
    isSplitMode,
    editorRef,
    previewRef,
  });

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

  // Handle title change
  const handleTitleChange = useCallback(
    (title: string) => {
      onTitleUpdate?.(title);
    },
    [onTitleUpdate]
  );

  // Focus editor when Enter is pressed in title
  const handleTitleEnter = useCallback(() => {
    editorRef.current?.focus();
  }, []);

  if (!note) {
    return (
      <main className="note-editor" aria-label="Note editor">
        <div className="note-editor-empty" role="status">
          <span className="empty-icon" aria-hidden="true">
            <FileText size={48} />
          </span>
          <p className="empty-title">Select a note to edit</p>
          <p className="empty-hint">Or press ⌘N to create a new one</p>
        </div>
      </main>
    );
  }

  return (
    <main className="note-editor" aria-label="Note editor">
      {onMoveToNotebook && onStatusChange && (
        <EditorHeader
          note={note}
          onMoveToNotebook={onMoveToNotebook}
          onStatusChange={onStatusChange}
        />
      )}
      <header className="note-editor-header">
        <TitleInput
          value={note.title}
          onChange={handleTitleChange}
          onEnter={handleTitleEnter}
        />
        <span className="note-editor-meta" aria-label={`${note.wordCount} words`}>
          {note.wordCount} words
        </span>
      </header>
      <div className="note-editor-toolbar-row">
        <FormattingToolbar editorRef={editorRef} />
        <EditorViewToggle mode={viewMode} onModeChange={setViewMode} />
      </div>
      <div className={`note-editor-body note-editor-body--${viewMode}`}>
        {showEditor && (
          <div
            className="split-pane split-pane--editor"
            onMouseEnter={() => { masterRef.current = 'editor'; }}
          >
            <Suspense fallback={<EditorLoading />}>
              <MarkdownEditor
                ref={editorRef}
                key={note.id}
                initialContent={note.content}
                onChange={handleChange}
                onReady={handleEditorReady}
              />
            </Suspense>
          </div>
        )}
        {showPreview && (
          <div
            className="split-pane split-pane--preview"
            onMouseEnter={() => { masterRef.current = 'preview'; }}
          >
            <MarkdownPreview
              ref={previewRef}
              content={note.content}
              createdAt={note.createdAt}
              updatedAt={note.updatedAt}
              onReady={handlePreviewReady}
            />
          </div>
        )}
      </div>
    </main>
  );
}
