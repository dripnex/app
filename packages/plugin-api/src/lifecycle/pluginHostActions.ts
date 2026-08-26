import type { PluginManifest } from '../types';

export interface PluginHostActions {
  unload: string[];
  activate: PluginManifest[];
}

/**
 * Incremental PluginHost sync. Adding a pack must not unload every plugin
 * (that remount raced theme activation and exited Linux AppImage).
 */
export function nextPluginHostActions(
  loadedIds: readonly string[],
  activeIds: readonly string[],
  nextPlugins: readonly PluginManifest[]
): PluginHostActions {
  const wanted = new Set(nextPlugins.map(p => p.id));
  const active = new Set(activeIds);
  return {
    unload: loadedIds.filter(id => !wanted.has(id)),
    activate: nextPlugins.filter(p => wanted.has(p.id) && !active.has(p.id)),
  };
}
