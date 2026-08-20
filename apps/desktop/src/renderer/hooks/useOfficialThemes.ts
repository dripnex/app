import { useEffect, useSyncExternalStore } from 'react';
import { setHostThemeActive, themeRegistryStore } from '@dripnex/plugin-api';
import { useSettingsStore, selectAppearance } from '../stores/settings';
import { registerOfficialThemes } from '../themes/officialThemes';

/** Persist a palette the same way Settings → Appearance does. */
export function applyHostTheme(id: string | null): boolean {
  const { settings, updateAppearance } = useSettingsStore.getState();
  if (id === null) {
    themeRegistryStore.getState().setActive(null);
    updateAppearance({ activeThemeId: null });
    return true;
  }
  const theme = themeRegistryStore.getState().themes.find(t => t.id === id);
  if (!theme) return false;
  themeRegistryStore.getState().setActive(id);
  updateAppearance({
    activeThemeId: id,
    theme: theme.colorScheme,
    accentColor: theme.tokens['--accent'] ?? settings.appearance.accentColor,
  });
  return true;
}

/** Register first-party palettes and restore the last chosen one. */
export function useOfficialThemes(): void {
  const appearance = useSettingsStore(selectAppearance);
  const registeredThemeCount = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().themes.length
  );

  useEffect(() => {
    registerOfficialThemes();
    setHostThemeActive(applyHostTheme);
    return () => setHostThemeActive(null);
  }, []);

  useEffect(() => {
    const savedThemeId = appearance?.activeThemeId;
    if (savedThemeId && registeredThemeCount > 0) {
      const exists = themeRegistryStore.getState().themes.some(t => t.id === savedThemeId);
      if (exists) {
        themeRegistryStore.getState().setActive(savedThemeId);
      }
    }
  }, [appearance?.activeThemeId, registeredThemeCount]);
}
