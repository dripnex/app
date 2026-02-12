import { createStore } from 'zustand/vanilla';
import type { ComponentType } from 'react';

export interface PreviewComponentRegistration {
  id: string;
  pluginId: string;
  tagName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
}

interface PreviewComponentState {
  registrations: PreviewComponentRegistration[];
  register(registration: PreviewComponentRegistration): void;
  unregister(id: string): void;
  unregisterAll(pluginId: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getComponents(): Record<string, ComponentType<any>>;
}

export const previewComponentStore = createStore<PreviewComponentState>((set, get) => ({
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

  getComponents() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, ComponentType<any>> = {};
    for (const reg of get().registrations) {
      result[reg.tagName] = reg.component;
    }
    return result;
  },
}));
