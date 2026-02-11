import { useState, useEffect } from 'react';
import type { PluginManifest } from '@readied/plugin-api';
import { loadPluginFromSource } from '@readied/plugin-api';

/**
 * Scans for filesystem plugins on mount, filters by enabled state,
 * evaluates JS source, and returns loaded PluginManifest[].
 */
export function useDiscoveredPlugins(): PluginManifest[] {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);

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
        for (const sp of scanned) {
          const enabled = stateMap.get(sp.id) ?? true;
          if (!enabled) continue;

          const manifest = loadPluginFromSource(sp.code, sp.id);
          if (manifest) {
            loaded.push(manifest);
          }
        }

        if (!cancelled) {
          setPlugins(loaded);
        }
      } catch (error) {
        console.error('[useDiscoveredPlugins] Failed to discover plugins:', error);
      }
    }

    discover();

    return () => {
      cancelled = true;
    };
  }, []);

  return plugins;
}
