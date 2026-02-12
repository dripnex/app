import { createStore } from 'zustand/vanilla';
import type { ComponentType } from 'react';

export interface CodeBlockRendererProps {
  code: string;
  language: string;
}

export interface CodeBlockRegistration {
  id: string;
  pluginId: string;
  language: string;
  component: ComponentType<CodeBlockRendererProps>;
}

interface CodeBlockState {
  registrations: CodeBlockRegistration[];
  register(registration: CodeBlockRegistration): void;
  unregister(id: string): void;
  unregisterAll(pluginId: string): void;
  getRenderer(language: string): ComponentType<CodeBlockRendererProps> | undefined;
}

export const codeBlockStore = createStore<CodeBlockState>((set, get) => ({
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

  getRenderer(language) {
    const reg = get().registrations.find(r => r.language === language);
    return reg?.component;
  },
}));
