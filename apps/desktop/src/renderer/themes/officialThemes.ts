import { parsePluginTheme, themeRegistryStore, type ThemeDefinition } from '@dripnex/plugin-api';
import { collectThemesFromPluginCode } from './collectPluginThemes';

/**
 * Named palettes ship as satellite packs (`dripnex/theme-<slug>`), not core.
 * Default appearance is tokens.css (`activeThemeId: null`).
 */
export const OFFICIAL_THEMES: ThemeDefinition[] = [];

/**
 * Former bundled palette ids. A saved id in this list falls back to Default
 * so a leftover setting cannot leave a blank UI. Live satellites register
 * their own ids in activate() (e.g. dripnex-dune), which are not in this list.
 */
export const RETIRED_BUNDLED_THEME_IDS = [
  'dripnex-parchment',
  'dripnex-wave',
  'dripnex-night',
  'dripnex-solarized-dark',
  'dripnex-solarized-light',
  'dripnex-gruvbox',
  'dripnex-glass',
  'dripnex-midnight',
  'dripnex-ember',
  'dripnex-ion',
  'dripnex-matcha',
  'dripnex-phosphor',
  'dripnex-fog',
  'dripnex-harbor-dusk',
] as const;

export type RetiredBundledThemeId = (typeof RETIRED_BUNDLED_THEME_IDS)[number];

export function isRetiredBundledThemeId(id: string): boolean {
  return (RETIRED_BUNDLED_THEME_IDS as readonly string[]).includes(id);
}

/** No-op: core does not register named palettes. Kept so call sites stay stable. */
export function registerOfficialThemes(): void {
  const { themes, register } = themeRegistryStore.getState();
  for (const theme of OFFICIAL_THEMES) {
    if (themes.some(t => t.id === theme.id)) continue;
    register(theme);
  }
}

export type RestoreSavedThemeResult = 'activated' | 'cleared' | 'pending';

/**
 * Restore a persisted palette, or drop a retired bundled id so tokens.css
 * is the default instead of a blank/broken UI.
 */
export function restoreSavedTheme(savedThemeId: string | null): RestoreSavedThemeResult {
  if (savedThemeId === null) {
    themeRegistryStore.getState().setActive(null);
    return 'cleared';
  }
  const exists = themeRegistryStore.getState().themes.some(t => t.id === savedThemeId);
  if (exists) {
    themeRegistryStore.getState().setActive(savedThemeId);
    return 'activated';
  }
  if (isRetiredBundledThemeId(savedThemeId)) {
    themeRegistryStore.getState().setActive(null);
    return 'cleared';
  }
  return 'pending';
}

export function persistClearedThemeIfNeeded(
  savedThemeId: string | null,
  result: RestoreSavedThemeResult,
  persist: (id: null) => void
): void {
  if (result === 'cleared' && savedThemeId !== null) {
    persist(null);
  }
}

export interface ScannedThemePack {
  id: string;
  themes?: string[];
  /** Plugin source from scan(). Satellite packs register palettes in activate(). */
  code?: string;
}

/**
 * Picker order: Default (tokens.css, id null) then registered palettes.
 * ThemesSection prepends Default; this helper is the tested contract.
 */
export function themePickerIds(themes: ThemeDefinition[]): Array<string | null> {
  return [null, ...themes.map(t => t.id)];
}

export function parseInstalledThemes(
  scanned: Array<ScannedThemePack>,
  enabledById: Map<string, boolean>,
  options?: { require?: (id: string) => unknown }
): ThemeDefinition[] {
  const result: ThemeDefinition[] = [];
  for (const sp of scanned) {
    try {
      if (!(enabledById.get(sp.id) ?? true)) continue;

      const fromJson: ThemeDefinition[] = [];
      for (const source of sp.themes ?? []) {
        const parsed = parsePluginTheme(source, sp.id);
        if (!parsed.theme) continue;
        fromJson.push({ ...parsed.theme, pluginId: sp.id });
      }
      if (fromJson.length > 0) {
        result.push(...fromJson);
        continue;
      }

      // Existing satellites (Dune, Limestone, …) ship dist/index.js and
      // registerTheme() in activate() — scan().themes is []. Harvest those.
      if (typeof sp.code === 'string' && sp.code.trim()) {
        result.push(...collectThemesFromPluginCode(sp.code, sp.id, options));
      }
    } catch {
      // Missing or malformed theme.json / activate() must not crash the picker.
    }
  }
  return result;
}

/** Theme ids last applied from a plugin scan (not PluginHost activate()). */
let syncedThemeIds = new Set<string>();

export function applyInstalledThemes(defs: ThemeDefinition[]): void {
  const nextIds = new Set<string>();
  const { register, unregister } = themeRegistryStore.getState();
  for (const theme of defs) {
    register(theme);
    nextIds.add(theme.id);
  }
  for (const id of syncedThemeIds) {
    if (!nextIds.has(id)) unregister(id);
  }
  syncedThemeIds = nextIds;
}

export async function syncInstalledPluginThemes(): Promise<void> {
  const plugins = typeof window !== 'undefined' ? window.dripnex?.plugins : undefined;
  if (!plugins?.scan || !plugins.listState) return;
  try {
    const [scanned, stateList] = await Promise.all([plugins.scan(), plugins.listState()]);
    const enabledById = new Map(stateList.map(s => [s.pluginId, s.enabled]));
    applyInstalledThemes(parseInstalledThemes(scanned, enabledById));
  } catch {
    // Keep whatever PluginHost or the last successful scan registered.
  }
}

registerOfficialThemes();
