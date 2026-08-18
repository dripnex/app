import { useState, useEffect, useCallback } from 'react';
import { GitCommit, Clock, User, ChevronDown, ChevronRight, RotateCcw, Upload } from 'lucide-react';
import { Button, Input } from '../../ui/primitives';
import styles from './CommitHistory.module.css';

interface GitCommitData {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
  };
}

interface CommitHistoryProps {
  notebookId: string;
  notebookName: string;
  onClose: () => void;
}

export function CommitHistory({ notebookId, notebookName, onClose }: CommitHistoryProps) {
  const [commits, setCommits] = useState<GitCommitData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteMessage, setRemoteMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadCommits();
    void window.dripnex.git.remotes?.(notebookId).then(result => {
      const origin = result.remotes?.find(remote => remote.remote === 'origin');
      if (origin) setRemoteUrl(origin.url);
    });
  }, [notebookId]);

  const loadCommits = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.dripnex.git.log(notebookId, 50);
      if (result.success && result.commits) {
        setCommits(result.commits);
      } else {
        setError(result.error ?? 'Failed to load commit history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = useCallback(
    async (commitSha: string, commitMessage: string) => {
      if (
        !confirm(
          `Revert to commit: "${commitMessage}"?\n\nThis will restore all notes to their state at this commit.`
        )
      ) {
        return;
      }

      try {
        const result = await window.dripnex.git.checkout(notebookId, commitSha);
        if (result.success) {
          alert('Successfully reverted to commit!');
          onClose();
        } else {
          alert(`Failed to revert: ${result.error}`);
        }
      } catch (err) {
        alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [notebookId, onClose]
  );

  const saveRemote = useCallback(async () => {
    if (!window.dripnex.git.setRemote) return;
    setRemoteBusy(true);
    setRemoteMessage(null);
    const result = await window.dripnex.git.setRemote(notebookId, remoteUrl);
    setRemoteBusy(false);
    setRemoteMessage(
      result.success ? `Remote set to ${result.remote}` : (result.error ?? 'Failed')
    );
    if (result.success && result.remote) setRemoteUrl(result.remote);
  }, [notebookId, remoteUrl]);

  const pushRemote = useCallback(async () => {
    if (!window.dripnex.git.push) return;
    setRemoteBusy(true);
    setRemoteMessage(null);
    const result = await window.dripnex.git.push(notebookId);
    setRemoteBusy(false);
    setRemoteMessage(result.success ? 'Pushed to origin' : (result.error ?? 'Push failed'));
  }, [notebookId]);

  const toggleCommit = useCallback((oid: string) => {
    setExpandedCommit(prev => (prev === oid ? null : oid));
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const then = timestamp * 1000;
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(timestamp);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <GitCommit size={20} />
            <div>
              <h2 className={styles.title}>Commit History</h2>
              <p className={styles.subtitle}>{notebookName}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.remoteBar}>
          <Input
            size="sm"
            value={remoteUrl}
            onChange={event => setRemoteUrl(event.target.value)}
            placeholder="https://github.com/you/notes"
            aria-label="GitHub remote"
          />
          <Button
            variant="secondary"
            size="sm"
            loading={remoteBusy}
            onClick={() => void saveRemote()}
          >
            Set remote
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Upload size={13} />}
            loading={remoteBusy}
            onClick={() => void pushRemote()}
          >
            Push
          </Button>
        </div>
        {remoteMessage ? <p className={styles.remoteMsg}>{remoteMessage}</p> : null}

        <div className={styles.body}>
          {isLoading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Loading commits...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={loadCommits}>Retry</button>
            </div>
          )}

          {!isLoading && !error && commits.length === 0 && (
            <div className={styles.empty}>
              <GitCommit size={48} />
              <p>No commits yet</p>
              <span>Changes will appear here once you enable auto-commit or manually commit</span>
            </div>
          )}

          {!isLoading && !error && commits.length > 0 && (
            <div className={styles.commitList}>
              {commits.map(commit => {
                const isExpanded = expandedCommit === commit.oid;
                return (
                  <div key={commit.oid} className={styles.commitItem}>
                    <div className={styles.commitHeader} onClick={() => toggleCommit(commit.oid)}>
                      <button
                        className={styles.expandBtn}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <div className={styles.commitMain}>
                        <p className={styles.commitMessage}>{commit.message}</p>
                        <div className={styles.commitMeta}>
                          <span className={styles.commitAuthor}>
                            <User size={12} />
                            {commit.author.name}
                          </span>
                          <span className={styles.commitTime}>
                            <Clock size={12} />
                            {formatRelativeTime(commit.author.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={styles.commitDetails}>
                        <div className={styles.commitInfo}>
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Commit:</span>
                            <code className={styles.commitSha}>{commit.oid.substring(0, 8)}</code>
                          </div>
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Author:</span>
                            <span>
                              {commit.author.name} &lt;{commit.author.email}&gt;
                            </span>
                          </div>
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Date:</span>
                            <span>{formatDate(commit.author.timestamp)}</span>
                          </div>
                        </div>
                        <div className={styles.commitActions}>
                          <button
                            className={styles.revertBtn}
                            onClick={() => handleCheckout(commit.oid, commit.message)}
                          >
                            <RotateCcw size={14} />
                            Revert to this commit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
