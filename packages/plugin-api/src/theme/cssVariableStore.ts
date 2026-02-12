/**
 * CSS Variable Store
 *
 * Zustand vanilla store for plugin-registered CSS custom properties.
 * Plugins can inject variables to override theme tokens or add custom ones.
 */

import { createStore } from 'zustand/vanilla';

export interface CssVariableRegistration {
  /** Unique registration ID */
  id: string;
  /** Plugin that registered these variables */
  pluginId: string;
  /** CSS custom properties to apply (e.g. { '--accent': '#ff0000' }) */
  variables: Record<string, string>;
}

interface CssVariableState {
  registrations: CssVariableRegistration[];
  register(registration: CssVariableRegistration): void;
  unregister(id: string): void;
  unregisterAll(pluginId: string): void;
  /** Get merged variables (later registrations override earlier ones) */
  getMergedVariables(): Record<string, string>;
}

export const cssVariableStore = createStore<CssVariableState>((set, get) => ({
  registrations: [],

  register(registration) {
    set(state => ({
      registrations: [...state.registrations.filter(r => r.id !== registration.id), registration],
    }));
  },

  unregister(id) {
    set(state => ({
      registrations: state.registrations.filter(r => r.id !== id),
    }));
  },

  unregisterAll(pluginId) {
    set(state => ({
      registrations: state.registrations.filter(r => r.pluginId !== pluginId),
    }));
  },

  getMergedVariables() {
    const merged: Record<string, string> = {};
    for (const reg of get().registrations) {
      Object.assign(merged, reg.variables);
    }
    return merged;
  },
}));
