/**
 * Updates Settings Section
 *
 * Auto-update preferences and manual check with download progress.
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { useSettingsStore, selectUpdates } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Toggle } from '../components/controls';
import { Button } from '../../../ui/primitives';
import styles from './Section.module.css';

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | {
      status: 'downloading';
      version: string;
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }
  | { status: 'ready'; version: string }
  | { status: 'installing' }
  | { status: 'up-to-date' }
  | { status: 'error'; message: string };

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1_048_576) {
    return `${(bytesPerSecond / 1_048_576).toFixed(1)} MB/s`;
  }
  return `${Math.round(bytesPerSecond / 1024)} KB/s`;
}

export function UpdatesSection() {
  const updates = useSettingsStore(selectUpdates);
  const updateUpdates = useSettingsStore(s => s.updateUpdates);
  const [state, setState] = useState<UpdateState>({ status: 'idle' });

  // Subscribe to main-process update events
  useEffect(() => {
    const unsubs = [
      window.dripnex.updates.onAvailable(info => {
        setState({ status: 'available', version: info.version });
      }),
      window.dripnex.updates.onDownloadProgress(p => {
        setState(prev => ({
          status: 'downloading',
          version: prev.status === 'downloading' || prev.status === 'available' ? prev.version : '',
          percent: p.percent,
          bytesPerSecond: p.bytesPerSecond,
          transferred: p.transferred,
          total: p.total,
        }));
      }),
      window.dripnex.updates.onDownloadComplete(info => {
        setState({ status: 'ready', version: info.version });
      }),
      window.dripnex.updates.onError(err => {
        setState({ status: 'error', message: err.message });
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    setState({ status: 'checking' });
    try {
      const result = await window.dripnex.updates.checkNow();
      if (result.available) {
        setState({ status: 'available', version: result.version ?? '' });
      } else {
        setState({ status: 'up-to-date' });
      }
      updateUpdates({ lastCheckedAt: Date.now() });
    } catch {
      setState({ status: 'error', message: 'Failed to check for updates' });
    }
  }, [updateUpdates]);

  const handleStartDownload = useCallback(async () => {
    const version = state.status === 'available' ? state.version : '';
    setState({
      status: 'downloading',
      version,
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
    });
    const result = await window.dripnex.updates.startDownload();
    if (!result.ok) {
      setState({ status: 'error', message: 'Failed to start download' });
    }
  }, [state]);

  const handleInstall = useCallback(async () => {
    setState({ status: 'installing' });
    try {
      await window.dripnex.updates.installNow();
    } catch {
      setState({ status: 'error', message: 'Failed to install update. Please try again.' });
    }
  }, []);

  const handleRetry = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  const formatLastChecked = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderButton = () => {
    switch (state.status) {
      case 'idle':
      case 'up-to-date':
        return (
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleCheckForUpdates}
          >
            Check Now
          </Button>
        );
      case 'checking':
        return (
          <Button variant="secondary" size="sm" loading disabled>
            Checking...
          </Button>
        );
      case 'available':
        return (
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleStartDownload}
          >
            Download v{state.version}
          </Button>
        );
      case 'downloading':
        return (
          <Button variant="secondary" size="sm" loading disabled>
            Downloading...
          </Button>
        );
      case 'ready':
        return (
          <Button
            variant="primary"
            size="sm"
            icon={<RotateCcw size={14} />}
            onClick={handleInstall}
          >
            Restart to Update
          </Button>
        );
      case 'installing':
        return (
          <Button variant="secondary" size="sm" loading disabled>
            Restarting...
          </Button>
        );
      case 'error':
        return (
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw size={14} />}
            onClick={handleRetry}
          >
            Try Again
          </Button>
        );
    }
  };

  const renderInfo = () => {
    switch (state.status) {
      case 'up-to-date':
        return <div className={styles.checkResult}>You are on the latest version</div>;
      case 'available':
        return <div className={styles.checkResult}>Version {state.version} is available</div>;
      case 'downloading':
        return (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(state.percent, 100)}%` }}
              />
            </div>
            <div className={styles.progressInfo}>
              <span>{Math.round(state.percent)}%</span>
              <span>{formatSpeed(state.bytesPerSecond)}</span>
            </div>
          </div>
        );
      case 'ready':
        return (
          <div className={styles.successMessage}>
            v{state.version} downloaded. Restart to apply.
          </div>
        );
      case 'error':
        return <div className={styles.errorMessage}>{state.message}</div>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Updates</h2>

      <SettingGroup title="Automatic Updates">
        <SettingRow
          label="Check for updates automatically"
          description="Check for new versions when the app starts"
          htmlFor="autoCheck"
        >
          <Toggle
            id="autoCheck"
            checked={updates.autoCheck}
            onChange={checked => updateUpdates({ autoCheck: checked })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Manual Check">
        <SettingRow
          label="Check for Updates"
          description={`Last checked: ${formatLastChecked(updates.lastCheckedAt)}`}
        >
          {renderButton()}
        </SettingRow>
        {renderInfo()}
      </SettingGroup>
    </div>
  );
}
