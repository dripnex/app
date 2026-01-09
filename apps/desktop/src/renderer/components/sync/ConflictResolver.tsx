/**
 * Conflict Resolver Component
 *
 * Shows sync conflicts and allows user to choose which version to keep.
 */

import { useState, useCallback } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useSyncStore, selectConflicts } from '../../stores/syncStore';
import styles from './ConflictResolver.module.css';

export function ConflictResolver() {
  const conflicts = useSyncStore(selectConflicts);
  const resolveConflict = useSyncStore(state => state.resolveConflict);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = useCallback(
    async (noteId: string, resolution: 'local' | 'remote') => {
      setIsResolving(true);
      try {
        await resolveConflict(noteId, resolution);
      } catch (error) {
        console.error('Failed to resolve conflict:', error);
      } finally {
        setIsResolving(false);
      }
    },
    [resolveConflict]
  );

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <AlertTriangle size={20} className={styles.warningIcon} />
        <h3 className={styles.title}>
          Sync Conflicts ({conflicts.length})
        </h3>
      </div>

      <p className={styles.description}>
        These notes were modified on multiple devices. Choose which version to keep.
      </p>

      <div className={styles.conflictsList}>
        {conflicts.map(conflict => (
          <div key={conflict.noteId} className={styles.conflict}>
            <button
              type="button"
              className={styles.conflictHeader}
              onClick={() =>
                setExpandedConflict(expandedConflict === conflict.noteId ? null : conflict.noteId)
              }
            >
              <span className={styles.noteId}>Note: {conflict.noteId}</span>
              <span className={styles.timestamp}>
                {new Date(conflict.timestamp).toLocaleString()}
              </span>
            </button>

            {expandedConflict === conflict.noteId && (
              <div className={styles.conflictDetails}>
                <div className={styles.version}>
                  <div className={styles.versionHeader}>
                    <span className={styles.versionLabel}>Local Version</span>
                    <span className={styles.versionNumber}>v{conflict.localVersion}</span>
                  </div>
                  <pre className={styles.content}>{conflict.localContent}</pre>
                  <button
                    type="button"
                    className={styles.keepButton}
                    onClick={() => handleResolve(conflict.noteId, 'local')}
                    disabled={isResolving}
                  >
                    <Check size={16} />
                    Keep Local
                  </button>
                </div>

                <div className={styles.divider}>
                  <X size={16} className={styles.versusIcon} />
                </div>

                <div className={styles.version}>
                  <div className={styles.versionHeader}>
                    <span className={styles.versionLabel}>Remote Version</span>
                    <span className={styles.versionNumber}>v{conflict.remoteVersion}</span>
                  </div>
                  <pre className={styles.content}>{conflict.remoteContent}</pre>
                  <button
                    type="button"
                    className={styles.keepButton}
                    onClick={() => handleResolve(conflict.noteId, 'remote')}
                    disabled={isResolving}
                  >
                    <Check size={16} />
                    Keep Remote
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
