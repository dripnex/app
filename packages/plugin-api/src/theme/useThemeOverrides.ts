/// <reference lib="dom" />
/**
 * useThemeOverrides Hook
 *
 * Applies active theme tokens from ThemeRegistry to document.documentElement.
 * Call once in app root. Appearance may overlay --accent after this.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { themeRegistryStore } from './themeRegistryStore';

const subscribe = (cb: () => void) => themeRegistryStore.subscribe(cb);
const getActiveThemeId = () => themeRegistryStore.getState().activeThemeId;

/** Stable snapshot: only changes when the themes array actually changes length or content */
let cachedThemes = themeRegistryStore.getState().themes;
themeRegistryStore.subscribe(() => {
  const next = themeRegistryStore.getState().themes;
  if (next !== cachedThemes) cachedThemes = next;
});
const getThemes = () => cachedThemes;

export function useThemeOverrides(): void {
  const activeThemeId = useSyncExternalStore(subscribe, getActiveThemeId);
  const themes = useSyncExternalStore(subscribe, getThemes);

  useEffect(() => {
    const root = document.documentElement;
    const theme = themeRegistryStore.getState().getActiveTheme();
    const applied = new Set<string>();

    if (theme) {
      root.setAttribute('data-theme', theme.id);
      root.setAttribute('data-color-scheme', theme.colorScheme);
      root.style.colorScheme = theme.colorScheme;
      if (theme.frosted) root.setAttribute('data-frosted', 'true');
      else root.removeAttribute('data-frosted');

      for (const [prop, value] of Object.entries(theme.tokens)) {
        root.style.setProperty(prop, value);
        applied.add(prop);
      }
    } else {
      root.removeAttribute('data-theme');
      root.removeAttribute('data-frosted');
    }

    return () => {
      for (const prop of applied) {
        root.style.removeProperty(prop);
      }
      root.removeAttribute('data-frosted');
    };
  }, [activeThemeId, themes]);
}
