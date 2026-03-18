import { useEffect, useRef } from 'react';
import { aiCommandStore } from '@readied/plugin-api';
import type { AiCommandRegistration } from '@readied/plugin-api';
import { resolveTemplate } from '@readied/ai-core';
import type { AiInitialCommand } from '../components/ai/AiPanel';
import { registry, getEditorView } from './useCommandRegistry';

/**
 * Callback invoked when a plugin AI command is executed from the palette.
 * Receives a fully resolved AiInitialCommand ready for the AI panel.
 */
export interface PluginAiCommandExecutor {
  (command: AiInitialCommand): void;
}

/**
 * Bridge between the plugin AI command store and the command palette.
 *
 * Subscribes to `aiCommandStore` (Zustand vanilla) and dynamically
 * registers/unregisters commands in the `CommandRegistry` so they
 * appear in the command palette.
 *
 * When a plugin AI command is executed:
 * 1. Gets editor selection, note content, and title
 * 2. Resolves the template using `resolveTemplate()`
 * 3. Calls the executor callback to open the AI panel with the resolved command
 */
export function useRegisterPluginAiCommands(onExecute: PluginAiCommandExecutor): void {
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

  useEffect(() => {
    // Track unregister functions keyed by registration id
    const unregisterMap = new Map<string, () => void>();

    function registerCommand(reg: AiCommandRegistration): void {
      // Guard against double-registration
      if (unregisterMap.has(reg.id)) return;

      const unregister = registry.register({
        id: `plugin-ai:${reg.id}`,
        name: `AI: ${reg.name}`,
        description: reg.description,
        category: 'ai',
        context: 'editor',
        showInPalette: true,
        icon: reg.icon,
        execute: () => {
          // Gather context from editor
          const view = getEditorView();
          let selection = '';
          let note = '';
          let title = '';

          if (view) {
            const state = view.state;
            const sel = state.selection.main;
            selection = state.sliceDoc(sel.from, sel.to);
            note = state.doc.toString();

            // Extract title from first heading line
            const firstLine = state.doc.lineAt(1).text;
            if (firstLine.startsWith('# ')) {
              title = firstLine.slice(2).trim();
            }
          }

          // Resolve template placeholders
          const userPrompt = resolveTemplate(reg.userPromptTemplate, {
            selection,
            note,
            title,
          });

          // Dispatch to AI panel via callback
          onExecuteRef.current({
            systemPrompt: reg.systemPrompt,
            userPrompt,
            outputTarget: reg.outputTarget ?? 'panel',
          });

          return true;
        },
      });

      unregisterMap.set(reg.id, unregister);
    }

    function unregisterCommand(id: string): void {
      const unregister = unregisterMap.get(id);
      if (unregister) {
        unregister();
        unregisterMap.delete(id);
      }
    }

    function syncRegistrations(registrations: AiCommandRegistration[]): void {
      const currentIds = new Set(registrations.map(r => r.id));

      // Remove commands no longer in the store
      for (const id of unregisterMap.keys()) {
        if (!currentIds.has(id)) {
          unregisterCommand(id);
        }
      }

      // Add new commands
      for (const reg of registrations) {
        if (!unregisterMap.has(reg.id)) {
          registerCommand(reg);
        }
      }
    }

    // Initial sync with current store state
    syncRegistrations(aiCommandStore.getState().registrations);

    // Subscribe to future changes
    const unsubscribe = aiCommandStore.subscribe(state => {
      syncRegistrations(state.registrations);
    });

    return () => {
      unsubscribe();
      // Clean up all palette registrations
      for (const unregister of unregisterMap.values()) {
        unregister();
      }
      unregisterMap.clear();
    };
  }, []);
}
