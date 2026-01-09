/**
 * Account Settings Section
 *
 * Authentication, user profile, and device management.
 */

import { useState, useCallback, useEffect } from 'react';
import { LogIn, LogOut, Mail, User as UserIcon, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { useSyncStore } from '../../../stores/syncStore';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { MagicLinkFlow } from '../../../components/auth/MagicLinkFlow';
import { ConflictResolver } from '../../../components/sync/ConflictResolver';
import styles from './Section.module.css';

export function AccountSection() {
  const { user, isAuthenticated, isLoading, logout, loadSession } = useAuthStore();
  const { syncNow, status: syncStatus, lastSyncAt, conflicts } = useSyncStore();
  const [showMagicLinkFlow, setShowMagicLinkFlow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSignIn = useCallback(() => {
    setShowMagicLinkFlow(true);
    setMessage(null);
  }, []);

  const handleSignOut = useCallback(async () => {
    setMessage(null);
    try {
      await logout();
      setMessage('Signed out successfully');
    } catch (error) {
      setMessage(`Sign out failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [logout]);

  const handleMagicLinkSuccess = useCallback(() => {
    setShowMagicLinkFlow(false);
    setMessage('Successfully signed in!');
  }, []);

  const handleMagicLinkCancel = useCallback(() => {
    setShowMagicLinkFlow(false);
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      await syncNow();
      setMessage('Sync completed successfully');
    } catch (error) {
      setMessage(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  }, [syncNow]);

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never';
    const date = new Date(lastSyncAt);
    return date.toLocaleString();
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Account</h2>

      <SettingGroup title="Authentication">
        {isAuthenticated && user ? (
          <>
            <SettingRow label="Signed in as" description={user.email}>
              <div className={styles.statusBadge}>
                <UserIcon size={14} />
                <span>Active</span>
              </div>
            </SettingRow>

            <SettingRow label="Sign out" description="Clear your session from this device">
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleSignOut}
                disabled={isLoading}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </SettingRow>
          </>
        ) : (
          <SettingRow
            label="Sign in"
            description="Sign in to enable sync and access your notes from any device"
          >
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Mail size={14} className={styles.spinning} />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <LogIn size={14} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </SettingRow>
        )}
      </SettingGroup>

      {isAuthenticated && (
        <>
          <SettingGroup title="Synchronization">
            <SettingRow
              label="Sync Now"
              description={`Last synced: ${formatLastSync()}`}
            >
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSync}
                disabled={isSyncing || syncStatus === 'syncing'}
              >
                {isSyncing || syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw size={14} className={styles.spinning} />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Sync</span>
                  </>
                )}
              </button>
            </SettingRow>

            {syncStatus === 'offline' && (
              <div className={styles.infoMessage}>
                You are offline. Sync will resume when you're back online.
              </div>
            )}
          </SettingGroup>

          {conflicts.length > 0 && <ConflictResolver />}
        </>
      )}

      {message && (
        <div className={isAuthenticated ? styles.successMessage : styles.infoMessage}>
          {message}
        </div>
      )}

      {showMagicLinkFlow && (
        <MagicLinkFlow onSuccess={handleMagicLinkSuccess} onCancel={handleMagicLinkCancel} />
      )}
    </div>
  );
}
