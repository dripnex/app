/**
 * Account Settings Section
 *
 * Authentication, user profile, and device management.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  LogIn,
  LogOut,
  Mail,
  User as UserIcon,
  RefreshCw,
  Sparkles,
  CreditCard,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { getProductConfig } from '@readied/product-config';
import { useAuthStore } from '../../../stores/authStore';
import { useSyncStore } from '../../../stores/syncStore';
import { useLicense } from '../../../contexts/LicenseContext';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { MagicLinkFlow } from '../../../components/auth/MagicLinkFlow';
import { ConflictResolver } from '../../../components/sync/ConflictResolver';
import styles from './Section.module.css';

const config = getProductConfig();
const proPricing = config.plans.pro.pricing!;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AccountSection() {
  const { user, isAuthenticated, isLoading, logout, loadSession } = useAuthStore();
  const { syncNow, status: syncStatus, lastSyncAt, conflicts } = useSyncStore();
  const { state: licenseState, openSubscribe } = useLicense();
  const [showMagicLinkFlow, setShowMagicLinkFlow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [syncHistory, setSyncHistory] = useState<Array<{
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    notesPulled: number;
    notesPushed: number;
    notebooksPulled: number;
    notebooksPushed: number;
    tagsPulled: number;
    tagsPushed: number;
    conflicts: number;
    bytesSent: number;
    bytesReceived: number;
    errorMessage: string | null;
  }>>([]);

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const loadSyncHistory = useCallback(async () => {
    try {
      const result = await window.readied.sync.history(10);
      if (result.success) {
        setSyncHistory(result.history);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (showHistory) {
      loadSyncHistory();
    }
  }, [showHistory, loadSyncHistory]);

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
    setMessage('Magic link sent! Check your email.');
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
      if (showHistory) loadSyncHistory();
    } catch (error) {
      setMessage(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  }, [syncNow, showHistory, loadSyncHistory]);

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never';
    const date = new Date(lastSyncAt);
    return date.toLocaleString();
  };

  const handleUpgrade = useCallback(
    async (plan: 'monthly' | 'annual') => {
      if (!isAuthenticated) {
        setMessage('Please sign in first to upgrade');
        return;
      }

      setIsUpgrading(true);
      setMessage(null);
      try {
        const result = await openSubscribe({ plan });
        if (!result.success) {
          setMessage(`Failed to open checkout: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        setMessage(
          `Failed to upgrade: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setIsUpgrading(false);
      }
    },
    [isAuthenticated, openSubscribe]
  );

  const handleManageSubscription = useCallback(async () => {
    setIsManaging(true);
    setMessage(null);
    try {
      const result = await window.readied.subscription.openPortal('https://readied.app');
      if (!result.success) {
        setMessage(`Failed to open billing portal: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(
        `Failed to open billing portal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsManaging(false);
    }
  }, []);

  const getLicenseStatusText = () => {
    if (!licenseState) return 'Loading...';
    switch (licenseState.status) {
      case 'pro_active':
        return 'Pro';
      case 'pro_grace':
        return 'Pro (Payment Issue)';
      case 'pro_expired':
        return 'Pro Expired';
      case 'trial':
        return `Trial (${licenseState.trial?.daysRemaining ?? 0} days left)`;
      case 'free':
        return 'Free';
      // Legacy statuses
      case 'licensed':
        return 'Pro';
      case 'trial_expired':
        return 'Trial Expired';
      case 'updates_expired':
        return 'Updates Expired';
      default:
        return 'Free';
    }
  };

  const isProActive = licenseState?.status === 'pro_active' || licenseState?.status === 'pro_grace';

  const shouldShowUpgrade = () => {
    if (!licenseState) return false;
    return (
      licenseState.status === 'trial' ||
      licenseState.status === 'free' ||
      licenseState.status === 'pro_expired' ||
      licenseState.status === 'trial_expired'
    );
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
            <SettingRow label="Sync Now" description={`Last synced: ${formatLastSync()}`}>
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

            <button
              type="button"
              className={styles.historyToggle}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Sync History</span>
            </button>

            {showHistory && (
              <div className={styles.syncHistoryTable}>
                {syncHistory.length === 0 ? (
                  <div className={styles.placeholder}>No sync history yet</div>
                ) : (
                  <table className={styles.historyTable}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Items</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistory.map(entry => (
                        <tr key={entry.id}>
                          <td>{new Date(entry.startedAt).toLocaleString()}</td>
                          <td>
                            <span className={`${styles.historyStatus} ${styles[`historyStatus_${entry.status}` as keyof typeof styles]}`}>
                              {entry.status}
                            </span>
                          </td>
                          <td>
                            ↓{entry.notesPulled + entry.notebooksPulled + entry.tagsPulled}{' '}
                            ↑{entry.notesPushed + entry.notebooksPushed + entry.tagsPushed}
                            {entry.conflicts > 0 && ` ⚠${entry.conflicts}`}
                          </td>
                          <td>
                            ↑{formatBytes(entry.bytesSent)} ↓{formatBytes(entry.bytesReceived)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </SettingGroup>

          {conflicts.length > 0 && <ConflictResolver />}

          <SettingGroup title="Subscription">
            <SettingRow label="Plan" description={`Current status: ${getLicenseStatusText()}`}>
              <div className={styles.statusBadge}>
                <CreditCard size={14} />
                <span>{getLicenseStatusText()}</span>
              </div>
            </SettingRow>

            {isProActive && (
              <SettingRow
                label="Manage Subscription"
                description="Update payment method, change plan, or cancel"
              >
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleManageSubscription}
                  disabled={isManaging}
                >
                  <ExternalLink size={14} />
                  <span>{isManaging ? 'Opening...' : 'Manage Subscription'}</span>
                </button>
              </SettingRow>
            )}

            {shouldShowUpgrade() && (
              <SettingRow
                label="Upgrade to Pro"
                description="Get cloud sync, advanced search, and all pro features"
              >
                <div className={styles.buttonGroup}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => handleUpgrade('monthly')}
                    disabled={isUpgrading}
                  >
                    <Sparkles size={14} />
                    <span>Monthly - {proPricing.intervals.monthly.label}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => handleUpgrade('annual')}
                    disabled={isUpgrading}
                  >
                    <Sparkles size={14} />
                    <span>Annual - {proPricing.intervals.annual.label}</span>
                    <small className={styles.badge}>Save {proPricing.annualSavings}</small>
                  </button>
                </div>
              </SettingRow>
            )}
          </SettingGroup>
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
