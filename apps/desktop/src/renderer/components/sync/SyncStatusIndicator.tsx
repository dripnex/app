/**
 * Sync Status Indicator
 *
 * Shows sync status in main UI (syncing, error, offline, etc.)
 * Uses CSS module classes with design token variables instead of inline colors.
 */

import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, AlertTriangle } from 'lucide';
import { Icon } from '../../ui/icons/Icon';
import {
  useSyncStore,
  selectStatus,
  selectLastSyncAt,
  selectHasConflicts,
  selectConflicts,
} from '../../stores/syncStore';
import { useAuthStore } from '../../stores/authStore';
import styles from './SyncStatusIndicator.module.css';

export function SyncStatusIndicator() {
  const status = useSyncStore(selectStatus);
  const lastSyncAt = useSyncStore(selectLastSyncAt);
  const hasConflicts = useSyncStore(selectHasConflicts);
  const conflicts = useSyncStore(selectConflicts);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const openConflictScreen = useSyncStore(state => state.openConflictScreen);
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusInfo = () => {
    if (!isAuthenticated) {
      return {
        icon: <Icon icon={CloudOff} size={14} />,
        label: 'Not signed in',
        className: styles.statusMuted,
      };
    }

    // Conflicts take priority over idle state
    if (hasConflicts && status !== 'syncing') {
      return {
        icon: <Icon icon={AlertTriangle} size={14} />,
        label: `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} — Review`,
        className: styles.statusWarning,
      };
    }

    switch (status) {
      case 'syncing':
        return {
          icon: <Icon icon={RefreshCw} size={14} className={styles.spinning} />,
          label: 'Syncing...',
          className: styles.statusSyncing,
        };
      case 'idle':
        return {
          icon: <Icon icon={CheckCircle} size={14} />,
          label: lastSyncAt ? `Synced ${formatRelativeTime(lastSyncAt)}` : 'Ready to sync',
          className: styles.statusSuccess,
        };
      case 'error':
        return {
          icon: <Icon icon={AlertCircle} size={14} />,
          label: 'Sync failed',
          className: styles.statusError,
        };
      case 'offline':
        return {
          icon: <Icon icon={CloudOff} size={14} />,
          label: 'Offline',
          className: styles.statusMuted,
        };
      default:
        return {
          icon: <Icon icon={Cloud} size={14} />,
          label: 'Unknown',
          className: styles.statusMuted,
        };
    }
  };

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const { icon, label, className } = getStatusInfo();

  return (
    <div
      className={`${styles.container} ${className}`}
      role={hasConflicts ? 'button' : undefined}
      tabIndex={hasConflicts ? 0 : undefined}
      aria-label={hasConflicts ? label : undefined}
      onClick={() => {
        if (hasConflicts) openConflictScreen();
      }}
      onKeyDown={event => {
        if (!hasConflicts) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openConflictScreen();
        }
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={styles.icon}>{icon}</div>
      {showTooltip && <div className={styles.tooltip}>{label}</div>}
    </div>
  );
}
