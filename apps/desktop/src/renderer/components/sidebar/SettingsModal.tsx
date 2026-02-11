import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings,
  X,
  Monitor,
  Zap,
  Eye,
  Key,
  Info,
  Columns,
  FileText,
  Split,
  Sparkles,
  Puzzle,
} from 'lucide-react';
import { usePerformanceStore, type PerfMode } from '../../stores/performanceStore';
import {
  useEditorPreferencesStore,
  type EditorViewMode,
} from '../../stores/editorPreferencesStore';
import { useLicense } from '../../contexts/LicenseContext';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  readonly onClose: () => void;
}

interface DiscoveredPluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  // Stores
  const { mode: perfMode, setMode: setPerfMode, setBaseMode } = usePerformanceStore();
  const { viewMode, setViewMode } = useEditorPreferencesStore();
  const { state: licenseState, openSubscribe } = useLicense();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [discoveredPlugins, setDiscoveredPlugins] = useState<DiscoveredPluginInfo[]>([]);
  const [pluginsPath, setPluginsPath] = useState('');

  // Load app version
  useEffect(() => {
    const result = window.readied.app.version();
    Promise.resolve(result).then(setAppVersion);
  }, []);

  // Load discovered plugins
  useEffect(() => {
    async function loadPlugins() {
      try {
        const [scanned, stateList, paths] = await Promise.all([
          window.readied.plugins.scan(),
          window.readied.plugins.listState(),
          window.readied.data.paths(),
        ]);
        setPluginsPath(paths.root + '/plugins');
        const stateMap = new Map(stateList.map(s => [s.pluginId, s.enabled]));
        setDiscoveredPlugins(
          scanned.map(sp => ({
            id: sp.id,
            name: sp.name,
            version: sp.version,
            description: sp.description,
            enabled: stateMap.get(sp.id) ?? true,
          }))
        );
      } catch {
        // Plugin scanning failed - leave empty
      }
    }
    loadPlugins();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close when clicking overlay
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Performance mode handler
  const handlePerfModeChange = useCallback(
    (mode: PerfMode) => {
      setPerfMode(mode);
      setBaseMode(mode);
      document.documentElement.dataset.perf = mode;
    },
    [setPerfMode, setBaseMode]
  );

  // Editor view mode handler
  const handleViewModeChange = useCallback(
    (mode: EditorViewMode) => {
      setViewMode(mode);
    },
    [setViewMode]
  );

  // Upgrade to Pro handler
  const handleUpgrade = useCallback(
    async (plan: 'monthly' | 'annual') => {
      setIsUpgrading(true);
      try {
        const result = await openSubscribe({ plan });
        if (!result.success) {
          window.readied.log.error('Failed to open subscription', { error: result.error });
        }
      } catch (error) {
        window.readied.log.error('Failed to upgrade', { error: String(error) });
      } finally {
        setIsUpgrading(false);
      }
    },
    [openSubscribe]
  );

  // Plugin toggle handler
  const handlePluginToggle = useCallback(
    async (pluginId: string, enabled: boolean) => {
      await window.readied.plugins.setEnabled(pluginId, enabled);
      setDiscoveredPlugins(prev =>
        prev.map(p => (p.id === pluginId ? { ...p, enabled } : p))
      );
    },
    []
  );

  // License status helpers
  const getLicenseStatusText = () => {
    if (!licenseState) return 'Loading...';
    switch (licenseState.status) {
      case 'licensed':
        return 'Licensed';
      case 'trial':
        return `Trial (${licenseState.trialDaysRemaining} days left)`;
      case 'trial_expired':
        return 'Trial Expired';
      case 'updates_expired':
        return 'Updates Expired';
      default:
        return 'Unknown';
    }
  };

  const getLicenseStatusClass = () => {
    if (!licenseState) return '';
    switch (licenseState.status) {
      case 'licensed':
        return styles.statusLicensed;
      case 'trial':
        return styles.statusTrial;
      case 'trial_expired':
      case 'updates_expired':
        return styles.statusExpired;
      default:
        return '';
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Settings size={20} className={styles.headerIcon} />
            <span className={styles.headerTitle}>Settings</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Performance Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Zap size={16} />
              <span>Performance</span>
            </div>
            <p className={styles.sectionDesc}>Adjust visual effects for your hardware</p>
            <div className={styles.optionGroup}>
              <button
                type="button"
                className={`${styles.optionBtn} ${perfMode === 'high' ? styles.selected : ''}`}
                onClick={() => handlePerfModeChange('high')}
              >
                <Monitor size={16} />
                <span>High</span>
                <small>Full blur effects</small>
              </button>
              <button
                type="button"
                className={`${styles.optionBtn} ${perfMode === 'medium' ? styles.selected : ''}`}
                onClick={() => handlePerfModeChange('medium')}
              >
                <Monitor size={16} />
                <span>Medium</span>
                <small>Reduced effects</small>
              </button>
              <button
                type="button"
                className={`${styles.optionBtn} ${perfMode === 'low' ? styles.selected : ''}`}
                onClick={() => handlePerfModeChange('low')}
              >
                <Monitor size={16} />
                <span>Low</span>
                <small>No blur</small>
              </button>
            </div>
          </section>

          {/* Editor Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Eye size={16} />
              <span>Editor</span>
            </div>
            <p className={styles.sectionDesc}>Default view mode when opening notes</p>
            <div className={styles.optionGroup}>
              <button
                type="button"
                className={`${styles.optionBtn} ${viewMode === 'editor' ? styles.selected : ''}`}
                onClick={() => handleViewModeChange('editor')}
              >
                <FileText size={16} />
                <span>Editor</span>
                <small>Markdown only</small>
              </button>
              <button
                type="button"
                className={`${styles.optionBtn} ${viewMode === 'split' ? styles.selected : ''}`}
                onClick={() => handleViewModeChange('split')}
              >
                <Split size={16} />
                <span>Split</span>
                <small>Side by side</small>
              </button>
              <button
                type="button"
                className={`${styles.optionBtn} ${viewMode === 'preview' ? styles.selected : ''}`}
                onClick={() => handleViewModeChange('preview')}
              >
                <Columns size={16} />
                <span>Preview</span>
                <small>Read only</small>
              </button>
            </div>
          </section>

          {/* License Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Key size={16} />
              <span>License</span>
            </div>
            <div className={styles.licenseInfo}>
              <div className={styles.licenseRow}>
                <span className={styles.licenseLabel}>Status</span>
                <span className={`${styles.licenseValue} ${getLicenseStatusClass()}`}>
                  {getLicenseStatusText()}
                </span>
              </div>
              {licenseState?.expiresAt && (
                <div className={styles.licenseRow}>
                  <span className={styles.licenseLabel}>Expires</span>
                  <span className={styles.licenseValue}>
                    {new Date(licenseState.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Show Upgrade button if user is not Pro */}
            {licenseState &&
              (licenseState.status === 'trial' || licenseState.status === 'trial_expired') && (
                <div className={styles.upgradeSection}>
                  <p className={styles.upgradeText}>
                    Upgrade to Pro for cloud sync, advanced search, and more.
                  </p>
                  <div className={styles.upgradeButtons}>
                    <button
                      type="button"
                      className={styles.upgradeBtn}
                      onClick={() => handleUpgrade('monthly')}
                      disabled={isUpgrading}
                    >
                      <Sparkles size={16} />
                      <span>Monthly - $2.99/mo</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.upgradeBtn} ${styles.upgradeBtnPrimary}`}
                      onClick={() => handleUpgrade('annual')}
                      disabled={isUpgrading}
                    >
                      <Sparkles size={16} />
                      <span>Annual - $29.90/yr</span>
                      <small>Save $6</small>
                    </button>
                  </div>
                </div>
              )}
          </section>

          {/* Plugins Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Puzzle size={16} />
              <span>Plugins</span>
            </div>
            {discoveredPlugins.length === 0 ? (
              <p className={styles.sectionDesc}>
                No plugins installed.{pluginsPath ? ` Place plugins in ${pluginsPath}` : ''}
              </p>
            ) : (
              <div className={styles.pluginList}>
                {discoveredPlugins.map(plugin => (
                  <div key={plugin.id} className={styles.pluginItem}>
                    <div className={styles.pluginInfo}>
                      <span className={styles.pluginName}>{plugin.name}</span>
                      <span className={styles.pluginVersion}>v{plugin.version}</span>
                      {plugin.description && (
                        <span className={styles.pluginDesc}>{plugin.description}</span>
                      )}
                    </div>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={plugin.enabled}
                        onChange={e => handlePluginToggle(plugin.id, e.target.checked)}
                      />
                      <span className={styles.toggleTrack} />
                    </label>
                  </div>
                ))}
                <p className={styles.pluginNote}>
                  Changes take effect after restart.
                </p>
              </div>
            )}
          </section>

          {/* About Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Info size={16} />
              <span>About</span>
            </div>
            <div className={styles.aboutInfo}>
              <div className={styles.aboutRow}>
                <span className={styles.aboutLabel}>Version</span>
                <span className={styles.aboutValue}>{appVersion}</span>
              </div>
              <div className={styles.aboutRow}>
                <span className={styles.aboutLabel}>App</span>
                <span className={styles.aboutValue}>Readied</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
