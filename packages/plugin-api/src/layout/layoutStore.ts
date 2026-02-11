import { createStore } from 'zustand/vanilla';
import type { LayoutZoneName, ZoneEntry, LayoutManager } from './types';

interface LayoutState {
  zones: Map<LayoutZoneName, ZoneEntry[]>;
  addEntry(zone: LayoutZoneName, entry: ZoneEntry): void;
  removeEntry(id: string): void;
  removeAllForPlugin(pluginId: string): void;
  getZone(zone: LayoutZoneName): ZoneEntry[];
}

export const layoutStore = createStore<LayoutState>((set, get) => ({
  zones: new Map(),

  addEntry(zone, entry) {
    set(state => {
      const zones = new Map(state.zones);
      const entries = [...(zones.get(zone) ?? [])];
      // Remove existing with same id to prevent duplicates
      const filtered = entries.filter(e => e.id !== entry.id);
      filtered.push(entry);
      filtered.sort((a, b) => a.order - b.order);
      zones.set(zone, filtered);
      return { zones };
    });
  },

  removeEntry(id) {
    set(state => {
      const zones = new Map(state.zones);
      for (const [zoneName, entries] of zones) {
        const filtered = entries.filter(e => e.id !== id);
        if (filtered.length !== entries.length) {
          zones.set(zoneName, filtered);
        }
      }
      return { zones };
    });
  },

  removeAllForPlugin(pluginId) {
    set(state => {
      const zones = new Map(state.zones);
      for (const [zoneName, entries] of zones) {
        const filtered = entries.filter(e => e.pluginId !== pluginId);
        if (filtered.length !== entries.length) {
          zones.set(zoneName, filtered);
        }
      }
      return { zones };
    });
  },

  getZone(zone) {
    return get().zones.get(zone) ?? [];
  },
}));

/** Create a LayoutManager scoped to a plugin */
export function createLayoutManager(pluginId: string): LayoutManager {
  return {
    addComponent(zone, entry) {
      layoutStore.getState().addEntry(zone, { ...entry, pluginId });
    },
    removeComponent(id) {
      layoutStore.getState().removeEntry(id);
    },
    removeAllForPlugin(pid) {
      layoutStore.getState().removeAllForPlugin(pid);
    },
  };
}
