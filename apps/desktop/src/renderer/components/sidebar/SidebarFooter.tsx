import { memo } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useSyncStore,
  selectStatus,
  selectLastSyncAt,
  selectConsecutiveFailures,
  selectPendingCount,
} from '../../stores/syncStore';

interface SidebarFooterProps {
  readonly appVersion: string;
  readonly onEnableSyncClick?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export const SidebarFooter = memo(function SidebarFooter({
  appVersion,
  onEnableSyncClick,
}: SidebarFooterProps) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const email = useAuthStore(state => state.user?.email ?? null);
  const syncStatus = useSyncStore(selectStatus);
  const lastSyncAt = useSyncStore(selectLastSyncAt);
  const consecutiveFailures = useSyncStore(selectConsecutiveFailures);
  const pendingCount = useSyncStore(selectPendingCount);

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw size={12} className="sidebar-footer-sync-spinning" />;
      case 'error':
      case 'auth-expired':
        return <AlertCircle size={12} />;
      case 'offline':
        return <CloudOff size={12} />;
      default:
        return <Cloud size={12} />;
    }
  };

  const getSyncTooltip = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync failed';
      case 'auth-expired':
        return 'Session expired. Please sign in again.';
      case 'offline':
        return 'Offline';
      default:
        return lastSyncAt ? `Synced ${formatRelativeTime(lastSyncAt)}` : 'Ready to sync';
    }
  };

  // Show offline queue when offline/error with pending changes, or many consecutive failures
  const isOfflineOrError = syncStatus === 'offline' || syncStatus === 'error';
  const showQueueStatus =
    isAuthenticated && isOfflineOrError && (pendingCount > 0 || consecutiveFailures >= 2);

  return (
    <footer className="sidebar-footer">
      {isAuthenticated && email ? (
        <div className="sidebar-footer-auth">
          <span className="sidebar-footer-email" title={email}>
            {email}
          </span>
          <span
            className={`sidebar-footer-sync sidebar-footer-sync--${syncStatus}`}
            title={getSyncTooltip()}
          >
            {getSyncIcon()}
          </span>
        </div>
      ) : (
        <button type="button" className="sidebar-footer-signin" onClick={onEnableSyncClick}>
          <Cloud size={12} />
          <span>Enable Sync</span>
        </button>
      )}
      {showQueueStatus && (
        <span className="sidebar-footer-queue">
          {pendingCount > 0
            ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending`
            : 'Offline \u2014 changes will sync when back online'}
        </span>
      )}
      <span className="sidebar-footer-version" aria-label={`App version ${appVersion}`}>
        v{appVersion}
      </span>
    </footer>
  );
});
