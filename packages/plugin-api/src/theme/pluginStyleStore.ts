/**
 * Package stylesheets shipped as styles/*.css in a plugin directory.
 * Injected while the plugin is active; removed on deactivate.
 */

import { createStore } from 'zustand/vanilla';

export interface PluginStyleSheet {
  pluginId: string;
  sources: string[];
}

interface PluginStyleState {
  sheets: PluginStyleSheet[];
  register(pluginId: string, sources: string[]): void;
  unregisterAll(pluginId: string): void;
}

export const pluginStyleStore = createStore<PluginStyleState>(set => ({
  sheets: [],

  register(pluginId, sources) {
    const cleaned = sources.map(css => css.trim()).filter(Boolean);
    set(state => ({
      sheets: [
        ...state.sheets.filter(sheet => sheet.pluginId !== pluginId),
        ...(cleaned.length > 0 ? [{ pluginId, sources: cleaned }] : []),
      ],
    }));
  },

  unregisterAll(pluginId) {
    set(state => ({
      sheets: state.sheets.filter(sheet => sheet.pluginId !== pluginId),
    }));
  },
}));
