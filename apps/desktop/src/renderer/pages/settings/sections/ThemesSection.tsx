/**
 * Themes — Default plus installed palettes, and one-click install from the catalog.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { themeRegistryStore, type ThemeDefinition } from '@dripnex/plugin-api';
import { useSettingsStore, selectAppearance } from '../../../stores/settings';
import { syncInstalledPluginThemes, themePickerIds } from '../../../themes/officialThemes';
import { SettingsPage } from '../components/SettingsPage';
import { Button, toast } from '../../../ui/primitives';
import {
  COMMUNITY_CATALOG,
  availableThemePalettes,
  cardsFromRegistry,
  installedThemePluginIds,
  mergeFallbackCatalog,
  themeInstallBundleUrl,
} from './plugins/communityCatalog';
import themeStyles from './AppearanceThemes.module.css';
import { PaletteCard } from './themes/PaletteCard';
import { AvailablePaletteCard } from './themes/AvailablePaletteCard';

const INSTALL_FAIL_HINT = 'Use Plugins → Install → Other package if this keeps failing.';

export function ThemesSection() {
  const appearance = useSettingsStore(selectAppearance);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);

  const pluginThemes = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().themes
  );
  const activeThemeId = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().activeThemeId
  );

  const theme = appearance.theme || 'dark';
  const accentColor = appearance.accentColor || '#5eead4';

  const [catalog, setCatalog] = useState(() => mergeFallbackCatalog([], COMMUNITY_CATALOG));
  const [catalogError, setCatalogError] = useState(false);
  const [installedIds, setInstalledIds] = useState<Set<string>>(() => new Set());
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const refreshInstalled = useCallback(async () => {
    try {
      const scanned = await window.dripnex.plugins.scan();
      setInstalledIds(new Set(scanned.map(p => p.id)));
    } catch {
      setInstalledIds(new Set());
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!window.dripnex?.plugins?.listRegistry) {
      setCatalog(mergeFallbackCatalog([], COMMUNITY_CATALOG));
      setCatalogError(true);
      return;
    }
    try {
      const result = await window.dripnex.plugins.listRegistry();
      if (result.plugins.length === 0) {
        setCatalog(mergeFallbackCatalog([], COMMUNITY_CATALOG));
        setCatalogError(true);
        return;
      }
      setCatalog(mergeFallbackCatalog(cardsFromRegistry(result.plugins)));
      setCatalogError(false);
    } catch {
      setCatalog(mergeFallbackCatalog([], COMMUNITY_CATALOG));
      setCatalogError(true);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    void refreshInstalled();
    const onRefresh = () => void refreshInstalled();
    window.addEventListener('dripnex:plugins:refresh', onRefresh);
    return () => window.removeEventListener('dripnex:plugins:refresh', onRefresh);
  }, [loadCatalog, refreshInstalled]);

  const handlePalette = useCallback(
    (themeDef: ThemeDefinition | null) => {
      if (!themeDef) {
        themeRegistryStore.getState().setActive(null);
        updateAppearance({
          activeThemeId: null,
          accentColor: theme === 'light' ? '#0d8a80' : '#5eead4',
        });
        return;
      }
      themeRegistryStore.getState().setActive(themeDef.id);
      updateAppearance({
        activeThemeId: themeDef.id,
        theme: themeDef.colorScheme,
        accentColor: themeDef.tokens['--accent'] ?? accentColor,
      });
    },
    [accentColor, theme, updateAppearance]
  );

  const installFail = useCallback((name: string) => {
    toast.error(`Couldn't install ${name}. ${INSTALL_FAIL_HINT}`);
  }, []);

  const installPalette = useCallback(
    async (slug: string) => {
      const card = catalog.find(c => c.slug === slug);
      if (!card) return;
      const url = themeInstallBundleUrl(card);
      if (!url) {
        installFail(card.name);
        return;
      }
      setBusySlug(card.slug);
      try {
        const result = await window.dripnex.plugins.installFromUrl(url, card.slug);
        if (!result.success) {
          installFail(card.name);
          return;
        }
        toast.success(`${card.name} installed.`);
        window.dripnex.plugins.requestReload();
        window.dispatchEvent(new CustomEvent('dripnex:plugins:refresh'));
        await refreshInstalled();
        await syncInstalledPluginThemes();
        const pluginId = result.pluginId ?? card.slug;
        const registered = themeRegistryStore
          .getState()
          .themes.find(t => t.pluginId === pluginId || t.id === pluginId);
        if (registered) handlePalette(registered);
      } catch {
        installFail(card.name);
      } finally {
        setBusySlug(null);
      }
    },
    [catalog, handlePalette, installFail, refreshInstalled]
  );

  const installed = installedThemePluginIds(installedIds, pluginThemes);
  const available = availableThemePalettes(catalog, installed);

  return (
    <SettingsPage
      title="Themes"
      lede="Default is built in. Extra palettes install from here — one click, then pick."
    >
      <div className={themeStyles.block}>
        <h3 className={themeStyles.blockTitle}>In use</h3>
        <div className={themeStyles.grid}>
          {themePickerIds(pluginThemes).map(id => {
            if (id === null) {
              return (
                <PaletteCard
                  key="default"
                  name="Default"
                  description={theme === 'light' ? 'Cool paper' : 'Quiet dark'}
                  active={!activeThemeId}
                  tokens={{
                    '--bg-base': theme === 'light' ? '#f3f2ee' : '#0a0b0d',
                    '--bg-surface': theme === 'light' ? '#e7e5df' : '#16171a',
                    '--bg-elevated': theme === 'light' ? '#fffcf7' : '#1e2024',
                    '--text-primary': theme === 'light' ? '#3a3834' : '#f4f4f5',
                    '--text-muted':
                      theme === 'light' ? 'rgba(58,56,52,0.5)' : 'rgba(255,255,255,0.35)',
                    '--accent': accentColor,
                    '--border':
                      theme === 'light' ? 'rgba(22,21,19,0.12)' : 'rgba(255,255,255,0.08)',
                  }}
                  onClick={() => handlePalette(null)}
                />
              );
            }
            const def = pluginThemes.find(t => t.id === id);
            if (!def) return null;
            return (
              <PaletteCard
                key={def.id}
                name={def.name}
                description={def.description ?? def.colorScheme}
                active={activeThemeId === def.id}
                tokens={def.tokens}
                onClick={() => handlePalette(def)}
              />
            );
          })}
        </div>
      </div>

      {catalogError ? (
        <p className={themeStyles.catalogError} role="alert">
          Couldn&apos;t load palettes.
          <Button variant="secondary" size="sm" onClick={() => void loadCatalog()}>
            Retry
          </Button>
        </p>
      ) : null}

      {available.length > 0 ? (
        <div className={themeStyles.block}>
          <h3 className={themeStyles.blockTitle}>Available palettes</h3>
          <p className={themeStyles.blockHint}>First-party packs. Install stays on this machine.</p>
          <div className={themeStyles.availableList}>
            {available.map(card => (
              <AvailablePaletteCard
                key={card.slug}
                name={card.name}
                description={card.description}
                version={card.version}
                installing={busySlug === card.slug}
                disabled={busySlug !== null}
                onInstall={() => void installPalette(card.slug)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </SettingsPage>
  );
}
