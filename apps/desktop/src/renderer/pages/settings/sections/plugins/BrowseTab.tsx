/**
 * BrowseTab — Marketplace browse tab with fetch, search, filter, and install.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Download, Search, Check, AlertTriangle } from 'lucide-react';
import { toast } from '../../../../ui/primitives';
import type { MarketplacePlugin } from './types';
import styles from '../Section.module.css';

// ============================================================================
// Constants
// ============================================================================

const MARKETPLACE_API_URL = 'https://api.readied.app/plugins';

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
// Component
// ============================================================================

interface BrowseTabProps {
  installedPluginIds: Set<string>;
}

export function BrowseTab({ installedPluginIds }: BrowseTabProps) {
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
          // Validate each item has required fields
          const validated = data.plugins.filter(
            (p): p is MarketplacePlugin =>
              typeof p.slug === 'string' &&
              typeof p.name === 'string' &&
              typeof p.description === 'string' &&
              Array.isArray(p.tags)
          );
          setMarketplacePlugins(validated);
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
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some(t => t.includes(q))
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
