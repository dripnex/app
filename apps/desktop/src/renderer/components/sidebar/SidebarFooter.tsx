import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useSyncStore,
  selectStatus,
  selectLastSyncAt,
  selectConsecutiveFailures,
  selectPendingCount,
  selectError,
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

/**
 * Sync progress indicator shown in the sidebar footer.
 *
 * States:
 * - idle + pending > 0  → "N pending"
 * - syncing              → "Syncing..." with spinning icon
 * - just synced          → "Synced" with check icon (fades after 3s)
 * - error/auth-expired   → "Sync error" in danger color with retry
 * - offline              → "Offline — N pending"
 * - idle + pending === 0 → hidden (nothing to show)
 */
const SyncProgressIndicator = memo(function SyncProgressIndicator() {
  const syncStatus = useSyncStore(selectStatus);
  const lastSyncAt = useSyncStore(selectLastSyncAt);
  const pendingCount = useSyncStore(selectPendingCount);
  const consecutiveFailures = useSyncStore(selectConsecutiveFailures);
  const syncError = useSyncStore(selectError);
  const syncNow = useSyncStore(state => state.syncNow);
  const refreshPendingCount = useSyncStore(state => state.refreshPendingCount);

  // Track "just synced" flash state
  const [showSynced, setShowSynced] = useState(false);
  const prevStatusRef = useRef(syncStatus);

  // When status transitions from 'syncing' to 'idle', flash "Synced"
  useEffect(() => {
    if (prevStatusRef.current === 'syncing' && syncStatus === 'idle') {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = syncStatus;
  }, [syncStatus]);

  // Poll pending count every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshPendingCount();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  const handleRetry = useCallback(() => {
    void syncNow();
  }, [syncNow]);

  // Syncing
  if (syncStatus === 'syncing') {
    return (
      <div className="sidebar-footer-progress sidebar-footer-progress--syncing">
        <RefreshCw size={11} className="sidebar-footer-sync-spinning" />
        <span>Syncing...</span>
      </div>
    );
  }

  // Just synced flash
  if (showSynced) {
    return (
      <div className="sidebar-footer-progress sidebar-footer-progress--synced">
        <Check size={11} />
        <span>Synced</span>
      </div>
    );
  }

  // Error or auth-expired
  if (syncStatus === 'error' || syncStatus === 'auth-expired') {
    return (
      <div className="sidebar-footer-progress sidebar-footer-progress--error">
        <AlertCircle size={11} />
        <span title={syncError ?? undefined}>
          {syncStatus === 'auth-expired' ? 'Session expired' : 'Sync error'}
        </span>
        {syncStatus === 'error' && (
          <button type="button" className="sidebar-footer-progress-retry" onClick={handleRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  // Offline
  if (syncStatus === 'offline') {
    return (
      <div className="sidebar-footer-progress sidebar-footer-progress--offline">
        <CloudOff size={11} />
        <span>{pendingCount > 0 ? `Offline \u2014 ${pendingCount} pending` : 'Offline'}</span>
      </div>
    );
  }

  // Idle with pending changes
  if (pendingCount > 0) {
    return (
      <div className="sidebar-footer-progress sidebar-footer-progress--pending">
        <Cloud size={11} />
        <span>{pendingCount} pending</span>
      </div>
    );
  }

  // Idle with many consecutive failures (no error state yet)
  if (consecutiveFailures >= 2) {
    return (
      <div className="sidebar-footer-progress sidebar-footer-progress--error">
        <AlertCircle size={11} />
        <span>Sync unstable</span>
        <button type="button" className="sidebar-footer-progress-retry" onClick={handleRetry}>
          Retry
        </button>
      </div>
    );
  }

  // Idle, no pending, recently synced — show last sync time briefly
  if (lastSyncAt && Date.now() - lastSyncAt < 60_000) {
    return null; // "Synced" flash already handled above
  }

  // Nothing to show
  return null;
});

export const SidebarFooter = memo(function SidebarFooter({
  appVersion,
  onEnableSyncClick,
}: SidebarFooterProps) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const email = useAuthStore(state => state.user?.email ?? null);
  const syncStatus = useSyncStore(selectStatus);

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
    const lastSyncAt = useSyncStore.getState().lastSyncAt;
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
      {isAuthenticated && <SyncProgressIndicator />}
      <span className="sidebar-footer-version" aria-label={`App version ${appVersion}`}>
        v{appVersion}
      </span>
    </footer>
  );
});
