/**
 * Runtime store for plugin-registered AI commands.
 *
 * Plugins call `ctx.registerAiCommand(def)` which writes to this store.
 * The Edit with AI selection menu and command palette read from it to discover custom commands.
 */

import { createStore } from 'zustand/vanilla';

/**
 * A registered AI command (from a plugin or imported preset).
 * Mirrors AiCommandDefinition from @dripnex/ai-core but includes pluginId for lifecycle.
 */
export interface AiCommandRegistration {
  /** Registration id (usually `pluginId:commandId`) */
  id: string;
  /** The plugin that registered this command */
  pluginId: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** System prompt for the AI */
  systemPrompt: string;
  /** User prompt template with {{selection}}, {{note}}, {{title}} placeholders */
  userPromptTemplate: string;
  /** Lucide icon name */
  icon?: string;
  /** Where to put the AI response */
  outputTarget?: 'replace' | 'insert' | 'panel';
  /** Category tag for organization */
  category?: string;
}

interface AiCommandStoreState {
  registrations: AiCommandRegistration[];
  register(registration: AiCommandRegistration): void;
  unregister(id: string): void;
  unregisterAll(pluginId: string): void;
  getById(id: string): AiCommandRegistration | undefined;
  getAll(): AiCommandRegistration[];
}

export const aiCommandStore = createStore<AiCommandStoreState>((set, get) => ({
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

  getById(id) {
    return get().registrations.find(r => r.id === id);
  },

  getAll() {
    return get().registrations;
  },
}));
