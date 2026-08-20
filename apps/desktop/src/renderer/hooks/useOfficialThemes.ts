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
    if (registeredThemeCount === 0) return;
    const savedThemeId = appearance?.activeThemeId ?? null;
    // Each window has its own registry. Settings can setActive(null) locally
    // and broadcast appearance.activeThemeId; the notes window must clear too
    // or named-palette tokens stay inline and Light never shows.
    if (savedThemeId === null) {
      themeRegistryStore.getState().setActive(null);
      return;
    }
    const exists = themeRegistryStore.getState().themes.some(t => t.id === savedThemeId);
    if (!exists) return;
    themeRegistryStore.getState().setActive(savedThemeId);
    const palette = themeRegistryStore.getState().getActiveTheme();
    const paletteAccent = palette?.tokens['--accent'];
    if (paletteAccent && appearance?.accentColor === '#5eead4') {
      useSettingsStore.getState().updateAppearance({ accentColor: paletteAccent });
    }
  }, [appearance?.activeThemeId, registeredThemeCount]);
}
