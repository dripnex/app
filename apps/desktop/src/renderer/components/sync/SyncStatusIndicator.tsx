/**
 * Sync Status Indicator
 *
 * Shows sync status in main UI (syncing, error, offline, etc.)
 */

import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { useSyncStore, selectStatus, selectLastSyncAt, selectConflicts } from '../../stores/syncStore';
import { useAuthStore } from '../../stores/authStore';
import styles from './SyncStatusIndicator.module.css';

export function SyncStatusIndicator() {
  const status = useSyncStore(selectStatus);
  const lastSyncAt = useSyncStore(selectLastSyncAt);
  const conflicts = useSyncStore(selectConflicts);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [showTooltip, setShowTooltip] = useState(false);

  // Don't show if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const hasConflicts = conflicts.length > 0;

  const getStatusInfo = () => {
    // Conflicts override normal status display
    if (hasConflicts) {
      return {
        icon: <AlertTriangle size={14} />,
        label: `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} — resolve in Settings`,
        color: '#f59e0b',
      };
    }

    switch (status) {
      case 'syncing':
        return {
          icon: <RefreshCw size={14} className={styles.spinning} />,
          label: 'Syncing...',
          color: '#3b82f6',
        };
      case 'idle':
        return {
          icon: <CheckCircle size={14} />,
          label: lastSyncAt ? `Synced ${formatRelativeTime(lastSyncAt)}` : 'Ready to sync',
          color: '#10b981',
        };
      case 'error':
        return {
          icon: <AlertCircle size={14} />,
          label: 'Sync failed',
          color: '#ef4444',
        };
      case 'offline':
        return {
          icon: <CloudOff size={14} />,
          label: 'Offline',
          color: '#6b7280',
        };
      default:
        return {
          icon: <Cloud size={14} />,
          label: 'Unknown',
          color: '#6b7280',
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

  const { icon, label, color } = getStatusInfo();

  return (
    <div
      className={styles.container}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ color }}
    >
      <div className={styles.icon}>{icon}</div>
      {hasConflicts && (
        <span className={styles.badge} style={{ background: '#f59e0b' }}>
          {conflicts.length}
        </span>
      )}
      {showTooltip && <div className={styles.tooltip}>{label}</div>}
    </div>
  );
}
