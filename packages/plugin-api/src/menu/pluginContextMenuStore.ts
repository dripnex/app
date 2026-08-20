import { createStore } from 'zustand/vanilla';

export type PluginContextMenuTarget = 'note-list-item' | 'notebook-item' | 'tag-item' | 'editor';

export interface PluginContextMenuItem {
  pluginId: string;
  target: PluginContextMenuTarget;
  label: string;
  commandId: string;
}

interface PluginContextMenuState {
  items: PluginContextMenuItem[];
  add: (item: PluginContextMenuItem) => void;
  remove: (commandId: string) => void;
  removeAll: (pluginId: string) => void;
}

export const pluginContextMenuStore = createStore<PluginContextMenuState>(set => ({
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
