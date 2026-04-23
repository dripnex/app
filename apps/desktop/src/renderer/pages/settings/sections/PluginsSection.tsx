/**
 * Plugins Settings Section
 *
 * Card-based plugin manager showing built-in and community plugins
 * with enable/disable toggles, badges, and collapsible config forms.
 */

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  RefreshCw,
  FolderOpen,
  ChevronDown,
  Download,
  Trash2,
  Search,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { pluginRuntimeStore } from '../../../stores/pluginRuntimeStore';
import type { PluginConfigSchemaField } from '../../../../preload/index';
import { validateConfigValue } from '@readied/plugin-api';
import { Toggle, TextInput, NumberInput, RangeInput, Select } from '../components/controls';
import { builtInPlugins } from '../../../plugins';
import { Button, toast } from '../../../ui/primitives';
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
// Marketplace Data
// ============================================================================

const MARKETPLACE_API_URL = 'https://api.readied.app/plugins';

interface MarketplacePlugin {
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  icon: string;
  isBuiltIn: boolean;
  tags: string[];
  downloads: number;
  bundleUrl: string | null;
}

/** Static fallback catalog for offline use */
const FALLBACK_PLUGINS: MarketplacePlugin[] = [
  {
    slug: 'readied-ai-assistant',
    name: 'AI Assistant',
    description: 'AI assistant with RAG over your notes, powered by Claude',
    author: 'Readied',
    version: '0.1.0',
    category: 'productivity',
    icon: 'sparkles',
    isBuiltIn: true,
    tags: ['ai', 'rag', 'claude'],
    downloads: 0,
    bundleUrl: null,
  },
  {
    slug: 'readied-word-count',
    name: 'Word Count',
    description: 'Shows word, character, and line count in the editor status bar',
    author: 'Readied',
    version: '1.0.0',
    category: 'editor',
    icon: 'hash',
    isBuiltIn: true,
    tags: ['statistics', 'writing'],
    downloads: 0,
    bundleUrl: null,
  },
  {
    slug: 'readied-typewriter-mode',
    name: 'Typewriter Mode',
    description: 'Keeps the cursor line centered in the editor for a focused writing experience',
    author: 'Readied',
    version: '1.0.0',
    category: 'editor',
    icon: 'align-center',
    isBuiltIn: true,
    tags: ['writing', 'focus'],
    downloads: 0,
    bundleUrl: null,
  },
  {
    slug: 'readied-active-line-highlight',
    name: 'Active Line Highlight',
    description: 'Highlights the line where the cursor is positioned',
    author: 'Readied',
    version: '1.0.0',
    category: 'editor',
    icon: 'highlighter',
    isBuiltIn: true,
    tags: ['editor', 'highlight'],
    downloads: 0,
    bundleUrl: null,
  },
  {
    slug: 'readied-tables',
    name: 'Tables',
    description: 'Insert markdown tables with a command. Renders via GFM in preview.',
    author: 'Readied',
    version: '1.0.0',
    category: 'editor',
    icon: 'table',
    isBuiltIn: true,
    tags: ['tables', 'markdown'],
    downloads: 0,
    bundleUrl: null,
  },
  {
    slug: 'readied-focus-mode',
    name: 'Focus Mode',
    description: 'Dims all content except the current paragraph for focused writing',
    author: 'Readied',
    version: '1.0.0',
    category: 'productivity',
    icon: 'eye',
    isBuiltIn: true,
    tags: ['focus', 'writing', 'zen'],
    downloads: 0,
    bundleUrl: null,
  },
  {
    slug: 'readied-reading-time',
    name: 'Reading Time',
    description: 'Shows estimated reading time based on word count (~200 WPM)',
    author: 'Readied',
    version: '1.0.0',
    category: 'productivity',
    icon: 'clock',
    isBuiltIn: true,
    tags: ['reading', 'statistics'],
    downloads: 0,
    bundleUrl: null,
  },
  {
    slug: 'readied-export-markdown',
    name: 'Export Markdown',
    description: 'Copy notes as raw Markdown or rendered HTML to clipboard',
    author: 'Readied',
    version: '1.0.0',
    category: 'export',
    icon: 'copy',
    isBuiltIn: true,
    tags: ['export', 'markdown', 'html'],
    downloads: 0,
    bundleUrl: null,
  },
];

// ============================================================================
// BrowseTab
// ============================================================================

function BrowseTab({ installedPluginIds }: { installedPluginIds: Set<string> }) {
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseCategory, setBrowseCategory] = useState('All');
  const [marketplacePlugins, setMarketplacePlugins] =
    useState<MarketplacePlugin[]>(FALLBACK_PLUGINS);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  // Fetch plugins from API on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchPlugins() {
      setIsLoading(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(MARKETPLACE_API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as { plugins: MarketplacePlugin[]; total: number };
        if (!cancelled && data.plugins && Array.isArray(data.plugins)) {
          setMarketplacePlugins(data.plugins);
          setIsOffline(false);
        }
      } catch {
        // Offline or API error — fall back to static list
        if (!cancelled) {
          setMarketplacePlugins(FALLBACK_PLUGINS);
          setIsOffline(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void fetchPlugins();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => ['All', ...new Set(marketplacePlugins.map(p => p.category))],
    [marketplacePlugins]
  );

  const filteredMarketplace = useMemo(() => {
    let result = marketplacePlugins;
    if (browseCategory !== 'All') {
      result = result.filter(p => p.category === browseCategory);
    }
    if (browseSearch.trim()) {
      const q = browseSearch.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.includes(q))
      );
    }
    return result;
  }, [browseSearch, browseCategory, marketplacePlugins]);

  const handleInstallFromUrl = useCallback(async (plugin: MarketplacePlugin) => {
    if (!plugin.bundleUrl) {
      toast.error('This plugin has no download URL');
      return;
    }

    setInstallingSlug(plugin.slug);
    try {
      const result = await window.readied.plugins.installFromUrl(plugin.bundleUrl, plugin.slug);
      if (result.success) {
        toast.success(`${plugin.name} installed successfully`);
        // Trigger a reload so the installed tab picks it up
        window.readied.plugins.requestReload();
        // Notify parent to re-scan installed plugins
        window.dispatchEvent(new CustomEvent('readied:plugins:refresh'));
      } else {
        toast.error(`Failed to install ${plugin.name}: ${result.error ?? 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(
        'Failed to install plugin: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setInstallingSlug(null);
    }
  }, []);

  return (
    <>
      {/* Offline notice */}
      {isOffline && (
        <div className={styles.pluginOfflineNotice}>
          <AlertTriangle size={14} />
          <span>Offline — showing built-in plugins only</span>
        </div>
      )}

      {/* Search */}
      <div className={styles.pluginSearchWrapper}>
        <Search size={14} className={styles.pluginSearchIcon} />
        <input
          type="text"
          className={styles.pluginSearchInput}
          placeholder="Search marketplace..."
          value={browseSearch}
          onChange={e => setBrowseSearch(e.target.value)}
        />
      </div>

      {/* Category pills */}
      <div className={styles.pluginCategoryPills}>
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            className={`${styles.pluginCategoryPill} ${browseCategory === cat ? styles.pluginCategoryPillActive : ''}`}
            onClick={() => setBrowseCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className={styles.pluginBrowsePlaceholder}>
          <RefreshCw size={24} className={styles.pluginSpinner} />
          <p>Loading marketplace...</p>
        </div>
      ) : filteredMarketplace.length > 0 ? (
        <div className={styles.pluginMarketplaceGrid}>
          {filteredMarketplace.map(plugin => {
            const isInstalled = installedPluginIds.has(plugin.slug);
            const isInstalling = installingSlug === plugin.slug;

            return (
              <div key={plugin.slug} className={styles.pluginMarketplaceCard}>
                <div className={styles.pluginMarketplaceCardHeader}>
                  <span className={styles.pluginMarketplaceIcon}>{plugin.icon}</span>
                  <div className={styles.pluginMarketplaceCardInfo}>
                    <span className={styles.pluginName}>{plugin.name}</span>
                    <span className={styles.pluginMarketplaceMeta}>
                      {plugin.author} &middot; v{plugin.version}
                      {plugin.downloads > 0 && (
                        <> &middot; {plugin.downloads.toLocaleString()} downloads</>
                      )}
                    </span>
                  </div>
                </div>
                <p className={styles.pluginDescription}>{plugin.description}</p>
                <div className={styles.pluginMarketplaceCardFooter}>
                  <div className={styles.pluginMarketplaceTags}>
                    {plugin.tags.slice(0, 3).map(tag => (
                      <span key={tag} className={styles.pluginMarketplaceTag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  {plugin.isBuiltIn ? (
                    <span className={styles.pluginMarketplaceIncluded}>
                      <Check size={12} />
                      Included
                    </span>
                  ) : isInstalled ? (
                    <span className={styles.pluginMarketplaceIncluded}>
                      <Check size={12} />
                      Installed
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.pluginMarketplaceInstallBtn}
                      disabled={isInstalling || !plugin.bundleUrl}
                      onClick={() => handleInstallFromUrl(plugin)}
                    >
                      {isInstalling ? (
                        <>
                          <RefreshCw size={12} className={styles.pluginSpinner} />
                          Installing...
                        </>
                      ) : (
                        <>
                          <Download size={12} />
                          Install
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.pluginBrowsePlaceholder}>
          <Search size={32} />
          <h3>No plugins found</h3>
          <p>Try a different search term or category.</p>
        </div>
      )}
    </>
  );
}

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
            <span className={`${styles.pluginBadge} ${isBuiltIn ? styles.pluginBadgeBuiltIn : ''}`}>
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
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

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
// PluginInspector (dev mode only)
// ============================================================================

function PluginInspector() {
  const [open, setOpen] = useState(false);

  const status = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().status
  );
  const errors = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().errors
  );
  const timings = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().timings
  );
  const pluginCount = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().plugins.length
  );

  const handleForceReload = useCallback(() => {
    window.readied.plugins.requestReload();
  }, []);

  return (
    <div className={styles.inspectorPanel}>
      <button
        type="button"
        className={styles.inspectorToggle}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-controls="plugin-inspector-panel"
      >
        <ChevronDown
          size={14}
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
          }}
        />
        <span>Developer</span>
        {errors.length > 0 && (
          <span className={styles.inspectorErrorBadge}>
            <AlertTriangle size={12} />
            {errors.length}
          </span>
        )}
      </button>

      {open && (
        <div id="plugin-inspector-panel" role="region" className={styles.inspectorContent}>
          <div className={styles.inspectorRow}>
            <span className={styles.inspectorLabel}>Status</span>
            <span>{status === 'scanning' ? 'Scanning...' : `${pluginCount} loaded`}</span>
          </div>

          {timings.length > 0 && (
            <div className={styles.inspectorTimings}>
              <div className={styles.inspectorLabel}>Load times</div>
              <table className={styles.inspectorTable}>
                <thead>
                  <tr>
                    <th>Plugin</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {timings.map(t => (
                    <tr key={t.pluginId}>
                      <td>{t.pluginName}</td>
                      <td>{t.loadTimeMs < 1 ? '<1' : Math.round(t.loadTimeMs)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errors.length > 0 && (
            <div className={styles.inspectorErrors}>
              <div className={styles.inspectorLabel}>Errors</div>
              {errors.map(err => (
                <div key={err.pluginId} className={styles.inspectorError}>
                  <strong>{err.pluginName}</strong>
                  <span>{err.reason}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={handleForceReload}
            >
              Force Reload All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PluginsSection
// ============================================================================

export function PluginsSection() {
  const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('installed');
  const [search, setSearch] = useState('');
  const [plugins, setPlugins] = useState<DiscoveredPluginInfo[]>([]);
  const [pluginsPath, setPluginsPath] = useState('');
  const [isReloading, setIsReloading] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, Record<string, unknown>>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for plugin install events from BrowseTab
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('readied:plugins:refresh', handler);
    return () => window.removeEventListener('readied:plugins:refresh', handler);
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
        const pluginList = scanned.map(sp => ({
          id: sp.id,
          name: sp.name,
          version: sp.version,
          description: sp.description,
          enabled: stateMap.get(sp.id) ?? true,
          configSchema: sp.configSchema,
        }));
        setPlugins(pluginList);

        // Load config values for all plugins with schemas (built-in + community)
        const configs: Record<string, Record<string, unknown>> = {};

        // Built-in plugins with config schemas
        for (const bp of builtInPlugins) {
          if (bp.configSchema) {
            try {
              const allConfig = await window.readied.pluginConfig.getAll(bp.id);
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
    void loadPlugins();
  }, [refreshKey]);

  // Toggle plugin enabled/disabled
  const handleToggle = useCallback(async (pluginId: string, enabled: boolean) => {
    try {
      await window.readied.plugins.setEnabled(pluginId, enabled);
      setPlugins(prev => prev.map(p => (p.id === pluginId ? { ...p, enabled } : p)));
      // Trigger reload in main window so preview updates immediately
      window.readied.plugins.requestReload();
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

      await window.readied.pluginConfig.set(pluginId, key, value);
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
    window.readied.plugins.requestReload();
    setTimeout(() => setIsReloading(false), 800);
  }, []);

  // Install plugin from archive
  const handleInstall = useCallback(async () => {
    try {
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
        toast.success('Plugin installed successfully');
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
      const result = await window.readied.plugins.uninstall(pluginId);
      if (result.success) {
        setPlugins(prev => prev.filter(p => p.id !== pluginId));
        // Trigger reload in main window
        window.readied.plugins.requestReload();
        toast.success('Plugin uninstalled successfully');
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
      await window.readied.data.openFolder();
    }
  }, [pluginsPath]);

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

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Plugins</h2>

      {/* Tab bar */}
      <div className={styles.pluginTabs}>
        <button
          type="button"
          className={`${styles.pluginTab} ${activeTab === 'installed' ? styles.pluginTabActive : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          Installed
        </button>
        <button
          type="button"
          className={`${styles.pluginTab} ${activeTab === 'browse' ? styles.pluginTabActive : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse
        </button>
      </div>

      {activeTab === 'installed' && (
        <>
          {/* Search */}
          <div className={styles.pluginSearchWrapper}>
            <Search size={14} className={styles.pluginSearchIcon} />
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
                  enabled={true}
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
              <div className={styles.pluginCard}>
                <div className={styles.pluginEmptyState}>
                  <p>No community plugins installed yet.</p>
                  {pluginsPath && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FolderOpen size={14} />}
                      onClick={handleOpenFolder}
                    >
                      Open Plugins Folder
                    </Button>
                  )}
                </div>
              </div>
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
                icon={<Download size={14} />}
                onClick={handleInstall}
              >
                Install from File
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={14} />}
                loading={isReloading}
                onClick={handleReload}
              >
                {isReloading ? 'Reloading...' : 'Reload Plugins'}
              </Button>
              {pluginsPath && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FolderOpen size={14} />}
                  onClick={handleOpenFolder}
                >
                  Open Plugins Folder
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'browse' && (
        <BrowseTab
          installedPluginIds={
            new Set([
              ...BUILT_IN_PLUGIN_INFOS.map(p => p.id),
              ...plugins.map(p => p.id),
              // Include slugified IDs so marketplace slug-based comparison works
              ...plugins.map(p => p.name.toLowerCase().replace(/\s+/g, '-')),
            ])
          }
        />
      )}

      {import.meta.env.DEV && <PluginInspector />}
    </div>
  );
}
