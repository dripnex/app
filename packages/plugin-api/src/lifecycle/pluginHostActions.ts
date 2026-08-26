import type { PluginManifest } from '../types';
import { sortPlugins, type SortResult } from './sortPlugins';

export interface PluginHostActions {
  unload: string[];
  activate: PluginManifest[];
}

export interface PluginHostPlan extends PluginHostActions {
  skipped: SortResult['skipped'];
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

/**
 * Sort the full desired set first so already-active deps are visible, then
 * diff. `sortPlugins(activate)` would skip a new extension whose base is
 * already running, and would leave an extension loaded after its base left.
 */
export function planPluginHostSync(
  loadedIds: readonly string[],
  activeIds: readonly string[],
  nextPlugins: readonly PluginManifest[]
): PluginHostPlan {
  const { sorted, skipped } = sortPlugins([...nextPlugins]);
  const { unload, activate } = nextPluginHostActions(loadedIds, activeIds, sorted);
  return { unload, activate, skipped };
}
