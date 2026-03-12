/**
 * useThemeOverrides Hook
 *
 * Applies active theme tokens from ThemeRegistry to document.documentElement.
 * Call once in app root, AFTER useAppearanceSettings.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { themeRegistryStore } from './themeRegistryStore';

const subscribe = (cb: () => void) => themeRegistryStore.subscribe(cb);
const getActiveThemeId = () => themeRegistryStore.getState().activeThemeId;
const getThemes = () => themeRegistryStore.getState().themes;

export function useThemeOverrides(): void {
  const activeThemeId = useSyncExternalStore(subscribe, getActiveThemeId);
  const themes = useSyncExternalStore(subscribe, getThemes);

  useEffect(() => {
    const root = document.documentElement;
    const theme = themeRegistryStore.getState().getActiveTheme();
    const applied = new Set<string>();

    if (theme) {
      // Set plugin theme color scheme on data-theme (separate from data-color-scheme)
      root.setAttribute('data-theme', theme.colorScheme);

      // Apply theme tokens
      for (const [prop, value] of Object.entries(theme.tokens)) {
        root.style.setProperty(prop, value);
        applied.add(prop);
      }
    } else {
      // No active plugin theme — remove the attribute so it doesn't conflict
      root.removeAttribute('data-theme');
    }

    return () => {
      // Remove applied properties so base tokens take over
      for (const prop of applied) {
        root.style.removeProperty(prop);
      }
    };
  }, [activeThemeId, themes]);
}
