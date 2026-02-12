import type { PluginManifest } from '../types';
import { assertValidManifest } from '../validation';

/**
 * Evaluate a user init.js script and return a validated PluginManifest.
 *
 * Unlike `loadPluginFromSource`, this does not enforce an expected ID —
 * the script self-identifies via its `id` export.
 *
 * The script must be a CommonJS module:
 * ```js
 * module.exports = {
 *   id: 'my-init',
 *   name: 'My Init Script',
 *   version: '1.0.0',
 *   activate(ctx) { ... },
 * };
 * ```
 *
 * Returns a validated PluginManifest or null on failure.
 */
export function loadInitScript(code: string): PluginManifest | null {
  try {
    const module = { exports: {} as Record<string, unknown> };

    const fn = new Function('module', 'exports', code);
    fn(module, module.exports);

    return assertValidManifest(module.exports, msg => console.warn(`[init.js] ${msg}`));
  } catch (error) {
    console.error('[init.js] Failed to evaluate user init script:', error);
    return null;
  }
}
