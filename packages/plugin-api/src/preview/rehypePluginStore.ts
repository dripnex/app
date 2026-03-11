import { createStore } from 'zustand/vanilla';
import { safePluginWrapper } from './safePluginWrapper';

export interface RehypePluginRegistration {
  id: string;
  pluginId: string;
  /** unified rehype plugin — typed as unknown for loose coupling */
  plugin: unknown;
  metadata: {
    name: string;
    version: string;
    priority: number;
  };
}

interface RehypePluginState {
  registrations: RehypePluginRegistration[];
  register(registration: RehypePluginRegistration): void;
  unregister(id: string): void;
  unregisterAll(pluginId: string): void;
  getPlugins(): unknown[];
}

export const rehypePluginStore = createStore<RehypePluginState>((set, get) => ({
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
    console.warn(
      `[RehypePlugins] Registered: ${registration.metadata.name}@${registration.metadata.version} (priority: ${registration.metadata.priority})`,
    );
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
