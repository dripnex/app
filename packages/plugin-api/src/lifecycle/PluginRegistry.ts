import type { Extension } from '@codemirror/state';
import type { PluginManifest, PluginContext, PluginConfigAPI, PluginDisposable, EditorAPI, AppAPI, PluginCommandOptions } from '../types';
import { createLayoutManager } from '../layout/layoutStore';
import { editorPluginStore } from '../editor/editorPluginStore';
import { validateManifest } from '../validation';

type PluginState = 'loaded' | 'active' | 'deactivated';

/** Shape expected by the host's command registry */
export interface RegisterCommandFn {
  (command: {
    id: string;
    name: string;
    category: string;
    context: string;
    defaultKeybinding?: { key: string; modifiers: readonly string[] };
    icon?: string;
    showInPalette?: boolean;
    enabled?: boolean;
    execute: () => boolean | void | Promise<boolean | void>;
  }): () => void;
}

/** Bridge for config persistence (injected by host) */
export interface ConfigBridge {
  getAll: (pluginId: string) => Promise<Record<string, unknown>>;
  set: (pluginId: string, key: string, value: unknown) => Promise<void>;
}

interface PluginEntry {
  manifest: PluginManifest;
  state: PluginState;
  disposable?: PluginDisposable;
  commandUnregisters: Array<() => void>;
}

export class PluginRegistry {
  private plugins = new Map<string, PluginEntry>();

  /** Load a plugin manifest (validate and store). Returns false if validation fails. */
  load(manifest: PluginManifest): boolean {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      const id = manifest?.id ?? 'unknown';
      for (const err of errors) {
        console.error(`[plugin:${id}] Invalid manifest: ${err.field} — ${err.message}`);
      }
      return false;
    }

    if (this.plugins.has(manifest.id)) {
      console.warn(`Plugin "${manifest.id}" is already loaded. Replacing.`);
      this.unload(manifest.id);
    }

    this.plugins.set(manifest.id, {
      manifest,
      state: 'loaded',
      commandUnregisters: [],
    });

    return true;
  }

  /** Activate a loaded plugin */
  async activate(
    id: string,
    editorAPI: EditorAPI,
    appAPI: AppAPI,
    registerCommandFn?: RegisterCommandFn,
    configBridge?: ConfigBridge,
  ): Promise<void> {
    const entry = this.plugins.get(id);
    if (!entry) {
      console.error(`Plugin "${id}" not found.`);
      return;
    }

    if (entry.state === 'active') {
      return; // Already active
    }

    // Build registerCommand wrapper with auto-prefix + defaults
    const registerCommand = (
      options: PluginCommandOptions,
      execute: () => boolean | void | Promise<boolean | void>,
    ): (() => void) => {
      if (!registerCommandFn) {
        console.warn(`[${id}] registerCommand not available (no host bridge)`);
        return () => {};
      }

      const prefixedId = `plugin:${id}:${options.id}`;
      const unregister = registerCommandFn({
        id: prefixedId,
        name: options.name,
        category: options.category ?? 'plugin',
        context: 'global',
        defaultKeybinding: options.keybinding
          ? { key: options.keybinding.key, modifiers: options.keybinding.modifiers ?? [] }
          : undefined,
        icon: options.icon,
        showInPalette: options.showInPalette ?? true,
        enabled: true,
        execute,
      });

      entry.commandUnregisters.push(unregister);
      return unregister;
    };

    // Hydrate config cache from persistence before plugin starts
    const configCache: Record<string, unknown> = configBridge
      ? await configBridge.getAll(id)
      : {};

    const config: PluginConfigAPI = {
      get<T>(key: string): T | undefined {
        return configCache[key] as T | undefined;
      },
      set(key: string, value: unknown) {
        configCache[key] = value;
        if (configBridge) {
          void configBridge.set(id, key, value);
        }
      },
    };

    const context: PluginContext = {
      layout: createLayoutManager(id),
      editor: editorAPI,
      registerExtensions: (extId: string, extensions: Extension[]) => {
        editorPluginStore.getState().register({
          id: extId,
          pluginId: id,
          extensions,
        });
        return () => editorPluginStore.getState().unregister(extId);
      },
      registerCommand,
      config,
      log: {
        info: (msg: string, ...args: unknown[]) => console.log(`[${id}]`, msg, ...args),
        warn: (msg: string, ...args: unknown[]) => console.warn(`[${id}]`, msg, ...args),
        error: (msg: string, ...args: unknown[]) => console.error(`[${id}]`, msg, ...args),
      },
      app: appAPI,
    };

    const disposable = entry.manifest.activate(context);

    entry.state = 'active';
    entry.disposable = disposable ?? undefined;
  }

  /** Deactivate an active plugin */
  deactivate(id: string): void {
    const entry = this.plugins.get(id);
    if (!entry || entry.state !== 'active') return;

    // Call disposable
    entry.disposable?.dispose();

    // Call deactivate lifecycle
    entry.manifest.deactivate?.();

    // Cleanup layout entries
    const layoutManager = createLayoutManager(id);
    layoutManager.removeAllForPlugin(id);

    // Cleanup editor extensions
    editorPluginStore.getState().unregisterAll(id);

    // Safety net: unregister any remaining plugin commands
    for (const unregister of entry.commandUnregisters) {
      unregister();
    }
    entry.commandUnregisters = [];

    entry.state = 'deactivated';
    entry.disposable = undefined;
  }

  /** Unload a plugin completely */
  unload(id: string): void {
    this.deactivate(id);
    this.plugins.delete(id);
  }

  /** Check if a plugin is active */
  isActive(id: string): boolean {
    return this.plugins.get(id)?.state === 'active';
  }

  /** Get all loaded plugin ids */
  getLoadedIds(): string[] {
    return Array.from(this.plugins.keys());
  }
}
