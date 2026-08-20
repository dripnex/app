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
      return { icon: CloudOff, label: 'Not signed in', className: styles.statusMuted };
    }
    if (hasConflicts && status !== 'syncing') {
      return {
        icon: AlertTriangle,
        label: `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} — Review`,
        className: styles.statusWarning,
      };
    }
    switch (status) {
      case 'syncing':
        return { icon: RefreshCw, label: 'Syncing...', className: styles.statusSyncing };
      case 'idle':
        return {
          icon: CheckCircle,
          label: lastSyncAt ? `Synced ${formatRelativeTime(lastSyncAt)}` : 'Ready to sync',
          className: styles.statusSuccess,
        };
      case 'error':
        return { icon: AlertCircle, label: 'Sync failed', className: styles.statusError };
      case 'offline':
        return { icon: CloudOff, label: 'Offline', className: styles.statusMuted };
      default:
        return { icon: Cloud, label: 'Unknown', className: styles.statusMuted };
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
      <div className={styles.icon}>
        <Icon
          icon={icon}
          size={14}
          className={status === 'syncing' ? styles.spinning : undefined}
        />
      </div>
      {showTooltip && <div className={styles.tooltip}>{label}</div>}
    </div>
  );
}
