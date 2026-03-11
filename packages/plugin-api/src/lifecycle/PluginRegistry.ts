import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { ComponentType } from 'react';
import type {
  PluginManifest,
  PluginContext,
  PluginConfigAPI,
  PluginDisposable,
  EditorAPI,
  AppAPI,
  PluginCommandOptions,
  PluginHookOptions,
} from '../types';
import { createLayoutManager } from '../layout/layoutStore';
import { editorPluginStore } from '../editor/editorPluginStore';
import { createDecorationAPI } from '../editor/decorationAPI';
import { validateManifest } from '../validation';
import { remarkPluginStore } from '../preview/remarkPluginStore';
import { rehypePluginStore } from '../preview/rehypePluginStore';
import { previewComponentStore } from '../preview/previewComponentStore';
import { codeBlockStore } from '../preview/codeBlockStore';
import type { CodeBlockRendererProps } from '../preview/codeBlockStore';
import { cssVariableStore } from '../theme/cssVariableStore';
import { themeRegistryStore } from '../theme/themeRegistryStore';

type PluginState = 'loaded' | 'active' | 'deactivated' | 'error';

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
  /** Event unsubscribers tracked by the auto-cleanup wrapper */
  eventUnsubscribers: Array<() => void>;
  /** Number of times activate() has thrown */
  errorCount: number;
  /** Last error message if state is 'error' */
  lastError?: string;
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
      eventUnsubscribers: [],
      errorCount: 0,
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
    getView?: () => EditorView | null
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
      execute: () => boolean | void | Promise<boolean | void>
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
    const configCache: Record<string, unknown> = configBridge ? await configBridge.getAll(id) : {};

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

    // Create decoration API if getView is provided
    const decoResult = getView ? createDecorationAPI(getView) : null;

    // Auto-register the decoration extension
    if (decoResult) {
      editorPluginStore.getState().register({
        id: `__decorations:${id}`,
        pluginId: id,
        extensions: [decoResult.extension],
      });
    }

    const noopDecorations = {
      addLineHighlight: () => () => {},
      addWidget: () => () => {},
      clear: () => {},
    };

    // Wrap editor and app APIs with auto-tracking for event subscriptions.
    // Any on*() listener the plugin registers is tracked; if the plugin forgets
    // to unsubscribe in dispose(), deactivate() cleans up automatically.
    const trackedEditor: EditorAPI = {
      ...editorAPI,
      onDocChanged(callback) {
        const unsub = editorAPI.onDocChanged(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
      onSelectionChanged(callback) {
        const unsub = editorAPI.onSelectionChanged(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
    };

    const trackedApp: AppAPI = {
      ...appAPI,
      onNoteSelected(callback) {
        const unsub = appAPI.onNoteSelected(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
      onNoteCreated(callback) {
        const unsub = appAPI.onNoteCreated(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
      onNoteDeleted(callback) {
        const unsub = appAPI.onNoteDeleted(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
    };

    const context: PluginContext = {
      layout: createLayoutManager(id),
      editor: trackedEditor,
      decorations: decoResult?.api ?? noopDecorations,
      registerExtensions: (extId: string, extensions: Extension[]) => {
        editorPluginStore.getState().register({
          id: extId,
          pluginId: id,
          extensions,
        });
        return () => editorPluginStore.getState().unregister(extId);
      },
      registerCommand,
      registerRemarkPlugin: (regId: string, plugin: unknown, options?: PluginHookOptions): (() => void) => {
        remarkPluginStore.getState().register({
          id: regId,
          pluginId: id,
          plugin,
          metadata: {
            name: options?.name ?? entry.manifest.name,
            version: options?.version ?? entry.manifest.version,
            priority: options?.priority ?? 100,
          },
        });
        return () => remarkPluginStore.getState().unregister(regId);
      },
      registerRehypePlugin: (regId: string, plugin: unknown, options?: PluginHookOptions): (() => void) => {
        rehypePluginStore.getState().register({
          id: regId,
          pluginId: id,
          plugin,
          metadata: {
            name: options?.name ?? entry.manifest.name,
            version: options?.version ?? entry.manifest.version,
            priority: options?.priority ?? 100,
          },
        });
        return () => rehypePluginStore.getState().unregister(regId);
      },
      registerPreviewComponent: (
        regId: string,
        tagName: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component: ComponentType<any>
      ): (() => void) => {
        previewComponentStore.getState().register({
          id: regId,
          pluginId: id,
          tagName,
          component,
        });
        return () => previewComponentStore.getState().unregister(regId);
      },
      registerCodeBlockRenderer: (
        regId: string,
        language: string,
        component: ComponentType<CodeBlockRendererProps>
      ): (() => void) => {
        codeBlockStore.getState().register({ id: regId, pluginId: id, language, component });
        return () => codeBlockStore.getState().unregister(regId);
      },
      registerCssVariables: (regId: string, variables: Record<string, string>): (() => void) => {
        cssVariableStore.getState().register({ id: regId, pluginId: id, variables });
        return () => cssVariableStore.getState().unregister(regId);
      },
      registerTheme: (theme): (() => void) => {
        themeRegistryStore.getState().register({
          ...theme,
          pluginId: id,
        });
        return () => themeRegistryStore.getState().unregister(theme.id);
      },
      config,
      log: {
        // eslint-disable-next-line no-console
        info: (msg: string, ...args: unknown[]) => console.info(`[${id}]`, msg, ...args),
        warn: (msg: string, ...args: unknown[]) => console.warn(`[${id}]`, msg, ...args),
        error: (msg: string, ...args: unknown[]) => console.error(`[${id}]`, msg, ...args),
      },
      app: trackedApp,
    };

    try {
      const disposable = entry.manifest.activate(context);
      entry.state = 'active';
      entry.disposable = disposable ?? undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[plugin:${id}] activate() threw:`, error);
      entry.errorCount++;
      entry.lastError = message;
      entry.state = 'error';

      // Cleanup any partial registrations the plugin may have made before crashing
      editorPluginStore.getState().unregisterAll(id);
      remarkPluginStore.getState().unregisterAll(id);
      rehypePluginStore.getState().unregisterAll(id);
      previewComponentStore.getState().unregisterAll(id);
      codeBlockStore.getState().unregisterAll(id);
      cssVariableStore.getState().unregisterAll(id);
      themeRegistryStore.getState().unregisterAll(id);
      const layoutManager = createLayoutManager(id);
      layoutManager.removeAllForPlugin(id);
      for (const unregister of entry.commandUnregisters) {
        unregister();
      }
      entry.commandUnregisters = [];
    }
  }

  /** Deactivate an active plugin */
  deactivate(id: string): void {
    const entry = this.plugins.get(id);
    if (!entry || entry.state !== 'active') return;

    // Call disposable (guarded)
    try {
      entry.disposable?.dispose();
    } catch (error) {
      console.error(`[plugin:${id}] dispose() threw:`, error);
    }

    // Call deactivate lifecycle (guarded)
    try {
      entry.manifest.deactivate?.();
    } catch (error) {
      console.error(`[plugin:${id}] deactivate() threw:`, error);
    }

    // Cleanup layout entries
    const layoutManager = createLayoutManager(id);
    layoutManager.removeAllForPlugin(id);

    // Cleanup editor extensions
    editorPluginStore.getState().unregisterAll(id);

    // Cleanup preview stores
    remarkPluginStore.getState().unregisterAll(id);
    rehypePluginStore.getState().unregisterAll(id);
    previewComponentStore.getState().unregisterAll(id);
    codeBlockStore.getState().unregisterAll(id);

    // Cleanup theme stores
    cssVariableStore.getState().unregisterAll(id);
    themeRegistryStore.getState().unregisterAll(id);

    // Safety net: unregister any remaining plugin commands
    for (const unregister of entry.commandUnregisters) {
      unregister();
    }
    entry.commandUnregisters = [];

    // Safety net: unsubscribe any leaked event listeners
    for (const unsub of entry.eventUnsubscribers) {
      unsub();
    }
    entry.eventUnsubscribers = [];

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

  /** Check if a plugin is in error state */
  hasError(id: string): boolean {
    return this.plugins.get(id)?.state === 'error';
  }

  /** Get error info for a plugin */
  getError(id: string): { message: string; count: number } | null {
    const entry = this.plugins.get(id);
    if (!entry || entry.state !== 'error') return null;
    return { message: entry.lastError ?? 'Unknown error', count: entry.errorCount };
  }
}
