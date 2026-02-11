import type { PluginManifest } from '../types';
import { assertValidManifest } from '../validation';

/**
 * Evaluate a CommonJS plugin source string in the renderer.
 *
 * The plugin must be a pre-bundled CommonJS module that assigns to module.exports:
 * ```js
 * module.exports = { id, name, version, activate(ctx) { ... } };
 * ```
 *
 * Returns a validated PluginManifest or null on failure.
 */
export function loadPluginFromSource(code: string, expectedId: string): PluginManifest | null {
  try {
    const module = { exports: {} as Record<string, unknown> };
    // eslint-disable-next-line no-new-func
    const fn = new Function('module', 'exports', code);
    fn(module, module.exports);

    const manifest = module.exports;

    // Validate the manifest using existing validator
    const validated = assertValidManifest(manifest, (msg) =>
      console.warn(`[plugin-loader:${expectedId}] ${msg}`)
    );

    if (!validated) return null;

    // Verify ID matches what we expected from the filesystem manifest
    if (validated.id !== expectedId) {
      console.warn(
        `[plugin-loader] ID mismatch: manifest.json says "${expectedId}" but module exports "${validated.id}"`
      );
      return null;
    }

    return validated;
  } catch (error) {
    console.error(`[plugin-loader:${expectedId}] Failed to evaluate plugin source:`, error);
    return null;
  }
}
