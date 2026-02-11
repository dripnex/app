/**
 * Plugins Settings Section
 *
 * Lists discovered filesystem plugins with enable/disable toggles,
 * a reload button to apply changes without restarting,
 * and auto-generated config forms from configSchema.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FolderOpen } from 'lucide-react';
import type { PluginConfigSchemaField } from '../../../../preload/index';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Toggle, TextInput, NumberInput } from '../components/controls';
import styles from './Section.module.css';

interface DiscoveredPluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  configSchema?: Record<string, PluginConfigSchemaField>;
}

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

  // Open plugins folder
  const handleOpenFolder = useCallback(async () => {
    if (pluginsPath) {
      await window.readied.data.openFolder();
    }
  }, [pluginsPath]);

  // Get the effective value for a config field (stored value or schema default)
  const getConfigValue = (pluginId: string, key: string, field: PluginConfigSchemaField) => {
    const stored = configValues[pluginId]?.[key];
    return stored !== undefined ? stored : field.default;
  };

  // Plugins that have configSchema and are enabled
  const configurablePlugins = plugins.filter(
    p => p.enabled && p.configSchema && Object.keys(p.configSchema).length > 0
  );

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Plugins</h2>

      {plugins.length === 0 ? (
        <SettingGroup title="Installed Plugins">
          <p className={styles.placeholder}>
            No plugins installed.{pluginsPath ? ` Place plugins in ${pluginsPath}` : ''}
          </p>
          {pluginsPath && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleOpenFolder}
              style={{ marginTop: '0.75rem' }}
            >
              <FolderOpen size={14} />
              <span>Open Plugins Folder</span>
            </button>
          )}
        </SettingGroup>
      ) : (
        <>
          <SettingGroup title="Installed Plugins">
            {plugins.map(plugin => (
              <SettingRow
                key={plugin.id}
                label={`${plugin.name} v${plugin.version}`}
                description={plugin.description}
                htmlFor={`plugin-${plugin.id}`}
              >
                <Toggle
                  id={`plugin-${plugin.id}`}
                  checked={plugin.enabled}
                  onChange={checked => handleToggle(plugin.id, checked)}
                />
              </SettingRow>
            ))}
          </SettingGroup>

          {/* Config forms for plugins with configSchema */}
          {configurablePlugins.map(plugin => (
            <SettingGroup key={plugin.id} title={`${plugin.name} Settings`}>
              {Object.entries(plugin.configSchema!).map(([key, field]) => {
                const value = getConfigValue(plugin.id, key, field);
                const fieldId = `plugin-config-${plugin.id}-${key}`;
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                return (
                  <SettingRow
                    key={key}
                    label={label}
                    description={field.description}
                    htmlFor={fieldId}
                  >
                    {field.type === 'boolean' && (
                      <Toggle
                        id={fieldId}
                        checked={value as boolean}
                        onChange={checked => handleConfigChange(plugin.id, key, checked)}
                      />
                    )}
                    {field.type === 'string' && (
                      <TextInput
                        id={fieldId}
                        value={(value as string) ?? ''}
                        onChange={v => handleConfigChange(plugin.id, key, v)}
                      />
                    )}
                    {field.type === 'number' && (
                      <NumberInput
                        id={fieldId}
                        value={(value as number) ?? 0}
                        onChange={v => handleConfigChange(plugin.id, key, v)}
                      />
                    )}
                  </SettingRow>
                );
              })}
            </SettingGroup>
          ))}

          <SettingGroup title="Actions">
            <SettingRow
              label="Reload Plugins"
              description="Apply plugin changes without restarting the app"
            >
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleReload}
                disabled={isReloading}
              >
                <RefreshCw size={14} className={isReloading ? styles.spinning : ''} />
                <span>{isReloading ? 'Reloading...' : 'Reload'}</span>
              </button>
            </SettingRow>
            {pluginsPath && (
              <SettingRow label="Open Plugins Folder" description={pluginsPath}>
                <button type="button" className={styles.actionButton} onClick={handleOpenFolder}>
                  <FolderOpen size={14} />
                  <span>Open Folder</span>
                </button>
              </SettingRow>
            )}
          </SettingGroup>
        </>
      )}
    </div>
  );
}
