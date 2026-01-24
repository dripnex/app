/**
 * Updates Settings Section
 *
 * Auto-update preferences and manual check.
 */

import { useState, useCallback } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { useSettingsStore, selectUpdates } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Toggle } from '../components/controls';
import styles from './Section.module.css';

export function UpdatesSection() {
  const updates = useSettingsStore(selectUpdates);
  const updateUpdates = useSettingsStore((s) => s.updateUpdates);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const handleCheckForUpdates = useCallback(async () => {
    setIsChecking(true);
    setCheckResult(null);

    try {
      const result = await window.readied.updates.checkNow();
      if (result.available) {
        setCheckResult(`Update available: v${result.version}`);
      } else {
        setCheckResult('You are on the latest version');
      }
      // Update last checked timestamp
      updateUpdates({ lastCheckedAt: Date.now() });
    } catch {
      setCheckResult('Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  }, [updateUpdates]);

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
            onChange={(checked) => updateUpdates({ autoCheck: checked })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Manual Check">
        <SettingRow
          label="Check for Updates"
          description={`Last checked: ${formatLastChecked(updates.lastCheckedAt)}`}
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleCheckForUpdates}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <RefreshCw size={14} className={styles.spinning} />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Check Now</span>
              </>
            )}
          </button>
        </SettingRow>
        {checkResult && (
          <div className={styles.checkResult}>{checkResult}</div>
        )}
      </SettingGroup>
    </div>
  );
}
