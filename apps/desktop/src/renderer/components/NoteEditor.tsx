import { useRef, useCallback, useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { FileText, MoreVertical, Link2, Hash } from 'lucide-react';
import { LayoutZone } from '@dripnex/plugin-api';
import { toggleNthGfmTask, type MarkdownHeading } from '@dripnex/markdown';
import { getEditorView } from '../hooks/useCommandRegistry';
import type { NoteSnapshot, NoteStatus } from '../../preload/index';
import { useEditorPreferencesStore } from '../stores/editorPreferencesStore';
import {
  useEditorBufferStore,
  selectIsDirty,
  selectContentForNote,
} from '../stores/editorBufferStore';
import { useHeadingJumpStore } from '../stores/headingJumpStore';
import { useShareStore, selectShareInfo } from '../stores/shareStore';
import { findHeadingForAnchor } from '../utils/outlineActive';
import { useScrollSync } from '../hooks/useScrollSync';
import { useManualTags } from '../hooks/useManualTags';
import { useEmbedResolver } from '../hooks/useEmbedResolver';
import { useBacklinks } from '../hooks/useLinks';
import { useResolvedWikilinkTargets } from '../hooks/useResolvedWikilinkTargets';
import { useWikilinkPeek } from '../hooks/useWikilinkPeek';
import { useNotebook } from '../hooks/useNotebooks';
import { isKindTag, normalizeTag, type NoteKind } from '../lib/knowledge';
import { notebookStyleProps } from '../utils/notebookStyle';
import { WikilinkPeek } from './editor/WikilinkPeek';
import type { MarkdownEditorHandle } from './MarkdownEditor';
import type { MarkdownPreviewHandle, ToolbarVisibility } from './editor';
import { ImageLightbox } from './ImageLightbox';
import { BacklinksPanel } from './editor/BacklinksPanel';
import { RevisionHistoryPanel } from './editor/RevisionHistoryPanel';
import {
  ActionsPanel,
  EditorChrome,
  EditorHeader,
  OutlinePanel,
  SelectionToolbar,
  MarkdownPreview,
} from './editor';
import { TitleInput } from './TitleInput';
import { useToast } from './Toast';
import { sc } from './noteEditorSc';

// Lazy load the markdown editor for better initial load performance
const MarkdownEditor = lazy(() =>
  import('./MarkdownEditor').then(mod => ({ default: mod.MarkdownEditor }))
);

/** Loading spinner for editor */
function EditorLoading() {
  return (
    <div className={sc('note-editor-loading')} aria-label="Loading editor">
      <div className={sc('editor-spinner')} />
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
  onUseTemplate?: () => void;
  onDelete?: () => void;
  onRestoreDeleted?: () => void;
  onPermanentDelete?: () => void;
  onPin?: () => void;
  onWikilinkClick?: (target: string, anchor?: string) => void;
  onNavigateToNote?: (noteId: string) => void;
  /** Called when note is updated (e.g., tags changed) */
  onNoteUpdate?: (note: NoteSnapshot) => void;
  canBack?: boolean;
  canForward?: boolean;
  distractionFree?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  onToggleZen?: () => void;
  onOpenWindow?: () => void;
  chromeVariant?: 'main' | 'window';
}

export function NoteEditor({
  note,
  onUpdate,
  onTitleUpdate,
  onMoveToNotebook,
  onStatusChange,
  onDuplicate,
  onUseTemplate,
  onDelete,
  onRestoreDeleted,
  onPermanentDelete,
  onPin,
  onWikilinkClick,
  onNavigateToNote,
  onNoteUpdate,
  canBack = false,
  canForward = false,
  distractionFree = false,
  onBack,
  onForward,
  onToggleZen,
  onOpenWindow,
  chromeVariant = 'main',
}: NoteEditorProps) {
  const { showToast } = useToast();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const toolbarRowRef = useRef<HTMLDivElement | null>(null);

  // View mode from preferences store
  const viewMode = useEditorPreferencesStore(state => state.viewMode);
  const setViewMode = useEditorPreferencesStore(state => state.setViewMode);
  const outlineOpen = useEditorPreferencesStore(state => state.outlineOpen);
  const toggleOutline = useEditorPreferencesStore(state => state.toggleOutline);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Initialize editor buffer when note changes. Flush a dirty buffer first
  // so switching notes (e.g. [[ Create ]]) does not drop the last edit.
  useEffect(() => {
    const id = note?.id;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const buf = useEditorBufferStore.getState();
      if (id && buf.noteId === id && buf.isDirty) {
        onUpdateRef.current(buf.liveContent);
      }
    };
  }, [note?.id]);

  useEffect(() => {
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

  const handleKindChange = useCallback(
    async (kind: NoteKind) => {
      for (const tag of manualTags) {
        if (isKindTag(tag) && normalizeTag(tag) !== kind) {
          await removeTag(tag);
        }
      }
      if (!displayTags.some(tag => normalizeTag(tag) === kind)) {
        await addTag(kind);
      }
    },
    [addTag, displayTags, manualTags, removeTag]
  );

  // Actions panel state
  const [actionsOpen, setActionsOpen] = useState(false);

  // Backlinks panel state
  const [backlinksOpen, setBacklinksOpen] = useState(false);

  // Revision history panel state
  const [revisionHistoryOpen, setRevisionHistoryOpen] = useState(false);
  const { data: backlinks } = useBacklinks(note?.id ?? null);
  const backlinksCount = backlinks?.length ?? 0;
  const { data: notebook } = useNotebook(note?.notebookId ?? null);

  // Share store
  const shareInfo = useShareStore(selectShareInfo(note?.id ?? ''));
  const setShared = useShareStore(s => s.setShared);
  const removeShared = useShareStore(s => s.removeShared);

  // Save indicator state
  const isDirty = useEditorBufferStore(selectIsDirty);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show "Saved" briefly after onUpdate fires (isDirty goes false)
  const prevDirtyRef = useRef(false);
  const trackedNoteIdRef = useRef(note?.id);

  // Reset dirty tracking when switching notes to avoid false "Saved" flash
  useEffect(() => {
    if (trackedNoteIdRef.current !== note?.id) {
      trackedNoteIdRef.current = note?.id;
      prevDirtyRef.current = false;
    }
  }, [note?.id]);

  useEffect(() => {
    // Guard: if note switched, just sync the ref and bail out
    if (trackedNoteIdRef.current !== note?.id) {
      prevDirtyRef.current = isDirty;
      return;
    }
    if (prevDirtyRef.current && !isDirty) {
      // Transitioned from dirty to clean — save completed
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
    }
    prevDirtyRef.current = isDirty;
  }, [isDirty, note?.id]);

  // Cleanup saved timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Derive save status text
  const saveStatus = useMemo(() => {
    if (isDirty) return 'Saving...';
    if (showSaved) return 'Saved';
    return null;
  }, [isDirty, showSaved]);

  // Lightbox state for embedded images
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  // Embed resolution (extracted to hook)
  const liveContent = useEditorBufferStore(selectContentForNote(note?.id ?? null));
  const knownWikilinkTitles = useResolvedWikilinkTargets(liveContent ?? note?.content ?? '');
  const wikilinkPeek = useWikilinkPeek();

  const { resolvedEmbeds, getEmbedUrl } = useEmbedResolver({
    noteId: note?.id ?? null,
    content: liveContent ?? note?.content ?? null,
  });

  const toolbarVisibility: ToolbarVisibility = {
    text: true,
    lists: true,
    blocks: true,
    history: true,
  };

  const showEditor = viewMode === 'editor' || viewMode === 'split';
  const showPreview = viewMode === 'preview' || viewMode === 'split';
  const isSplitMode = viewMode === 'split';

  const [outlineActiveLine, setOutlineActiveLine] = useState<number | null>(null);
  const [outlineActiveText, setOutlineActiveText] = useState<string | null>(null);

  const handleOutlineJump = useCallback(
    (heading: MarkdownHeading) => {
      setOutlineActiveLine(heading.line);
      setOutlineActiveText(heading.text);
      if (showEditor) {
        editorRef.current?.jumpToLine(heading.line);
      } else {
        previewRef.current?.jumpToHeading(heading.text);
      }
    },
    [showEditor]
  );

  const pendingJumpNoteId = useHeadingJumpStore(s => s.noteId);
  const pendingJumpHeading = useHeadingJumpStore(s => s.heading);

  const tryHeadingJump = useCallback(() => {
    if (!note) return;
    const pending = useHeadingJumpStore.getState();
    if (pending.noteId !== note.id || !pending.heading) return;
    const target = showEditor ? editorRef.current : previewRef.current;
    if (!target) return;
    const match = findHeadingForAnchor(note.content, pending.heading);
    useHeadingJumpStore.getState().consume(note.id);
    if (match) handleOutlineJump(match);
  }, [note, showEditor, handleOutlineJump]);

  useEffect(() => {
    tryHeadingJump();
  }, [note?.id, pendingJumpNoteId, pendingJumpHeading, tryHeadingJump]);

  useEffect(() => {
    if (!outlineOpen || !note) return;
    let unsub: (() => void) | undefined;
    let interval: number | undefined;

    const attach = (): boolean => {
      if (showEditor && editorRef.current) {
        const editor = editorRef.current;
        const sync = () => {
          setOutlineActiveLine(editor.getVisibleLine());
          setOutlineActiveText(null);
        };
        unsub = editor.onScroll(sync);
        sync();
        return true;
      }
      if (!showEditor && previewRef.current) {
        const preview = previewRef.current;
        const sync = () => {
          setOutlineActiveLine(null);
          setOutlineActiveText(preview.getVisibleHeading());
        };
        unsub = preview.onScroll(sync);
        sync();
        return true;
      }
      return false;
    };

    if (!attach()) {
      let tries = 0;
      interval = window.setInterval(() => {
        tries += 1;
        if (attach() || tries > 20) {
          if (interval) window.clearInterval(interval);
        }
      }, 50);
    }

    return () => {
      if (interval) window.clearInterval(interval);
      unsub?.();
    };
  }, [outlineOpen, showEditor, note?.id, viewMode]);

  // Scroll sync for split mode (see useScrollSync for architecture docs)
  const { masterRef, handleEditorReady, handlePreviewReady } = useScrollSync({
    isSplitMode,
    editorRef,
    previewRef,
  });

  const onEditorReady = useCallback(() => {
    handleEditorReady();
    tryHeadingJump();
  }, [handleEditorReady, tryHeadingJump]);

  const onPreviewReady = useCallback(() => {
    handlePreviewReady();
    tryHeadingJump();
  }, [handlePreviewReady, tryHeadingJump]);

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

  const handlePreviewCheckbox = useCallback(
    (index: number) => {
      if (!note) return;
      const current =
        useEditorBufferStore.getState().noteId === note.id
          ? useEditorBufferStore.getState().liveContent
          : note.content;
      const next = toggleNthGfmTask(current, index);
      if (next == null || next === current) return;
      const view = getEditorView();
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
        });
        return;
      }
      useEditorBufferStore.getState().updateBuffer(next);
      handleChange(next);
    },
    [note, handleChange]
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
    const result = await window.dripnex.share.create({
      noteId: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      wordCount: note.wordCount,
      notebookName: notebook?.name ?? '',
      backlinks: (backlinks ?? []).map(bl => ({ noteId: bl.noteId, title: bl.noteTitle })),
    });
    if (result.success && result.slug && result.url) {
      setShared(note.id, { slug: result.slug, url: result.url, noteId: note.id });
      showToast('Link copied to clipboard');
    } else {
      showToast(result.error || 'Failed to share note', 'error');
    }
  }, [note, notebook, backlinks, showToast, setShared]);

  // Handle unshare
  const handleUnshare = useCallback(async () => {
    if (!note || !shareInfo) return;
    const result = await window.dripnex.share.delete(shareInfo.slug);
    if (result.success) {
      removeShared(note.id);
      showToast('Note unshared');
    } else {
      showToast(result.error || 'Failed to unshare note', 'error');
    }
  }, [note, shareInfo, removeShared, showToast]);

  // Handle copy share link
  const handleCopyShareLink = useCallback(async () => {
    if (!shareInfo) return;
    try {
      await navigator.clipboard.writeText(shareInfo.url);
      showToast('Share link copied to clipboard');
    } catch {
      showToast('Failed to copy link', 'error');
    }
  }, [shareInfo, showToast]);

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
      <main className={sc('note-editor')} aria-label="Note editor">
        <div className={sc('note-editor-empty')} role="status">
          <span className={sc('empty-icon')} aria-hidden="true">
            <FileText size={48} />
          </span>
          <p className={sc('empty-title')}>Select a note to edit</p>
          <p className={sc('empty-hint')}>Or press ⌘N to create a new one</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`${sc('note-editor')} ${notebookStyleProps(note.notebookId).className}`}
      data-notebook-id={note.notebookId || undefined}
      aria-label="Note editor"
    >
      <EditorChrome
        variant={chromeVariant}
        canBack={canBack}
        canForward={canForward}
        distractionFree={distractionFree}
        viewMode={viewMode}
        onBack={() => onBack?.()}
        onForward={() => onForward?.()}
        onToggleZen={() => onToggleZen?.()}
        onOpenWindow={() => onOpenWindow?.()}
        onModeChange={setViewMode}
        outlineButton={
          <div className={sc('editor-view-toggle')} role="group" aria-label="Outline">
            <button
              type="button"
              className={sc('editor-view-toggle-btn', outlineOpen && 'active')}
              onClick={toggleOutline}
              title="Outline"
              aria-label="Toggle outline"
              aria-pressed={outlineOpen}
            >
              <Hash size={16} />
            </button>
          </div>
        }
        actions={
          <>
            {saveStatus ? (
              <span
                className={sc('save-indicator', showSaved && 'save-indicator--fade')}
                aria-live="polite"
              >
                {saveStatus}
              </span>
            ) : null}
            {onUseTemplate ? (
              <button
                type="button"
                className={sc('note-editor-use-template')}
                onClick={onUseTemplate}
                title="Create a new note from this template"
              >
                Use template
              </button>
            ) : null}
            <button
              type="button"
              className={sc('note-editor-actions-btn', backlinksCount > 0 && 'has-badge')}
              onClick={() => setBacklinksOpen(true)}
              title={`Backlinks${backlinksCount > 0 ? ` (${backlinksCount})` : ''}`}
              aria-label="Open backlinks panel"
            >
              <Link2 size={18} />
              {backlinksCount > 0 && <span className={sc('badge')}>{backlinksCount}</span>}
            </button>
            <button
              type="button"
              className={sc('note-editor-actions-btn')}
              onClick={() => setActionsOpen(true)}
              title="More actions"
              aria-label="Open actions panel"
            >
              <MoreVertical size={18} />
            </button>
            <LayoutZone name="editor-header-actions" />
          </>
        }
      />
      <header className={sc('note-editor-header')}>
        <TitleInput value={note.title} onChange={handleTitleChange} onEnter={handleTitleEnter} />
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
          onKindChange={kind => void handleKindChange(kind)}
        />
      )}
      <div ref={toolbarRowRef} className={sc('note-editor-toolbar-row')}>
        <LayoutZone name="editor-toolbar" />
      </div>
      <div className={sc('note-editor-workspace')}>
        <div className={sc('note-editor-body', `note-editor-body--${viewMode}`)}>
          {showEditor && (
            <div
              className={sc('split-pane', 'split-pane--editor')}
              onMouseEnter={() => {
                masterRef.current = 'editor';
              }}
            >
              <SelectionToolbar />
              <Suspense fallback={<EditorLoading />}>
                <MarkdownEditor
                  ref={editorRef}
                  key={note.id}
                  initialContent={note.content}
                  onChange={handleChange}
                  onReady={onEditorReady}
                  noteId={note.id}
                  notebookId={note.notebookId}
                  getEmbedUrl={getEmbedUrl}
                  onWikilinkClick={onWikilinkClick}
                  onWikilinkHover={(target, coords) =>
                    wikilinkPeek.request(target, coords.x, coords.y)
                  }
                  onWikilinkHoverEnd={wikilinkPeek.leave}
                  knownWikilinkTitles={knownWikilinkTitles}
                />
              </Suspense>
            </div>
          )}
          {showPreview && (
            <div
              className={sc('split-pane', 'split-pane--preview')}
              onMouseEnter={() => {
                masterRef.current = 'preview';
              }}
            >
              <LayoutZone name="preview-toolbar" />
              <MarkdownPreview
                ref={previewRef}
                content={note.content}
                noteId={note.id}
                notebookId={note.notebookId}
                createdAt={note.createdAt}
                updatedAt={note.updatedAt}
                onReady={onPreviewReady}
                onWikilinkClick={onWikilinkClick}
                onWikilinkHover={(target, coords) =>
                  wikilinkPeek.request(target, coords.x, coords.y)
                }
                onWikilinkHoverEnd={wikilinkPeek.leave}
                knownWikilinkTitles={knownWikilinkTitles}
                onEmbedClick={(target, url) => setLightbox({ src: url, alt: target })}
                resolvedEmbeds={resolvedEmbeds}
                onCheckboxToggle={handlePreviewCheckbox}
              />
            </div>
          )}
        </div>
        {outlineOpen ? (
          <OutlinePanel
            content={liveContent ?? note.content}
            onJump={handleOutlineJump}
            activeLine={outlineActiveLine}
            activeText={outlineActiveText}
          />
        ) : null}
      </div>

      <LayoutZone name="editor-footer" />

      {/* Plugin Status Bar */}
      <LayoutZone name="editor-status-bar" className={sc('note-editor-status-bar')} />

      {/* Plugin Panels */}
      <LayoutZone name="panel" />

      {/* Actions Panel */}
      <ActionsPanel
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        noteId={note.id}
        noteTitle={note.title}
        isPinned={note.isPinned}
        isDeleted={note.isDeleted}
        onPin={onPin}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onRestoreDeleted={onRestoreDeleted}
        onPermanentDelete={onPermanentDelete}
        onRevisionHistory={note.notebookId ? () => setRevisionHistoryOpen(true) : undefined}
        onShareOnWeb={handleShareOnWeb}
        shareInfo={shareInfo}
        onUnshare={handleUnshare}
        onCopyShareLink={handleCopyShareLink}
        hiddenFormatting={toolbarVisibility}
        heading={outlineActiveText}
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

      {wikilinkPeek.peek ? (
        <WikilinkPeek
          target={wikilinkPeek.peek.target}
          x={wikilinkPeek.peek.x}
          y={wikilinkPeek.peek.y}
          onOpen={title => {
            onWikilinkClick?.(title);
            wikilinkPeek.close();
          }}
          onHold={wikilinkPeek.hold}
          onLeave={wikilinkPeek.leave}
        />
      ) : null}

      {/* Image Lightbox */}
      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}

      {/* Plugin Modals */}
      <LayoutZone name="modal" />
    </main>
  );
}
