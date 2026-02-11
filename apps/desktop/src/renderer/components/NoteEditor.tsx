import { useRef, useCallback, useState, useEffect, lazy, Suspense } from 'react';
import { FileText, MoreVertical, Link2 } from 'lucide-react';
import type { NoteSnapshot, NoteStatus } from '../../preload/index';
import { useEditorPreferencesStore } from '../stores/editorPreferencesStore';
import { useEditorBufferStore } from '../stores/editorBufferStore';
import { useScrollSync } from '../hooks/useScrollSync';
import { useManualTags } from '../hooks/useManualTags';
import { useEmbedResolver } from '../hooks/useEmbedResolver';
import { useBacklinks } from '../hooks/useLinks';
import type { MarkdownEditorHandle } from './MarkdownEditor';
import type { MarkdownPreviewHandle, ToolbarVisibility } from './editor';
import { ImageLightbox } from './ImageLightbox';
import { BacklinksPanel } from './editor/BacklinksPanel';
import { RevisionHistoryPanel } from './editor/RevisionHistoryPanel';
import {
  ActionsPanel,
  EditorHeader,
  EditorViewToggle,
  FormattingToolbar,
  MarkdownPreview,
} from './editor';
import { LayoutZone } from '@readied/plugin-api';
import { TitleInput } from './TitleInput';
import { useToast } from './Toast';

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
  onPin?: () => void;
  onWikilinkClick?: (target: string) => void;
  onNavigateToNote?: (noteId: string) => void;
  /** Called when note is updated (e.g., tags changed) */
  onNoteUpdate?: (note: NoteSnapshot) => void;
}

export function NoteEditor({
  note,
  onUpdate,
  onTitleUpdate,
  onMoveToNotebook,
  onStatusChange,
  onDuplicate,
  onDelete,
  onPin,
  onWikilinkClick,
  onNavigateToNote,
  onNoteUpdate,
}: NoteEditorProps) {
  const { showToast } = useToast();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const toolbarRowRef = useRef<HTMLDivElement | null>(null);

  // View mode from preferences store
  const viewMode = useEditorPreferencesStore(state => state.viewMode);
  const setViewMode = useEditorPreferencesStore(state => state.setViewMode);

  // Initialize editor buffer when note changes
  useEffect(() => {
    // Cancel any pending debounce from previous note to prevent stale mutations
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (note) {
      useEditorBufferStore.getState().setNote(note.id, note.content);
    } else {
      useEditorBufferStore.getState().clear();
    }
  }, [note?.id, note?.content]);

  // Manual tags (extracted to hook)
  const { manualTags, displayTags, addTag, removeTag } = useManualTags({
    noteId: note?.id ?? null,
    inlineTags: note?.tags ?? [],
    onNoteUpdate,
  });

  // Actions panel state
  const [actionsOpen, setActionsOpen] = useState(false);

  // Backlinks panel state
  const [backlinksOpen, setBacklinksOpen] = useState(false);

  // Revision history panel state
  const [revisionHistoryOpen, setRevisionHistoryOpen] = useState(false);
  const { data: backlinks } = useBacklinks(note?.id ?? null);
  const backlinksCount = backlinks?.length ?? 0;

  // Lightbox state for embedded images
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  // Embed resolution (extracted to hook)
  const { resolvedEmbeds, getEmbedUrl } = useEmbedResolver({
    noteId: note?.id ?? null,
    content: note?.content ?? null,
  });

  // Toolbar visibility state (for passing to ActionsPanel)
  const [toolbarVisibility, setToolbarVisibility] = useState<ToolbarVisibility>({
    text: true,
    lists: true,
    blocks: true,
    history: true,
  });

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

  // Cleanup debounce timer on unmount to prevent stale mutations
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Handle share on web
  const handleShareOnWeb = useCallback(async () => {
    if (!note) return;
    const result = await window.readied.share.create({
      noteId: note.id,
      title: note.title,
      content: note.content,
    });
    if (result.success) {
      showToast('Link copied to clipboard');
    } else {
      showToast(result.error || 'Failed to share note', 'error');
    }
  }, [note, showToast]);

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
      {/* Title row with actions buttons */}
      <header className="note-editor-header">
        <TitleInput value={note.title} onChange={handleTitleChange} onEnter={handleTitleEnter} />
        <div className="note-editor-header-actions">
          <button
            type="button"
            className={`note-editor-actions-btn ${backlinksCount > 0 ? 'has-badge' : ''}`}
            onClick={() => setBacklinksOpen(true)}
            title={`Backlinks${backlinksCount > 0 ? ` (${backlinksCount})` : ''}`}
            aria-label="Open backlinks panel"
          >
            <Link2 size={18} />
            {backlinksCount > 0 && <span className="badge">{backlinksCount}</span>}
          </button>
          <button
            type="button"
            className="note-editor-actions-btn"
            onClick={() => setActionsOpen(true)}
            title="More actions"
            aria-label="Open actions panel"
          >
            <MoreVertical size={18} />
          </button>
          <LayoutZone name="editor-header-actions" />
        </div>
      </header>
      {/* Metadata row: Notebook, Status, Tags */}
      {onMoveToNotebook && onStatusChange && (
        <EditorHeader
          note={note}
          tags={displayTags}
          manualTags={manualTags}
          onMoveToNotebook={onMoveToNotebook}
          onStatusChange={onStatusChange}
          onAddTag={addTag}
          onRemoveTag={removeTag}
        />
      )}
      <div ref={toolbarRowRef} className="note-editor-toolbar-row">
        <FormattingToolbar
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
                noteId={note.id}
                getEmbedUrl={getEmbedUrl}
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
              noteId={note.id}
              createdAt={note.createdAt}
              updatedAt={note.updatedAt}
              onReady={handlePreviewReady}
              onWikilinkClick={onWikilinkClick}
              onEmbedClick={(target, url) => setLightbox({ src: url, alt: target })}
              resolvedEmbeds={resolvedEmbeds}
            />
          </div>
        )}

        {/* Floating View Toggle */}
        <div className="floating-view-toggle">
          <EditorViewToggle mode={viewMode} onModeChange={setViewMode} />
        </div>
      </div>

      {/* Plugin Status Bar */}
      <LayoutZone name="editor-status-bar" className="note-editor-status-bar" />

      {/* Plugin Panels */}
      <LayoutZone name="panel" />

      {/* Actions Panel */}
      <ActionsPanel
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        noteId={note.id}
        noteTitle={note.title}
        isPinned={note.isPinned}
        onPin={onPin}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onRevisionHistory={note.notebookId ? () => setRevisionHistoryOpen(true) : undefined}
        onShareOnWeb={handleShareOnWeb}
        hiddenFormatting={toolbarVisibility}
      />

      {/* Backlinks Panel */}
      <BacklinksPanel
        isOpen={backlinksOpen}
        onClose={() => setBacklinksOpen(false)}
        noteId={note.id}
        onNavigateToNote={onNavigateToNote ?? (() => {})}
      />

      {/* Revision History Panel */}
      <RevisionHistoryPanel
        isOpen={revisionHistoryOpen}
        onClose={() => setRevisionHistoryOpen(false)}
        notebookId={note.notebookId}
      />

      {/* Image Lightbox */}
      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </main>
  );
}
