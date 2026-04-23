/**
 * RevisionHistoryPanel - Shows git commit history for the current note's notebook
 *
 * Displays a slide-in panel from the right with commit log.
 * Allows viewing diffs between commits.
 */

import { memo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, History, GitCommitHorizontal, AlertCircle } from 'lucide-react';
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

  // Load commits when panel opens
  useEffect(() => {
    if (!isOpen || !notebookId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedCommit(null);
    setDiffs([]);

    void window.readied.git.log(notebookId, 50).then(result => {
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

      // Find index to get parent commit
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

  // Render content
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
      <>
        <div className={styles.list}>
          {commits.map(commit => (
            <button
              key={commit.oid}
              type="button"
              className={`${styles.item} ${selectedCommit === commit.oid ? styles.itemActive : ''}`}
              onClick={() => handleSelectCommit(commit.oid)}
            >
              <span className={styles.commitMessage}>{commit.message}</span>
              <span className={styles.commitMeta}>
                <GitCommitHorizontal size={12} />
                <span className={styles.commitSha}>{commit.oid.slice(0, 7)}</span>
                <span>{formatTimestamp(commit.author.timestamp)}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Diff view */}
        {selectedCommit && (
          <div className={styles.diffView}>
            <div className={styles.diffHeader}>
              <span className={styles.diffTitle}>Details</span>
              <button
                type="button"
                className={styles.diffCloseBtn}
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
              diffs.map((diff, i) => (
                <div key={i} className={styles.diffFile}>
                  <div className={styles.diffFileName}>{diff.file}</div>
                  <div className={styles.diffContent}>
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
                </div>
              ))
            )}
          </div>
        )}
      </>
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
      </aside>
    </>,
    document.body
  );
});
