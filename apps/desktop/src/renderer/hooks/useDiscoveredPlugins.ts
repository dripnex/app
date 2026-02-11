import { useState, useEffect } from 'react';
import type { PluginManifest } from '@readied/plugin-api';
import { loadPluginFromSource } from '@readied/plugin-api';

export interface PluginLoadError {
  pluginId: string;
  pluginName: string;
  reason: string;
}

export interface DiscoveredPluginsResult {
  plugins: PluginManifest[];
  errors: PluginLoadError[];
}

/**
 * Scans for filesystem plugins on mount, filters by enabled state,
 * evaluates JS source, and returns loaded PluginManifest[] + any errors.
 * Listens for 'plugins:reload' IPC event to re-scan (e.g. from settings window).
 */
export function useDiscoveredPlugins(): DiscoveredPluginsResult {
  const [result, setResult] = useState<DiscoveredPluginsResult>({ plugins: [], errors: [] });
  const [reloadKey, setReloadKey] = useState(0);

  // Listen for cross-window reload requests
  useEffect(() => {
    const removeListener = window.readied.ipc.on('plugins:reload', () => {
      setReloadKey(k => k + 1);
    });
    return removeListener;
  }, []);

  // Scan and load plugins whenever reloadKey changes
  useEffect(() => {
    let cancelled = false;

    async function discover() {
      try {
        const [scanned, stateList] = await Promise.all([
          window.readied.plugins.scan(),
          window.readied.plugins.listState(),
        ]);

        if (cancelled) return;

        // Build a map of pluginId → enabled (no row = enabled by default)
        const stateMap = new Map(stateList.map(s => [s.pluginId, s.enabled]));

        const loaded: PluginManifest[] = [];
        const errors: PluginLoadError[] = [];

        for (const sp of scanned) {
          const enabled = stateMap.get(sp.id) ?? true;
          if (!enabled) continue;

          const manifest = loadPluginFromSource(sp.code, sp.id);
          if (manifest) {
            loaded.push(manifest);
          } else {
            errors.push({
              pluginId: sp.id,
              pluginName: sp.name,
              reason: 'Failed to load plugin code',
            });
          }
        }

        if (!cancelled) {
          setResult({ plugins: loaded, errors });
        }
      } catch (error) {
        console.error('[useDiscoveredPlugins] Failed to discover plugins:', error);
      }
    }

    discover();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return result;
}
