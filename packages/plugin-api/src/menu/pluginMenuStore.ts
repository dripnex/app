import { createStore } from 'zustand/vanilla';

export interface PluginMenuItem {
  pluginId: string;
  label: string;
  commandId: string;
  accelerator?: string;
}

interface PluginMenuState {
  items: PluginMenuItem[];
  add: (item: PluginMenuItem) => void;
  remove: (commandId: string) => void;
  removeAll: (pluginId: string) => void;
}

export const pluginMenuStore = createStore<PluginMenuState>(set => ({
  items: [],
  add(item) {
    set(state => ({
      items: [...state.items.filter(i => i.commandId !== item.commandId), item],
    }));
  },
  remove(commandId) {
    set(state => ({ items: state.items.filter(i => i.commandId !== commandId) }));
  },
  removeAll(pluginId) {
    set(state => ({ items: state.items.filter(i => i.pluginId !== pluginId) }));
  },
}));
