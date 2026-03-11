/**
 * useThemeOverrides Hook
 *
 * Applies active theme tokens from ThemeRegistry to document.documentElement.
 * Call once in app root, AFTER useAppearanceSettings.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { themeRegistryStore } from './themeRegistryStore';

const subscribe = (cb: () => void) => themeRegistryStore.subscribe(cb);
const getSnapshot = () => ({
  activeThemeId: themeRegistryStore.getState().activeThemeId,
  themes: themeRegistryStore.getState().themes,
});

export function useThemeOverrides(): void {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    const theme = themeRegistryStore.getState().getActiveTheme();
    const applied = new Set<string>();

    if (theme) {
      // Set base color scheme so CSS fallbacks work
      root.setAttribute('data-theme', theme.colorScheme);

      // Apply theme tokens
      for (const [prop, value] of Object.entries(theme.tokens)) {
        root.style.setProperty(prop, value);
        applied.add(prop);
      }
    }

    return () => {
      // Remove applied properties so base tokens take over
      for (const prop of applied) {
        root.style.removeProperty(prop);
      }
    };
  }, [state.activeThemeId, state.themes]);
}
