import { memo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Link2,
  Pin,
  PinOff,
  Trash2,
  History,
  Share2,
  ExternalLink,
  // Formatting icons for overflow
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  FileCode,
  Minus,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { ToolbarVisibility } from '../FormattingToolbar';
import type { MarkdownEditorHandle } from '../../MarkdownEditor';
import styles from './ActionsPanel.module.css';

interface ActionsPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly noteId: string;
  readonly noteTitle?: string;
  readonly isPinned?: boolean;
  readonly onPin?: () => void;
  readonly onDuplicate?: () => void;
  readonly onDelete?: () => void;
  readonly onRevisionHistory?: () => void;
  readonly onShareOnWeb?: () => void;
  /** Hidden formatting groups from toolbar overflow */
  readonly hiddenFormatting?: ToolbarVisibility;
  /** Editor ref for formatting actions */
  readonly editorRef?: React.RefObject<MarkdownEditorHandle | null>;
}

/**
 * ActionsPanel - Slide-in panel with note actions
 *
 * Actions:
 * - Duplicate (functional)
 * - Copy Note Link (functional)
 * - Pin to Top / Unpin (functional)
 * - Move to Trash (functional)
 * - Revision History (functional)
 * - Share on Web (coming soon)
 *
 * Also shows hidden toolbar formatting options when overflow is detected.
 */
export const ActionsPanel = memo(function ActionsPanel({
  isOpen,
  onClose,
  noteId,
  noteTitle,
  isPinned,
  onPin,
  onDuplicate,
  onDelete,
  onRevisionHistory,
  onShareOnWeb,
  hiddenFormatting,
  editorRef,
}: ActionsPanelProps) {
  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Set data-overlay-open for blur policy (floating toggle degrades when overlay open)
  useEffect(() => {
    document.documentElement.dataset.overlayOpen = isOpen ? 'true' : 'false';
    return () => {
      document.documentElement.dataset.overlayOpen = 'false';
    };
  }, [isOpen]);

  // Copy note link to clipboard
  const handleCopyLink = useCallback(async () => {
    const noteLink = `readied://note/${noteId}`;
    try {
      await navigator.clipboard.writeText(noteLink);
      onClose();
    } catch (error) {
      console.error('Failed to copy note link:', error);
    }
  }, [noteId, onClose]);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    onDuplicate?.();
    onClose();
  }, [onDuplicate, onClose]);

  // Handle pin toggle
  const handlePin = useCallback(() => {
    onPin?.();
    onClose();
  }, [onPin, onClose]);

  // Handle delete
  const handleDelete = useCallback(() => {
    onDelete?.();
    onClose();
  }, [onDelete, onClose]);

  // Handle revision history
  const handleRevisionHistory = useCallback(() => {
    onRevisionHistory?.();
    onClose();
  }, [onRevisionHistory, onClose]);

  // Handle share on web
  const handleShareOnWeb = useCallback(() => {
    onShareOnWeb?.();
    onClose();
  }, [onShareOnWeb, onClose]);

  // Open note in new window
  const handleOpenInNewWindow = useCallback(async () => {
    await window.readied.windows.openNote(noteId, noteTitle || 'Note');
    onClose();
  }, [noteId, noteTitle, onClose]);

  // Check if any formatting is hidden
  const hasHiddenFormatting =
    hiddenFormatting &&
    (!hiddenFormatting.lists || !hiddenFormatting.blocks || !hiddenFormatting.history);

  // Render via portal to avoid stacking context issues
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={isOpen ? styles.backdropOpen : styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={isOpen ? styles.panelOpen : styles.panel}
        role="dialog"
        aria-label="Note actions"
        aria-modal="true"
      >
        {/* Header */}
        <header className={styles.header}>
          <h2 className={styles.title}>Actions</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close actions panel"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className={styles.content}>
          {/* Hidden Formatting Section - only show when toolbar has overflow */}
          {hasHiddenFormatting && editorRef && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Formatting</div>

              {/* Lists - show when hidden */}
              {hiddenFormatting && !hiddenFormatting.lists && (
                <>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.insertUnorderedList();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <List size={16} />
                    </span>
                    Bullet List
                  </button>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.insertOrderedList();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <ListOrdered size={16} />
                    </span>
                    Numbered List
                  </button>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.insertCheckbox();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <CheckSquare size={16} />
                    </span>
                    Checkbox
                  </button>
                </>
              )}

              {/* Blocks - show when hidden */}
              {hiddenFormatting && !hiddenFormatting.blocks && (
                <>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.insertQuote();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <Quote size={16} />
                    </span>
                    Quote
                  </button>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.insertCodeBlock();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <FileCode size={16} />
                    </span>
                    Code Block
                  </button>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.insertHorizontalRule();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <Minus size={16} />
                    </span>
                    Horizontal Rule
                  </button>
                </>
              )}

              {/* History - show when hidden */}
              {hiddenFormatting && !hiddenFormatting.history && (
                <>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.undo();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <Undo2 size={16} />
                    </span>
                    Undo
                  </button>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      editorRef.current?.redo();
                      onClose();
                    }}
                  >
                    <span className={styles.icon}>
                      <Redo2 size={16} />
                    </span>
                    Redo
                  </button>
                </>
              )}

              <div className={styles.divider} />
            </div>
          )}

          {/* Note Actions Section */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Note</div>

            <button
              type="button"
              className={styles.item}
              onClick={handleDuplicate}
              disabled={!onDuplicate}
            >
              <span className={styles.icon}>
                <Copy size={16} />
              </span>
              Duplicate
            </button>

            <button type="button" className={styles.item} onClick={handleCopyLink}>
              <span className={styles.icon}>
                <Link2 size={16} />
              </span>
              Copy Note Link
            </button>

            <button type="button" className={styles.item} onClick={handlePin} disabled={!onPin}>
              <span className={styles.icon}>
                {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
              </span>
              {isPinned ? 'Unpin' : 'Pin to Top'}
            </button>

            <button type="button" className={styles.item} onClick={handleOpenInNewWindow}>
              <span className={styles.icon}>
                <ExternalLink size={16} />
              </span>
              Open in New Window
            </button>

            <div className={styles.divider} />

            <button
              type="button"
              className={styles.itemDanger}
              onClick={handleDelete}
              disabled={!onDelete}
            >
              <span className={styles.icon}>
                <Trash2 size={16} />
              </span>
              Move to Trash
            </button>
          </div>

          {/* Advanced Section */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Advanced</div>

            <button
              type="button"
              className={styles.item}
              onClick={handleRevisionHistory}
              disabled={!onRevisionHistory}
            >
              <span className={styles.icon}>
                <History size={16} />
              </span>
              Revision History
            </button>

            <button
              type="button"
              className={styles.item}
              onClick={handleShareOnWeb}
              disabled={!onShareOnWeb}
            >
              <span className={styles.icon}>
                <Share2 size={16} />
              </span>
              Share on Web
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
});
