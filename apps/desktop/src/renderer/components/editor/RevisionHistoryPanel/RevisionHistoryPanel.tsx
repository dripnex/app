/**
 * RevisionHistoryPanel - Timeline-based revision history for the current note's notebook
 *
 * Displays a slide-in panel from the right with a vertical timeline of commits,
 * inspired by Inkdrop v5.10. Each revision appears as a node on a vertical line
 * with timestamp, message preview, and action buttons.
 */

import { memo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, History, GitCommitHorizontal, AlertCircle, RotateCcw, Copy, Check } from 'lucide-react';
import styles from './RevisionHistoryPanel.module.css';

interface GitCommit {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
}

interface GitDiff {
  file: string;
  changes: string;
}

interface RevisionHistoryPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly notebookId: string | null;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Estimate word count from a commit message (heuristic) */
function estimateWordDelta(message: string): {
  label: string;
  kind: 'positive' | 'negative' | 'neutral';
} {
  const lower = message.toLowerCase();
  if (lower.startsWith('update note:') || lower.startsWith('rename note:')) {
    return { label: 'edited', kind: 'neutral' };
  }
  if (lower.includes('delete') || lower.includes('remove')) {
    return { label: 'removed', kind: 'negative' };
  }
  if (lower.includes('create') || lower.includes('add') || lower.includes('new')) {
    return { label: 'added', kind: 'positive' };
  }
  return { label: 'changed', kind: 'neutral' };
}

export const RevisionHistoryPanel = memo(function RevisionHistoryPanel({
  isOpen,
  onClose,
  notebookId,
}: RevisionHistoryPanelProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<GitDiff[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load commits when panel opens
  useEffect(() => {
    if (!isOpen || !notebookId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedCommit(null);
    setDiffs([]);

    void window.dripnex.git.log(notebookId, 50).then(result => {
      if (cancelled) return;
      setLoading(false);
      if (result.success && result.commits) {
        setCommits(result.commits);
      } else {
        setError(result.error || 'Failed to load history');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, notebookId]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedCommit) {
          setSelectedCommit(null);
          setDiffs([]);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedCommit]);

  // Set data-overlay-open for blur policy
  useEffect(() => {
    document.documentElement.dataset.overlayOpen = isOpen ? 'true' : 'false';
    return () => {
      document.documentElement.dataset.overlayOpen = 'false';
    };
  }, [isOpen]);

  // View diff for a commit
  const handleSelectCommit = useCallback(
    async (oid: string) => {
      if (!notebookId) return;
      setSelectedCommit(oid);
      setDiffLoading(true);
      setCopied(false);

      const idx = commits.findIndex(c => c.oid === oid);
      const parentCommit = idx < commits.length - 1 ? commits[idx + 1] : undefined;
      const parentOid = parentCommit?.oid;

      try {
        const commit = commits[idx];
        setDiffs([
          {
            file: 'Commit Details',
            changes: [
              commit?.message || 'Unknown',
              '',
              `SHA: ${oid.slice(0, 8)}`,
              `Author: ${commit?.author.name || 'Unknown'}`,
              `Date: ${commit ? new Date(commit.author.timestamp * 1000).toLocaleString() : ''}`,
              parentOid ? `Parent: ${parentOid.slice(0, 8)}` : '(Initial commit)',
            ].join('\n'),
          },
        ]);
      } catch {
        setDiffs([{ file: 'Error', changes: 'Failed to load diff' }]);
      }

      setDiffLoading(false);
    },
    [notebookId, commits]
  );

  // Restore a commit
  const handleRestore = useCallback(
    async (oid: string) => {
      if (!notebookId) return;
      try {
        const result = await window.dripnex.git.checkout(notebookId, oid);
        if (result.success) {
          onClose();
        }
      } catch {
        // Restore failed silently
      }
    },
    [notebookId, onClose]
  );

  // Copy commit details to clipboard
  const handleCopyDetails = useCallback(() => {
    if (diffs.length === 0) return;
    const text = diffs.map(d => d.changes).join('\n\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [diffs]);

  // Get selected commit object
  const selectedCommitObj = selectedCommit ? commits.find(c => c.oid === selectedCommit) : null;

  // Render timeline content
  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <span className={styles.emptyText}>Loading history...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.emptyState}>
          <AlertCircle size={24} className={styles.emptyIcon} />
          <span className={styles.emptyText}>{error}</span>
          <span className={styles.emptyHint}>
            Git must be enabled for this notebook to view revision history.
          </span>
        </div>
      );
    }

    if (commits.length === 0) {
      return (
        <div className={styles.emptyState}>
          <History size={24} className={styles.emptyIcon} />
          <span className={styles.emptyText}>No revisions yet</span>
          <span className={styles.emptyHint}>
            Commits will appear here as you edit notes in this notebook.
          </span>
        </div>
      );
    }

    return (
      <div className={styles.timeline}>
        {commits.map((commit, idx) => {
          const isActive = selectedCommit === commit.oid;
          const isLast = idx === commits.length - 1;
          const delta = estimateWordDelta(commit.message);

          return (
            <div
              key={commit.oid}
              className={`${styles.timelineNode} ${isLast ? styles.timelineNodeLast : ''}`}
              onClick={() => handleSelectCommit(commit.oid)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleSelectCommit(commit.oid);
                }
              }}
            >
              {/* Track: dot + connecting line */}
              <div className={styles.timelineTrack}>
                <div className={isActive ? styles.timelineDotActive : styles.timelineDot} />
                {!isLast && <div className={styles.timelineLine} />}
              </div>

              {/* Content */}
              <div className={isActive ? styles.timelineContentActive : styles.timelineContent}>
                <div className={styles.timelineTimestamp}>
                  {formatTimestamp(commit.author.timestamp)}
                </div>
                <div className={styles.timelineMessage}>{commit.message}</div>
                <div className={styles.timelineMeta}>
                  <GitCommitHorizontal size={11} />
                  <span className={styles.commitSha}>{commit.oid.slice(0, 7)}</span>
                  <span
                    className={`${styles.wordDelta} ${
                      delta.kind === 'positive'
                        ? styles.wordDeltaPositive
                        : delta.kind === 'negative'
                          ? styles.wordDeltaNegative
                          : styles.wordDeltaNeutral
                    }`}
                  >
                    {delta.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return createPortal(
    <>
      <div
        className={isOpen ? styles.backdropOpen : styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={isOpen ? styles.panelOpen : styles.panel}
        role="dialog"
        aria-label="Revision History"
        aria-modal="true"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>
            <History size={16} />
            Revision History
            {commits.length > 0 && <span className={styles.count}>{commits.length}</span>}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close revision history"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.content}>{renderContent()}</div>

        {/* Detail pane - shown when a commit is selected */}
        {selectedCommit && selectedCommitObj && (
          <div className={styles.detailPane}>
            <div className={styles.detailHeader}>
              <span className={styles.detailTitle}>Details</span>
              <button
                type="button"
                className={styles.detailCloseBtn}
                onClick={() => {
                  setSelectedCommit(null);
                  setDiffs([]);
                }}
              >
                Close
              </button>
            </div>

            {diffLoading ? (
              <div className={styles.emptyState}>
                <div className={styles.spinner} />
              </div>
            ) : (
              <>
                <div className={styles.detailInfo}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>SHA</span>
                    <span className={styles.detailValue}>{selectedCommit.slice(0, 8)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Author</span>
                    <span>{selectedCommitObj.author.name}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Date</span>
                    <span>{formatFullDate(selectedCommitObj.author.timestamp)}</span>
                  </div>
                </div>

                {/* Diff content */}
                {diffs.map((diff, i) => (
                  <div key={i} className={styles.diffContent}>
                    {diff.changes.split('\n').map((line, j) => {
                      if (line.startsWith('+ ')) {
                        return (
                          <div key={j} className={styles.diffAdd}>
                            {line}
                          </div>
                        );
                      }
                      if (line.startsWith('- ')) {
                        return (
                          <div key={j} className={styles.diffRemove}>
                            {line}
                          </div>
                        );
                      }
                      return <div key={j}>{line}</div>;
                    })}
                  </div>
                ))}

                {/* Actions */}
                <div className={styles.detailActions}>
                  <button
                    type="button"
                    className={styles.actionBtnPrimary}
                    onClick={() => handleRestore(selectedCommit)}
                  >
                    <RotateCcw size={13} />
                    Restore this version
                  </button>
                  <button type="button" className={styles.actionBtn} onClick={handleCopyDetails}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy content'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </>,
    document.body
  );
});
