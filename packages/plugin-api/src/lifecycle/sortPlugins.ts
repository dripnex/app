/**
 * Plugin Dependency Resolver
 *
 * Topological sort for plugins based on their `dependencies` field.
 * Plugins without dependencies come first, then plugins whose
 * dependencies are all satisfied.
 *
 * Missing dependencies cause a warning and the plugin is skipped.
 * Circular dependencies cause a warning and the cycle is broken.
 */

import type { PluginManifest } from '../types';

export interface SortResult {
  /** Plugins in activation order (dependencies first) */
  sorted: PluginManifest[];
  /** Plugins skipped due to missing dependencies */
  skipped: Array<{ plugin: PluginManifest; missingDeps: string[] }>;
}

/**
 * Sort plugins in dependency order using Kahn's algorithm (topological sort).
 * Plugins with no dependencies come first.
 */
export function sortPlugins(plugins: PluginManifest[]): SortResult {
  const byId = new Map(plugins.map(p => [p.id, p]));
  const skipped: SortResult['skipped'] = [];

  // Build adjacency: for each plugin, which plugins depend on it?
  // inDegree: how many unsatisfied deps each plugin has
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // depId → [pluginIds that need it]

  // First pass: check for missing deps
  const valid = new Map<string, PluginManifest>();

  for (const plugin of plugins) {
    const deps = plugin.dependencies ? Object.keys(plugin.dependencies) : [];
    const missing = deps.filter(d => !byId.has(d));

    if (missing.length > 0) {
      skipped.push({ plugin, missingDeps: missing });
      continue;
    }

    valid.set(plugin.id, plugin);
  }

  // Propagate: skip plugins whose deps were themselves skipped
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, plugin] of valid) {
      const deps = plugin.dependencies ? Object.keys(plugin.dependencies) : [];
      const missing = deps.filter(d => !valid.has(d));
      if (missing.length > 0) {
        valid.delete(id);
        skipped.push({ plugin, missingDeps: missing });
        changed = true;
      }
    }
  }

  // Build adjacency from valid plugins only
  for (const [, plugin] of valid) {
    const deps = plugin.dependencies ? Object.keys(plugin.dependencies) : [];
    inDegree.set(plugin.id, deps.length);

    for (const dep of deps) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(plugin.id);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: PluginManifest[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const plugin = valid.get(id);
    if (!plugin) continue;

    sorted.push(plugin);

    // Reduce in-degree of dependents
    const deps = dependents.get(id) ?? [];
    for (const depId of deps) {
      const newDegree = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, newDegree);
      if (newDegree === 0) queue.push(depId);
    }
  }

  // Any valid plugin not in sorted has a circular dependency — add anyway with warning
  for (const [id, plugin] of valid) {
    if (!sorted.includes(plugin)) {
      console.warn(`[plugin:${id}] Circular dependency detected, loading anyway`);
      sorted.push(plugin);
    }
  }

  return { sorted, skipped };
}
