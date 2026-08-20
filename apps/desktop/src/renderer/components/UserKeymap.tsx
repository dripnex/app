import { useEffect } from 'react';
import { parseKeymap } from '@dripnex/command-registry';
import { registry } from '../hooks/useCommandRegistry';

/**
 * Loads keybindings.json and reapplies it when the file changes.
 */
export function UserKeymap() {
  useEffect(() => {
    const plugins = window.dripnex?.plugins;
    if (!plugins?.readKeymap) return;

    const apply = async () => {
      try {
        const raw = await plugins.readKeymap();
        const { overrides, errors } = parseKeymap(raw ?? '');
        for (const error of errors) {
          console.warn(`[keymap] ${error}`);
        }
        registry.replaceKeybindingOverrides(overrides);
      } catch {
        registry.replaceKeybindingOverrides([]);
      }
    };

    void apply();
    return window.dripnex.ipc.on('plugins:keymapChanged', () => {
      void apply();
    });
  }, []);

  return null;
}
