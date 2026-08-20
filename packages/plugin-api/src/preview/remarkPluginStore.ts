import { createStore } from 'zustand/vanilla';
import { safePluginWrapper } from './safePluginWrapper';

export interface RemarkPluginRegistration {
  id: string;
  pluginId: string;
  /** unified remark plugin — typed as unknown for loose coupling */
  plugin: unknown;
  metadata: {
    name: string;
    version: string;
    priority: number;
  };
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
    const wrappedPlugin = safePluginWrapper(registration.plugin, {
      name: registration.metadata.name,
      version: registration.metadata.version,
      pluginId: registration.pluginId,
    });
    set(state => ({
      registrations: [
        ...state.registrations.filter(r => r.id !== registration.id),
        { ...registration, plugin: wrappedPlugin },
      ],
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
    return [...get().registrations]
      .sort((a, b) => a.metadata.priority - b.metadata.priority)
      .map(r => r.plugin);
  },
}));
