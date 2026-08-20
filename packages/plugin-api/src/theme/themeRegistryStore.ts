/**
 * Theme Registry Store
 *
 * Zustand vanilla store for registered themes.
 * Validates tokens on registration. Manages active theme state.
 */

import { createStore } from 'zustand/vanilla';
import type { ThemeDefinition } from './themeTypes';
import { validateThemeTokens } from './themeTypes';

interface ThemeRegistryState {
  themes: ThemeDefinition[];
  activeThemeId: string | null;
  register(theme: ThemeDefinition): boolean;
  unregister(themeId: string): void;
  unregisterAll(pluginId: string): void;
  setActive(themeId: string | null): void;
  getActiveTheme(): ThemeDefinition | null;
}

export const themeRegistryStore = createStore<ThemeRegistryState>((set, get) => ({
  themes: [],
  activeThemeId: null,

  register(theme) {
    const validTokens = validateThemeTokens(theme.tokens, theme.id);
    if (Object.keys(validTokens).length === 0) {
      console.warn(`[ThemeRegistry] Theme "${theme.id}" has no valid tokens, skipping.`);
      return false;
    }
    const validated: ThemeDefinition = { ...theme, tokens: validTokens };
    set(state => ({
      themes: [...state.themes.filter(t => t.id !== theme.id), validated],
    }));
    return true;
  },

  unregister(themeId) {
    set(state => ({
      themes: state.themes.filter(t => t.id !== themeId),
      activeThemeId: state.activeThemeId === themeId ? null : state.activeThemeId,
    }));
  },

  unregisterAll(pluginId) {
    set(state => {
      const remaining = state.themes.filter(t => t.pluginId !== pluginId);
      const activeRemoved =
        state.activeThemeId && !remaining.some(t => t.id === state.activeThemeId);
      return {
        themes: remaining,
        activeThemeId: activeRemoved ? null : state.activeThemeId,
      };
    });
  },

  setActive(themeId) {
    if (themeId !== null) {
      const exists = get().themes.some(t => t.id === themeId);
      if (!exists) {
        console.warn(`[ThemeRegistry] Theme "${themeId}" not found, ignoring setActive.`);
        return;
      }
    }
    set({ activeThemeId: themeId });
  },

  getActiveTheme() {
    const { themes, activeThemeId } = get();
    if (!activeThemeId) return null;
    return themes.find(t => t.id === activeThemeId) ?? null;
  },
}));
