import { useEffect, useSyncExternalStore } from 'react';
import { themeRegistryStore } from '@dripnex/plugin-api';
import { useSettingsStore, selectAppearance } from '../stores/settings';
import { registerOfficialThemes } from '../themes/officialThemes';

/** Register first-party palettes and restore the last chosen one. */
export function useOfficialThemes(): void {
  const appearance = useSettingsStore(selectAppearance);
  const registeredThemeCount = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().themes.length
  );

  useEffect(() => {
    registerOfficialThemes();
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
