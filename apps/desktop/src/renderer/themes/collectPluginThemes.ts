import {
  loadPluginFromSource,
  type PluginContext,
  type ThemeDefinition,
} from '@dripnex/plugin-api';

/**
 * Call activate() with a stub context and collect registerTheme() palettes.
 *
 * Settings has no PluginHost, and satellite packs (dripnex/theme-dune, …)
 * ship dist/index.js that registers in activate() — they do not ship theme.json.
 */
export function collectThemesFromPluginCode(
  code: string,
  pluginId: string,
  options?: { require?: (id: string) => unknown }
): ThemeDefinition[] {
  if (!code.trim()) return [];

  let manifest;
  try {
    manifest = loadPluginFromSource(code, pluginId, options);
  } catch {
    return [];
  }
  if (!manifest) return [];

  const collected: ThemeDefinition[] = [];
  const registerTheme: PluginContext['registerTheme'] = theme => {
    collected.push({ ...theme, pluginId });
    return () => {};
  };

  try {
    const disposable = manifest.activate(createHarvestContext(registerTheme));
    try {
      disposable?.dispose();
    } catch {
      // Theme objects are already copied.
    }
  } catch {
    // Partial harvest is fine; a crashing activate() must not take down the picker.
  }

  return collected;
}

/**
 * No-op PluginContext. Theme packs only need registerTheme; other property
 * access returns a callable proxy so activate() does not throw.
 */
function createHarvestContext(registerTheme: PluginContext['registerTheme']): PluginContext {
  const noop = () => undefined;
  const log = { debug: noop, info: noop, warn: noop, error: noop };
  const themes = {
    list: () => [],
    getActive: () => null,
    setActive: () => false,
    onDidChange: () => noop,
  };

  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'registerTheme') return registerTheme;
      if (prop === 'log') return log;
      if (prop === 'themes') return themes;
      if (typeof prop === 'symbol') return undefined;
      return new Proxy(noop, handler);
    },
    apply() {
      return undefined;
    },
  };

  return new Proxy({}, handler) as PluginContext;
}
