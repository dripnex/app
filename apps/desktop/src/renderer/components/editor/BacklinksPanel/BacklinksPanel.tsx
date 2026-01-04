/**
 * BacklinksPanel - Shows notes that link to the current note
 *
 * Part of PKM features (Personal Knowledge Management).
 * Displays a slide-in panel from the right with backlinks.
 */

import { memo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Link2, FileText, AlertCircle } from 'lucide-react';
import { useBacklinks } from '../../../hooks/useLinks';
import styles from './BacklinksPanel.module.css';

interface BacklinksPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly noteId: string | null;
  readonly onNavigateToNote: (noteId: string) => void;
}

/**
 * BacklinksPanel - Slide-in panel showing backlinks
 *
 * Features:
 * - Shows all notes that contain wikilinks to the current note
 * - Click a backlink to navigate to that note
 * - Empty state when no backlinks exist
 */
export const BacklinksPanel = memo(function BacklinksPanel({
  isOpen,
  onClose,
  noteId,
  onNavigateToNote,
}: BacklinksPanelProps) {
  const { data: backlinks, isLoading, error } = useBacklinks(noteId);

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

  // Set data-overlay-open for blur policy
  useEffect(() => {
    document.documentElement.dataset.overlayOpen = isOpen ? 'true' : 'false';
    return () => {
      document.documentElement.dataset.overlayOpen = 'false';
    };
  }, [isOpen]);

  // Handle backlink click
  const handleBacklinkClick = useCallback(
    (backlinkNoteId: string) => {
      onNavigateToNote(backlinkNoteId);
      onClose();
    },
    [onNavigateToNote, onClose]
  );

  // Render content based on state
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <span className={styles.emptyText}>Loading backlinks...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.emptyState}>
          <AlertCircle size={24} className={styles.emptyIcon} />
          <span className={styles.emptyText}>Failed to load backlinks</span>
        </div>
      );
    }

    if (!backlinks || backlinks.length === 0) {
      return (
        <div className={styles.emptyState}>
          <Link2 size={24} className={styles.emptyIcon} />
          <span className={styles.emptyText}>No backlinks yet</span>
          <span className={styles.emptyHint}>
            Notes that link to this note using [[wikilinks]] will appear here.
          </span>
        </div>
      );
    }

    return (
      <div className={styles.list}>
        {backlinks.map(backlink => (
          <button
            key={backlink.noteId}
            type="button"
            className={styles.item}
            onClick={() => handleBacklinkClick(backlink.noteId)}
          >
            <span className={styles.icon}>
              <FileText size={16} />
            </span>
            <span className={styles.itemContent}>
              <span className={styles.itemTitle}>{backlink.noteTitle}</span>
              <span className={styles.itemRef}>[[{backlink.targetRef}]]</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

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
        aria-label="Backlinks"
        aria-modal="true"
      >
        {/* Header */}
        <header className={styles.header}>
          <h2 className={styles.title}>
            <Link2 size={16} />
            Backlinks
            {backlinks && backlinks.length > 0 && (
              <span className={styles.count}>{backlinks.length}</span>
            )}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close backlinks panel"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className={styles.content}>{renderContent()}</div>
      </aside>
    </>,
    document.body
  );
});
