/**
 * Plugins Settings Section
 *
 * Card-based plugin manager showing built-in and community plugins
 * with enable/disable toggles, badges, and collapsible config forms.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FolderOpen, ChevronDown, Download, Trash2 } from 'lucide-react';
import type { PluginConfigSchemaField } from '../../../../preload/index';
import { Toggle, TextInput, NumberInput, RangeInput, Select } from '../components/controls';
import styles from './Section.module.css';

// ============================================================================
// Types
// ============================================================================

interface DiscoveredPluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  configSchema?: Record<string, PluginConfigSchemaField>;
}

interface BuiltInPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const BUILT_IN_PLUGINS: BuiltInPluginInfo[] = [
  {
    id: 'readied-word-count',
    name: 'Word Count',
    version: '1.0.0',
    description: 'Shows word, character, and line count in the editor status bar',
  },
  {
    id: 'readied-typewriter-mode',
    name: 'Typewriter Mode',
    version: '1.0.0',
    description: 'Keeps the cursor line centered in the editor for a focused writing experience',
  },
  {
    id: 'readied-active-line-highlight',
    name: 'Active Line Highlight',
    version: '1.0.0',
    description: 'Highlights the line where the cursor is positioned',
  },
  {
    id: 'readied-tables',
    name: 'Tables',
    version: '1.0.0',
    description:
      'Insert Table wizard, WYSIWYG table rendering, sortable preview columns, and Export to CSV',
  },
];

// ============================================================================
// PluginCard
// ============================================================================

interface PluginCardProps {
  name: string;
  version: string;
  description?: string;
  isBuiltIn: boolean;
  enabled: boolean;
  onToggle?: (enabled: boolean) => void;
  onUninstall?: () => void;
  configSchema?: Record<string, PluginConfigSchemaField>;
  configValues?: Record<string, unknown>;
  onConfigChange?: (key: string, value: unknown) => void;
}

function PluginCard({
  name,
  version,
  description,
  isBuiltIn,
  enabled,
  onToggle,
  onUninstall,
  configSchema,
  configValues,
  onConfigChange,
}: PluginCardProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const hasConfig = configSchema && Object.keys(configSchema).length > 0 && enabled;

  const getConfigValue = (key: string, field: PluginConfigSchemaField) => {
    const stored = configValues?.[key];
    return stored !== undefined ? stored : field.default;
  };

  return (
    <div className={styles.pluginCard}>
      <div className={styles.pluginCardHeader}>
        <div className={styles.pluginCardInfo}>
          <div className={styles.pluginCardMeta}>
            <span
              className={`${styles.pluginBadge} ${isBuiltIn ? styles.pluginBadgeBuiltIn : ''}`}
            >
              {isBuiltIn ? 'Built-in' : 'Installed'}
            </span>
            <span className={styles.pluginName}>{name}</span>
            <span className={styles.pluginVersion}>v{version}</span>
          </div>
          {description && <p className={styles.pluginDescription}>{description}</p>}
        </div>
        <div className={styles.pluginCardControl}>
          <Toggle
            id={`plugin-${name.toLowerCase().replace(/\s+/g, '-')}`}
            checked={enabled}
            onChange={checked => onToggle?.(checked)}
            disabled={isBuiltIn}
          />
          {!isBuiltIn && onUninstall && (
            <button
              type="button"
              className={styles.pluginUninstallButton}
              onClick={onUninstall}
              title="Uninstall plugin"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {hasConfig && (
        <>
          <button
            type="button"
            className={`${styles.pluginConfigToggle} ${configOpen ? styles.pluginConfigToggleOpen : ''}`}
            onClick={() => setConfigOpen(prev => !prev)}
          >
            <ChevronDown size={14} />
            <span>Settings</span>
          </button>

          {configOpen && (
            <div className={styles.pluginConfigPanel}>
              {Object.entries(configSchema).map(([key, field]) => {
                const value = getConfigValue(key, field);
                const fieldId = `plugin-config-${name}-${key}`;
                const label = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, s => s.toUpperCase());

                return (
                  <div key={key} className={styles.pluginConfigRow}>
                    <div>
                      <div className={styles.pluginConfigLabel}>{label}</div>
                      {field.description && (
                        <div className={styles.pluginConfigDescription}>{field.description}</div>
                      )}
                    </div>
                    <div>
                      {field.type === 'boolean' && (
                        <Toggle
                          id={fieldId}
                          checked={value as boolean}
                          onChange={checked => onConfigChange?.(key, checked)}
                        />
                      )}
                      {field.type === 'string' && (
                        <TextInput
                          id={fieldId}
                          value={(value as string) ?? ''}
                          onChange={v => onConfigChange?.(key, v)}
                        />
                      )}
                      {field.type === 'number' && (
                        <NumberInput
                          id={fieldId}
                          value={(value as number) ?? 0}
                          onChange={v => onConfigChange?.(key, v)}
                        />
                      )}
                      {field.type === 'enum' && field.options && (
                        <Select
                          id={fieldId}
                          value={(value as string) ?? ''}
                          onChange={v => onConfigChange?.(key, v)}
                          options={field.options}
                        />
                      )}
                      {field.type === 'range' && (
                        <RangeInput
                          id={fieldId}
                          value={(value as number) ?? field.min ?? 0}
                          onChange={v => onConfigChange?.(key, v)}
                          min={field.min ?? 0}
                          max={field.max ?? 100}
                          step={field.step}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// PluginsSection
// ============================================================================

export function PluginsSection() {
  const [plugins, setPlugins] = useState<DiscoveredPluginInfo[]>([]);
  const [pluginsPath, setPluginsPath] = useState('');
  const [isReloading, setIsReloading] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, Record<string, unknown>>>({});

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
        const pluginList = scanned.map(sp => ({
          id: sp.id,
          name: sp.name,
          version: sp.version,
          description: sp.description,
          enabled: stateMap.get(sp.id) ?? true,
          configSchema: sp.configSchema,
        }));
        setPlugins(pluginList);

        // Load config values for plugins with schemas
        const configs: Record<string, Record<string, unknown>> = {};
        for (const plugin of pluginList) {
          if (plugin.configSchema && plugin.enabled) {
            try {
              const allConfig = await window.readied.pluginConfig.getAll(plugin.id);
              configs[plugin.id] = allConfig;
            } catch {
              configs[plugin.id] = {};
            }
          }
        }
        setConfigValues(configs);
      } catch {
        // Plugin scanning failed - leave empty
      }
    }
    loadPlugins();
  }, []);

  // Toggle plugin enabled/disabled
  const handleToggle = useCallback(async (pluginId: string, enabled: boolean) => {
    await window.readied.plugins.setEnabled(pluginId, enabled);
    setPlugins(prev => prev.map(p => (p.id === pluginId ? { ...p, enabled } : p)));
  }, []);

  // Update a plugin config value
  const handleConfigChange = useCallback(async (pluginId: string, key: string, value: unknown) => {
    await window.readied.pluginConfig.set(pluginId, key, value);
    setConfigValues(prev => ({
      ...prev,
      [pluginId]: { ...prev[pluginId], [key]: value },
    }));
  }, []);

  // Reload plugins in the main window
  const handleReload = useCallback(() => {
    setIsReloading(true);
    window.readied.plugins.requestReload();
    setTimeout(() => setIsReloading(false), 800);
  }, []);

  // Install plugin from archive
  const handleInstall = useCallback(async () => {
    const result = await window.readied.plugins.install();
    if (result.success) {
      // Re-scan to pick up the new plugin
      const [scanned, stateList] = await Promise.all([
        window.readied.plugins.scan(),
        window.readied.plugins.listState(),
      ]);
      const stateMap = new Map(stateList.map(s => [s.pluginId, s.enabled]));
      setPlugins(
        scanned.map(sp => ({
          id: sp.id,
          name: sp.name,
          version: sp.version,
          description: sp.description,
          enabled: stateMap.get(sp.id) ?? true,
          configSchema: sp.configSchema,
        }))
      );
      // Trigger reload in main window
      window.readied.plugins.requestReload();
    }
  }, []);

  // Uninstall a community plugin
  const handleUninstall = useCallback(async (pluginId: string) => {
    const result = await window.readied.plugins.uninstall(pluginId);
    if (result.success) {
      setPlugins(prev => prev.filter(p => p.id !== pluginId));
      // Trigger reload in main window
      window.readied.plugins.requestReload();
    }
  }, []);

  // Open plugins folder
  const handleOpenFolder = useCallback(async () => {
    if (pluginsPath) {
      await window.readied.data.openFolder();
    }
  }, [pluginsPath]);

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Plugins</h2>

      {/* Built-in plugins */}
      <div style={{ marginTop: '2rem' }}>
        <div className={styles.pluginSectionLabel}>Built-in</div>
        <div className={styles.pluginCardList}>
          {BUILT_IN_PLUGINS.map(plugin => (
            <PluginCard
              key={plugin.id}
              name={plugin.name}
              version={plugin.version}
              description={plugin.description}
              isBuiltIn={true}
              enabled={true}
            />
          ))}
        </div>
      </div>

      {/* Community / installed plugins */}
      <div style={{ marginTop: '2rem' }}>
        <div className={styles.pluginSectionLabel}>Installed</div>
        {plugins.length === 0 ? (
          <div className={styles.pluginCard}>
            <div className={styles.pluginEmptyState}>
              <p>No community plugins installed yet.</p>
              {pluginsPath && (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={handleOpenFolder}
                >
                  <FolderOpen size={14} />
                  <span>Open Plugins Folder</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.pluginCardList}>
            {plugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                name={plugin.name}
                version={plugin.version}
                description={plugin.description}
                isBuiltIn={false}
                enabled={plugin.enabled}
                onToggle={enabled => handleToggle(plugin.id, enabled)}
                onUninstall={() => handleUninstall(plugin.id)}
                configSchema={plugin.configSchema}
                configValues={configValues[plugin.id]}
                onConfigChange={(key, value) => handleConfigChange(plugin.id, key, value)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div style={{ marginTop: '2rem' }}>
        <div className={styles.pluginActions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleInstall}
          >
            <Download size={14} />
            <span>Install from File</span>
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleReload}
            disabled={isReloading}
          >
            <RefreshCw size={14} className={isReloading ? styles.spinning : ''} />
            <span>{isReloading ? 'Reloading...' : 'Reload Plugins'}</span>
          </button>
          {pluginsPath && (
            <button type="button" className={styles.actionButton} onClick={handleOpenFolder}>
              <FolderOpen size={14} />
              <span>Open Plugins Folder</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
