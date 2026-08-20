/**
 * Plugins Settings Section
 *
 * Card-based plugin manager showing built-in and community plugins
 * with enable/disable toggles, badges, and collapsible config forms.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, FolderOpen, Download, Search, FileCode, Palette } from 'lucide';
import { validateConfigValue } from '@dripnex/plugin-api';
import { Icon } from '../../../../ui/icons/Icon';
import type { PluginConfigSchemaField } from '../../../../../preload/index';
import { builtInPlugins } from '../../../../plugins';
import { Button, toast } from '../../../../ui/primitives';
import { SettingGroup } from '../../components/SettingGroup';
import { SettingRow } from '../../components/SettingRow';
import { SettingsCard } from '../../components/SettingsCard';
import { SettingsPage } from '../../components/SettingsPage';
import styles from './Plugins.module.css';
import type { DiscoveredPluginInfo, BuiltInPluginInfo } from './types';
import { PluginCard } from './PluginCard';
import { BrowseTab } from './BrowseTab';
import { UpdatesTab } from './UpdatesTab';
import { PluginInspector } from './PluginInspector';

// ============================================================================
// Constants — derived from runtime plugin manifests
// ============================================================================

const BUILT_IN_PLUGIN_INFOS: BuiltInPluginInfo[] = builtInPlugins.map(p => ({
  id: p.id,
  name: p.name,
  version: p.version,
  description: p.description ?? '',
}));

/** Config schemas for built-in plugins that have them */
const BUILT_IN_CONFIG_SCHEMAS: Record<string, Record<string, PluginConfigSchemaField> | undefined> =
  Object.fromEntries(
    builtInPlugins
      .filter(p => p.configSchema)
      .map(p => [p.id, p.configSchema as Record<string, PluginConfigSchemaField>])
  );

// ============================================================================
// PluginsSection
// ============================================================================

export type PluginsPane = 'installed' | 'install' | 'updates';

export function PluginsSection({ pane = 'installed' }: { pane?: PluginsPane }) {
  const [search, setSearch] = useState('');
  const [plugins, setPlugins] = useState<DiscoveredPluginInfo[]>([]);
  const [pluginsPath, setPluginsPath] = useState('');
  const [isReloading, setIsReloading] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, Record<string, unknown>>>({});
  const [builtInEnabled, setBuiltInEnabled] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for plugin install events from BrowseTab
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('dripnex:plugins:refresh', handler);
    return () => window.removeEventListener('dripnex:plugins:refresh', handler);
  }, []);

  // Load discovered plugins
  useEffect(() => {
    async function loadPlugins() {
      try {
        const [scanned, stateList, paths] = await Promise.all([
          window.dripnex.plugins.scan(),
          window.dripnex.plugins.listState(),
          window.dripnex.data.paths(),
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

        // Load built-in plugin enabled states from DB
        const builtInStates: Record<string, boolean> = {};
        for (const bp of builtInPlugins) {
          builtInStates[bp.id] = stateMap.get(bp.id) ?? true;
        }
        setBuiltInEnabled(builtInStates);

        // Load config values for all plugins with schemas (built-in + community)
        const configs: Record<string, Record<string, unknown>> = {};

        // Built-in plugins with config schemas
        for (const bp of builtInPlugins) {
          if (bp.configSchema) {
            try {
              const allConfig = await window.dripnex.pluginConfig.getAll(bp.id);
              configs[bp.id] = allConfig;
            } catch {
              configs[bp.id] = {};
            }
          }
        }

        // Community plugins with config schemas
        for (const plugin of pluginList) {
          if (plugin.configSchema && plugin.enabled) {
            try {
              const allConfig = await window.dripnex.pluginConfig.getAll(plugin.id);
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
    void loadPlugins();
  }, [refreshKey]);

  // Toggle plugin enabled/disabled (works for both built-in and community)
  const handleToggle = useCallback(async (pluginId: string, enabled: boolean) => {
    try {
      await window.dripnex.plugins.setEnabled(pluginId, enabled);
      // Update community plugins state
      setPlugins(prev => prev.map(p => (p.id === pluginId ? { ...p, enabled } : p)));
      // Update built-in plugins state
      setBuiltInEnabled(prev => ({ ...prev, [pluginId]: enabled }));
      // Trigger reload in main window so preview updates immediately
      window.dripnex.plugins.requestReload();
      toast.success(`Plugin ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error(
        'Failed to update plugin: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }, []);

  // Update a plugin config value
  const handleConfigChange = useCallback(
    async (pluginId: string, key: string, value: unknown) => {
      // Find the schema field for validation
      const schema =
        BUILT_IN_CONFIG_SCHEMAS[pluginId] ?? plugins.find(p => p.id === pluginId)?.configSchema;
      const field = schema?.[key];

      if (!field) {
        console.warn(`[plugin:${pluginId}] Unknown config key "${key}", ignoring`);
        return;
      }

      const result = validateConfigValue(field, value);
      if (!result.valid) {
        console.warn(`[plugin:${pluginId}] Invalid config value for "${key}": ${result.reason}`);
        return;
      }

      await window.dripnex.pluginConfig.set(pluginId, key, value);
      setConfigValues(prev => ({
        ...prev,
        [pluginId]: { ...prev[pluginId], [key]: value },
      }));
    },
    [plugins]
  );

  // Reload plugins in the main window
  const handleReload = useCallback(() => {
    setIsReloading(true);
    window.dripnex.plugins.requestReload();
    setTimeout(() => setIsReloading(false), 800);
  }, []);

  // Install plugin from archive
  const handleInstall = useCallback(async () => {
    try {
      const result = await window.dripnex.plugins.install();
      if (result.success) {
        // Re-scan to pick up the new plugin
        const [scanned, stateList] = await Promise.all([
          window.dripnex.plugins.scan(),
          window.dripnex.plugins.listState(),
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
        window.dripnex.plugins.requestReload();
        toast.success('Plugin installed successfully');
      } else {
        toast.error(result.error || 'Failed to install plugin');
      }
    } catch (error) {
      toast.error(
        'Failed to install plugin: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }, []);

  // Uninstall a community plugin
  const handleUninstall = useCallback(async (pluginId: string) => {
    try {
      const result = await window.dripnex.plugins.uninstall(pluginId);
      if (result.success) {
        setPlugins(prev => prev.filter(p => p.id !== pluginId));
        // Trigger reload in main window
        window.dripnex.plugins.requestReload();
        toast.success('Plugin uninstalled successfully');
      } else {
        toast.error(result.error || 'Failed to uninstall plugin');
      }
    } catch (error) {
      toast.error(
        'Failed to uninstall plugin: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }, []);

  // Open plugins folder
  const handleOpenFolder = useCallback(async () => {
    if (pluginsPath) {
      await window.dripnex.data.openFolder();
    }
  }, [pluginsPath]);

  const handleOpenUserFile = useCallback(async (kind: 'init' | 'styles' | 'keymap') => {
    try {
      const result = await window.dripnex.plugins.openUserFile(kind);
      if (!result.success) {
        toast.error(result.error || `Failed to open ${kind === 'init' ? 'init.js' : 'styles.css'}`);
        return;
      }
      if (kind === 'init') {
        window.dripnex.plugins.requestReload();
      }
    } catch (error) {
      toast.error(
        'Failed to open file: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }, []);

  // Filter plugins by search query
  const lowerSearch = search.toLowerCase();
  const filteredBuiltIn = useMemo(
    () =>
      lowerSearch
        ? BUILT_IN_PLUGIN_INFOS.filter(
            p =>
              p.name.toLowerCase().includes(lowerSearch) ||
              p.description.toLowerCase().includes(lowerSearch)
          )
        : BUILT_IN_PLUGIN_INFOS,
    [lowerSearch]
  );
  const filteredCommunity = useMemo(
    () =>
      lowerSearch
        ? plugins.filter(
            p =>
              p.name.toLowerCase().includes(lowerSearch) ||
              (p.description ?? '').toLowerCase().includes(lowerSearch)
          )
        : plugins,
    [lowerSearch, plugins]
  );

  const page =
    pane === 'install'
      ? {
          title: 'Install',
          lede: 'Community plugins are their own git repos. Click Install to fetch the release tarball.',
        }
      : pane === 'updates'
        ? {
            title: 'Updates',
            lede: 'Community plugins whose registry version is newer than the one on disk. Built-ins ship with the app.',
          }
        : {
            title: 'Plugins',
            lede: 'Built-ins ship in the app. Community plugins are their own git repos — Install from the nested page.',
          };

  return (
    <SettingsPage title={page.title} lede={page.lede}>
      {pane === 'installed' && (
        <>
          <SettingGroup title="Customize">
            <SettingRow
              label="Init script"
              description="JavaScript that runs on load. Register commands, listen to notes, extend the editor."
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon={FileCode} size={14} />}
                onClick={() => void handleOpenUserFile('init')}
              >
                Open init.js
              </Button>
            </SettingRow>
            <SettingRow
              label="User stylesheet"
              description="CSS applied on top of the app. Save the file — changes apply immediately."
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon={Palette} size={14} />}
                onClick={() => void handleOpenUserFile('styles')}
              >
                Open styles.css
              </Button>
            </SettingRow>
          </SettingGroup>

          {/* Search */}
          <div className={styles.pluginSearchWrapper}>
            <Icon icon={Search} size={14} className={styles.pluginSearchIcon} />
            <input
              type="text"
              className={styles.pluginSearchInput}
              placeholder="Search plugins..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Built-in plugins */}
          <div style={{ marginTop: '1rem' }}>
            <div className={styles.pluginSectionLabel}>Built-in</div>
            <div className={styles.pluginCardList}>
              {filteredBuiltIn.map(plugin => (
                <PluginCard
                  key={plugin.id}
                  name={plugin.name}
                  version={plugin.version}
                  description={plugin.description}
                  isBuiltIn={true}
                  enabled={builtInEnabled[plugin.id] ?? true}
                  onToggle={enabled => handleToggle(plugin.id, enabled)}
                  configSchema={BUILT_IN_CONFIG_SCHEMAS[plugin.id]}
                  configValues={configValues[plugin.id]}
                  onConfigChange={(key, value) => handleConfigChange(plugin.id, key, value)}
                />
              ))}
              {filteredBuiltIn.length === 0 && search && (
                <div className={styles.pluginEmptyState}>
                  <p>No built-in plugins match &ldquo;{search}&rdquo;</p>
                </div>
              )}
            </div>
          </div>

          {/* Community / installed plugins */}
          <div style={{ marginTop: '1.5rem' }}>
            <div className={styles.pluginSectionLabel}>Community</div>
            {filteredCommunity.length === 0 && !search ? (
              <SettingsCard flush>
                <div className={styles.pluginEmptyState}>
                  <p>No community plugins installed yet.</p>
                  {pluginsPath && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon={FolderOpen} size={14} />}
                      onClick={handleOpenFolder}
                    >
                      Open Plugins Folder
                    </Button>
                  )}
                </div>
              </SettingsCard>
            ) : filteredCommunity.length === 0 && search ? (
              <div className={styles.pluginEmptyState}>
                <p>No community plugins match &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <div className={styles.pluginCardList}>
                {filteredCommunity.map(plugin => (
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
          <div style={{ marginTop: '1.5rem' }}>
            <div className={styles.pluginActions}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon={Download} size={14} />}
                onClick={handleInstall}
              >
                Install from File
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon={RefreshCw} size={14} />}
                loading={isReloading}
                onClick={handleReload}
              >
                {isReloading ? 'Reloading...' : 'Reload Plugins'}
              </Button>
              {pluginsPath && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon={FolderOpen} size={14} />}
                  onClick={handleOpenFolder}
                >
                  Open Plugins Folder
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {pane === 'install' && <BrowseTab />}

      {pane === 'updates' && <UpdatesTab />}

      {import.meta.env.DEV && <PluginInspector />}
    </SettingsPage>
  );
}
