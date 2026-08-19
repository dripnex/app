import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, AlertTriangle, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useSyncStore,
  selectStatus,
  selectLastSyncAt,
  selectConsecutiveFailures,
  selectPendingCount,
  selectError,
  selectConflicts,
} from '../../stores/syncStore';
import { syncFooterAction, syncFooterErrorLabel } from '../../utils/syncFooterCopy';
import { sc } from './sc';

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
const SyncProgressIndicator = memo(function SyncProgressIndicator({
  onSetupEncryption,
}: {
  onSetupEncryption?: () => void;
}) {
  const syncStatus = useSyncStore(selectStatus);
  const lastSyncAt = useSyncStore(selectLastSyncAt);
  const pendingCount = useSyncStore(selectPendingCount);
  const consecutiveFailures = useSyncStore(selectConsecutiveFailures);
  const syncError = useSyncStore(selectError);
  const syncNow = useSyncStore(state => state.syncNow);
  const refreshPendingCount = useSyncStore(state => state.refreshPendingCount);
  const conflicts = useSyncStore(selectConflicts);
  const openConflictScreen = useSyncStore(state => state.openConflictScreen);

  // Force re-render every 60s so relative time text stays fresh
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!lastSyncAt) return;
    const timer = setInterval(() => forceUpdate((n: number) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, [lastSyncAt]);

  // Track "just synced" flash state
  const [showSynced, setShowSynced] = useState(false);
  const prevStatusRef = useRef(syncStatus);

  // When status transitions from 'syncing' to 'idle', flash "Synced"
  useEffect(() => {
    if (prevStatusRef.current === 'syncing' && syncStatus === 'idle') {
      setShowSynced(true);
      prevStatusRef.current = syncStatus;
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

  const [encryptionReady, setEncryptionReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ready = await window.dripnex.encryption.isReady();
      if (!cancelled) setEncryptionReady(ready.ready);
    };
    void check();
    const timer = setInterval(() => void check(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [syncStatus]);

  const footerAction = syncFooterAction({
    encryptionReady,
    status: syncStatus,
    error: syncError,
    consecutiveFailures,
  });

  const handleRetry = useCallback(async () => {
    const ready = await window.dripnex.encryption.isReady();
    setEncryptionReady(ready.ready);
    if (!ready.ready) {
      onSetupEncryption?.();
      return;
    }
    try {
      await syncNow();
    } catch {
      // Status is already on the store.
    }
  }, [onSetupEncryption, syncNow]);

  // Syncing
  if (syncStatus === 'syncing') {
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--syncing')}>
        <RefreshCw size={11} className={sc('sidebar-footer-sync-spinning')} />
        <span>Syncing...</span>
      </div>
    );
  }

  if (conflicts.length > 0) {
    const n = conflicts.length;
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--conflict')}>
        <AlertTriangle size={11} />
        <span>
          {n} conflict{n === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className={sc('sidebar-footer-progress-retry')}
          onClick={() => openConflictScreen()}
        >
          Review
        </button>
      </div>
    );
  }

  // Just synced flash
  if (showSynced) {
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--synced')}>
        <Check size={11} />
        <span>Synced</span>
      </div>
    );
  }

  if (footerAction === 'setup' && onSetupEncryption) {
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--error')}>
        <AlertCircle size={11} />
        <span title={syncError ?? undefined}>Set up encryption</span>
        <button
          type="button"
          className={sc('sidebar-footer-progress-retry')}
          onClick={() => onSetupEncryption()}
        >
          Set up
        </button>
      </div>
    );
  }

  // Error or auth-expired
  if (syncStatus === 'error' || syncStatus === 'auth-expired' || syncStatus === 'needs-setup') {
    const action = syncFooterAction({
      encryptionReady,
      status: syncStatus,
      error: syncError,
      consecutiveFailures,
    });
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--error')}>
        <AlertCircle size={11} />
        <span title={syncError ?? undefined}>
          {syncFooterErrorLabel({
            encryptionReady,
            status: syncStatus,
            error: syncError,
            consecutiveFailures,
          })}
        </span>
        {action ? (
          <button
            type="button"
            className={sc('sidebar-footer-progress-retry')}
            onClick={() => {
              if (action === 'setup') onSetupEncryption?.();
              else void handleRetry();
            }}
          >
            {action === 'setup' ? 'Set up' : 'Retry'}
          </button>
        ) : null}
      </div>
    );
  }

  // Offline
  if (syncStatus === 'offline') {
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--offline')}>
        <CloudOff size={11} />
        <span>{pendingCount > 0 ? `Offline \u2014 ${pendingCount} pending` : 'Offline'}</span>
      </div>
    );
  }

  // Idle with pending changes
  if (pendingCount > 0) {
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--pending')}>
        <Cloud size={11} />
        <span>{pendingCount} pending</span>
      </div>
    );
  }

  // Idle with many consecutive failures (no error state yet)
  if (consecutiveFailures >= 2) {
    const action = syncFooterAction({
      encryptionReady,
      status: syncStatus,
      error: syncError,
      consecutiveFailures,
    });
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--error')}>
        <AlertCircle size={11} />
        <span>{action === 'setup' ? 'Set up encryption' : 'Sync unstable'}</span>
        {action ? (
          <button
            type="button"
            className={sc('sidebar-footer-progress-retry')}
            onClick={() => {
              if (action === 'setup') onSetupEncryption?.();
              else void handleRetry();
            }}
          >
            {action === 'setup' ? 'Set up' : 'Retry'}
          </button>
        ) : null}
      </div>
    );
  }

  // Idle, no pending, has sync history — show relative time
  if (lastSyncAt) {
    return (
      <div className={sc('sidebar-footer-progress', 'sidebar-footer-progress--idle')}>
        <Cloud size={11} />
        <span>Synced {formatRelativeTime(lastSyncAt)}</span>
      </div>
    );
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
        return <RefreshCw size={12} className={sc('sidebar-footer-sync-spinning')} />;
      case 'error':
      case 'auth-expired':
      case 'needs-setup':
        return <AlertCircle size={12} />;
      case 'offline':
        return <CloudOff size={12} />;
      default:
        return <Cloud size={12} />;
    }
  };

  const lastSyncAtFooter = useSyncStore(selectLastSyncAt);

  const getSyncTooltip = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync failed';
      case 'needs-setup':
        return 'Set up encryption to sync';
      case 'auth-expired':
        return 'Session expired. Please sign in again.';
      case 'offline':
        return 'Offline';
      default:
        return lastSyncAtFooter
          ? `Synced ${formatRelativeTime(lastSyncAtFooter)}`
          : 'Ready to sync';
    }
  };

  return (
    <footer className={sc('sidebar-footer')}>
      {isAuthenticated && email ? (
        <div className={sc('sidebar-footer-auth')}>
          <span className={sc('sidebar-footer-email')} title={email}>
            {email}
          </span>
          <button
            type="button"
            className={sc('sidebar-footer-sync', `sidebar-footer-sync--${syncStatus}`)}
            title={getSyncTooltip()}
            onClick={onEnableSyncClick}
          >
            {getSyncIcon()}
          </button>
        </div>
      ) : (
        <button type="button" className={sc('sidebar-footer-signin')} onClick={onEnableSyncClick}>
          <Cloud size={12} />
          <span>Enable Sync</span>
        </button>
      )}
      {isAuthenticated && <SyncProgressIndicator onSetupEncryption={onEnableSyncClick} />}
      <span className={sc('sidebar-footer-version')} aria-label={`App version ${appVersion}`}>
        v{appVersion}
      </span>
    </footer>
  );
});
