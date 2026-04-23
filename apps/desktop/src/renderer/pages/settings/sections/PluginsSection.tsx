/**
 * Plugins Settings Section — barrel re-export.
 *
 * The implementation has been split into focused modules under ./plugins/:
 *   - PluginCard.tsx     — Individual plugin card with toggle, config, uninstall
 *   - BrowseTab.tsx      — Marketplace browse tab (fetch, search, filter, install)
 *   - PluginInspector.tsx — Developer debug panel (errors, timings)
 *   - index.tsx           — Main PluginsSection composing the above
 */

export { PluginsSection } from './plugins';
