import { useRef, useCallback, useState, useEffect, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, MoreVertical } from 'lucide-react';
import { TitleInput } from './TitleInput';
import {
  ActionsPanel,
  EditorHeader,
  EditorViewToggle,
  FormattingToolbar,
  MarkdownPreview,
} from './editor';
import type { MarkdownPreviewHandle, ToolbarVisibility } from './editor';
import type { MarkdownEditorHandle } from './MarkdownEditor';
import type { NoteSnapshot, NoteStatus } from '../../preload/index';
import { useEditorPreferencesStore } from '../stores/editorPreferencesStore';
import { useScrollSync } from '../hooks/useScrollSync';
import { noteKeys } from '../hooks/useNotes';

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
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function NoteEditor({
  note,
  onUpdate,
  onTitleUpdate,
  onMoveToNotebook,
  onStatusChange,
  onDuplicate,
  onDelete,
}: NoteEditorProps) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const toolbarRowRef = useRef<HTMLDivElement | null>(null);

  // View mode from preferences store
  const viewMode = useEditorPreferencesStore(state => state.viewMode);
  const setViewMode = useEditorPreferencesStore(state => state.setViewMode);

  // Manual tags state (fetched separately, not in NoteSnapshot)
  const [manualTags, setManualTags] = useState<string[]>([]);

  // Actions panel state
  const [actionsOpen, setActionsOpen] = useState(false);

  // Toolbar visibility state (for passing to ActionsPanel)
  const [toolbarVisibility, setToolbarVisibility] = useState<ToolbarVisibility>({
    text: true,
    lists: true,
    blocks: true,
    history: true,
  });

  // Merge note.tags with manualTags for display (deduplicated)
  const displayTags = note ? [...new Set([...note.tags, ...manualTags])].sort() : [];

  // Fetch manual tags when note changes
  useEffect(() => {
    if (!note) {
      setManualTags([]);
      return;
    }

    const noteId = note.id;
    let cancelled = false;
    async function loadManualTags() {
      try {
        const tags = await window.readied.notes.getManualTags(noteId);
        if (!cancelled) {
          setManualTags(tags);
        }
      } catch (error) {
        console.error('Failed to load manual tags:', error);
        if (!cancelled) {
          setManualTags([]);
        }
      }
    }
    loadManualTags();

    return () => {
      cancelled = true;
    };
  }, [note?.id]);

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

  // Handle adding a manual tag
  const handleAddTag = useCallback(
    async (tag: string) => {
      if (!note) return;
      const normalized = tag.trim().toLowerCase().replace(/^#/, '');
      if (!normalized || manualTags.includes(normalized)) return;

      const updatedTags = [...manualTags, normalized];
      setManualTags(updatedTags);

      try {
        await window.readied.notes.setManualTags(note.id, updatedTags);
        // Invalidate tags query so sidebar updates
        queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
        // Invalidate notes list so NoteList updates immediately
        queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      } catch (error) {
        console.error('Failed to save manual tags:', error);
        // Revert on error
        setManualTags(manualTags);
      }
    },
    [note, manualTags, queryClient]
  );

  // Handle removing a manual tag
  const handleRemoveTag = useCallback(
    async (tag: string) => {
      if (!note) return;

      const updatedTags = manualTags.filter(t => t !== tag);
      setManualTags(updatedTags);

      try {
        await window.readied.notes.setManualTags(note.id, updatedTags);
        // Invalidate tags query so sidebar updates
        queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
        // Invalidate notes list so NoteList updates immediately
        queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      } catch (error) {
        console.error('Failed to save manual tags:', error);
        // Revert on error
        setManualTags(manualTags);
      }
    },
    [note, manualTags, queryClient]
  );

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
      {/* Title row with actions button */}
      <header className="note-editor-header">
        <TitleInput value={note.title} onChange={handleTitleChange} onEnter={handleTitleEnter} />
        <button
          type="button"
          className="note-editor-actions-btn"
          onClick={() => setActionsOpen(true)}
          title="More actions"
          aria-label="Open actions panel"
        >
          <MoreVertical size={18} />
        </button>
      </header>
      {/* Metadata row: Notebook, Status, Tags */}
      {onMoveToNotebook && onStatusChange && (
        <EditorHeader
          note={note}
          tags={displayTags}
          manualTags={manualTags}
          onMoveToNotebook={onMoveToNotebook}
          onStatusChange={onStatusChange}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
      )}
      <div ref={toolbarRowRef} className="note-editor-toolbar-row">
        <FormattingToolbar
          editorRef={editorRef}
          onVisibilityChange={setToolbarVisibility}
          containerRef={toolbarRowRef}
        />
      </div>
      <div className={`note-editor-body note-editor-body--${viewMode}`}>
        {showEditor && (
          <div
            className="split-pane split-pane--editor"
            onMouseEnter={() => {
              masterRef.current = 'editor';
            }}
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
            onMouseEnter={() => {
              masterRef.current = 'preview';
            }}
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

        {/* Floating View Toggle */}
        <div className="floating-view-toggle">
          <EditorViewToggle mode={viewMode} onModeChange={setViewMode} />
        </div>
      </div>

      {/* Actions Panel */}
      <ActionsPanel
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        noteId={note.id}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        hiddenFormatting={toolbarVisibility}
        editorRef={editorRef}
      />
    </main>
  );
}
