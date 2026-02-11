import { createStore } from 'zustand/vanilla';
import { Compartment, type Extension } from '@codemirror/state';

export interface EditorExtensionRegistration {
  id: string;
  pluginId: string;
  extensions: Extension[];
}

interface EditorPluginState {
  registrations: EditorExtensionRegistration[];
  register(registration: EditorExtensionRegistration): void;
  unregister(id: string): void;
  unregisterAll(pluginId: string): void;
  getMergedExtensions(): Extension[];
}

/** Single compartment for all plugin extensions */
export const pluginExtensionCompartment = new Compartment();

export const editorPluginStore = createStore<EditorPluginState>((set, get) => ({
  registrations: [],

  register(registration) {
    set(state => ({
      registrations: [
        ...state.registrations.filter(r => r.id !== registration.id),
        registration,
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

  getMergedExtensions() {
    return get().registrations.flatMap(r => r.extensions);
  },
}));
