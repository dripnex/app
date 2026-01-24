/**
 * Sync Status Indicator
 *
 * Shows sync status in the sidebar/toolbar.
 * Clicking opens sync settings or triggers manual sync.
 */

import { useSyncStore, selectSyncStatus, selectPendingChanges } from '../../stores/syncStore';
import styles from './SyncStatusIndicator.module.css';

export function SyncStatusIndicator() {
  const syncStatus = useSyncStore(selectSyncStatus);
  const pendingChanges = useSyncStore(selectPendingChanges);
  const { openLoginModal, canSync } = useSyncStore();

  const handleClick = async () => {
    if (syncStatus.status === 'disabled') {
      openLoginModal();
      return;
    }

    if (canSync()) {
      // Trigger sync via IPC
      await window.readied.sync?.triggerSync();
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus.status) {
      case 'disabled':
        return (
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path
              fill="currentColor"
              d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"
            />
            <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
          </svg>
        );
      case 'idle':
        return (
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path
              fill="currentColor"
              d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"
            />
            <path fill="currentColor" d="M10 16l6-4-6-4z" />
          </svg>
        );
      case 'syncing':
        return (
          <svg viewBox="0 0 24 24" className={`${styles.icon} ${styles.spinning}`}>
            <path
              fill="currentColor"
              d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
            />
          </svg>
        );
      case 'error':
        return (
          <svg viewBox="0 0 24 24" className={`${styles.icon} ${styles.error}`}>
            <path
              fill="currentColor"
              d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"
            />
            <text x="12" y="15" fontSize="10" textAnchor="middle" fill="currentColor">
              !
            </text>
          </svg>
        );
      case 'conflict':
        return (
          <svg viewBox="0 0 24 24" className={`${styles.icon} ${styles.warning}`}>
            <path
              fill="currentColor"
              d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
            />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (syncStatus.status) {
      case 'disabled':
        return 'Sync disabled';
      case 'idle':
        return pendingChanges > 0
          ? `${pendingChanges} pending`
          : syncStatus.lastSyncedAt
            ? `Synced ${formatRelativeTime(syncStatus.lastSyncedAt)}`
            : 'Synced';
      case 'syncing':
        return `Syncing ${syncStatus.progress}%`;
      case 'error':
        return syncStatus.message;
      case 'conflict':
        return `${syncStatus.conflicts.length} conflict(s)`;
    }
  };

  return (
    <button
      className={styles.container}
      onClick={handleClick}
      title={getStatusText()}
      aria-label={`Sync status: ${getStatusText()}`}
    >
      {getStatusIcon()}
      {pendingChanges > 0 && syncStatus.status === 'idle' && (
        <span className={styles.badge}>{pendingChanges}</span>
      )}
    </button>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
