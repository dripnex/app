import { createStore } from 'zustand/vanilla';

export interface RemarkPluginRegistration {
  id: string;
  pluginId: string;
  /** unified remark plugin — typed as unknown for loose coupling */
  plugin: unknown;
}

interface RemarkPluginState {
  registrations: RemarkPluginRegistration[];
  register(registration: RemarkPluginRegistration): void;
  unregister(id: string): void;
  unregisterAll(pluginId: string): void;
  getPlugins(): unknown[];
}

export const remarkPluginStore = createStore<RemarkPluginState>((set, get) => ({
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

  getPlugins() {
    return get().registrations.map(r => r.plugin);
  },
}));
