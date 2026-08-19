import { createLogger } from '@dripnex/logger';
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
  PluginAiCommandOptions,
  PluginHookOptions,
} from '../types';
import type { DataAPI } from '../data/createDataAPI';
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
import { aiCommandStore } from '../ai/aiCommandStore';
import { pluginMenuStore } from '../menu/pluginMenuStore';
import { pluginContextMenuStore } from '../menu/pluginContextMenuStore';
import { hostNotify } from '../loader/hostBridges';
import { previewEventStore } from '../preview/previewEventStore';
import { pluginComponents } from '../components/catalog.js';
import { createMarkdownRenderer } from '../preview/createMarkdownRenderer.js';
import {
  applyPluginPackageFiles,
  type PluginPackageFiles,
} from '../packageFiles/applyPluginPackageFiles';
import type { PluginKeymapBinding } from '../packageFiles/parsePluginKeymap';
import {
  applyPluginConfig,
  clearPluginConfig,
  getPluginConfig,
  observePluginConfig,
  resetPluginConfig,
} from './configRuntime';

export const MAX_CRASH_COUNT = 3;

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
    execute: (payload?: Record<string, unknown>) => boolean | void | Promise<boolean | void>;
  }): () => void;
}

/** Bridge for config persistence (injected by host) */
export interface ConfigBridge {
  getAll: (pluginId: string) => Promise<Record<string, unknown>>;
  set: (pluginId: string, key: string, value: unknown) => Promise<void>;
}

export type SetDefaultKeybindingFn = (
  commandId: string,
  keybinding: PluginKeymapBinding['keybinding']
) => boolean;

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
    dataAPI: DataAPI,
    registerCommandFn?: RegisterCommandFn,
    configBridge?: ConfigBridge,
    getView?: () => EditorView | null,
    packageFiles?: PluginPackageFiles,
    setDefaultKeybinding?: SetDefaultKeybindingFn
  ): Promise<void> {
    const entry = this.plugins.get(id);
    if (!entry) {
      console.error(`Plugin "${id}" not found.`);
      return;
    }

    if (entry.state === 'active') {
      return; // Already active
    }

    if (entry.state === 'error' && entry.errorCount >= MAX_CRASH_COUNT) {
      console.warn(
        `[plugin:${id}] Auto-disabled after ${entry.errorCount} crashes. Call resetErrors() to re-enable.`
      );
      return;
    }

    // Build registerCommand wrapper with auto-prefix + defaults
    const registerCommand = (
      options: PluginCommandOptions,
      execute: (payload?: Record<string, unknown>) => boolean | void | Promise<boolean | void>
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
    resetPluginConfig(id, configCache);

    const config: PluginConfigAPI = {
      get<T>(key: string): T | undefined {
        return getPluginConfig<T>(id, key);
      },
      set(key: string, value: unknown) {
        applyPluginConfig(id, key, value);
        if (configBridge) {
          void configBridge.set(id, key, value);
        }
      },
      observe<T>(key: string, callback: (value: T) => void) {
        return observePluginConfig(id, key, raw => {
          callback(raw as T);
        });
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

    const trackedData: DataAPI = {
      ...dataAPI,
      onNotesChanged(callback) {
        const unsub = dataAPI.onNotesChanged(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
      onNotebooksChanged(callback) {
        const unsub = dataAPI.onNotebooksChanged(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
      onTagsChanged(callback) {
        const unsub = dataAPI.onTagsChanged(callback);
        const tracked = () => {
          unsub();
          entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
        };
        entry.eventUnsubscribers.push(tracked);
        return tracked;
      },
    };

    const menu = {
      add(item: {
        label: string;
        accelerator?: string;
        command?: string;
        click?: () => boolean | void | Promise<boolean | void>;
      }): () => void {
        const localId =
          item.command ?? `menu-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const commandId = localId.startsWith('plugin:') ? localId : `plugin:${id}:${localId}`;
        if (item.click) {
          registerCommand(
            {
              id: localId.startsWith('plugin:') ? localId.slice(`plugin:${id}:`.length) : localId,
              name: item.label,
              keybinding: parseAccelerator(item.accelerator),
              showInPalette: true,
            },
            item.click
          );
        }
        pluginMenuStore.getState().add({
          pluginId: id,
          label: item.label,
          commandId,
          accelerator: item.accelerator,
        });
        return () => pluginMenuStore.getState().remove(commandId);
      },
    };

    const notifications = {
      addSuccess(message: string) {
        hostNotify('success', message);
      },
      addInfo(message: string) {
        hostNotify('info', message);
      },
      addWarning(message: string) {
        hostNotify('warning', message);
      },
      addError(message: string) {
        hostNotify('error', message);
      },
    };

    const contextMenu = {
      add(
        target: 'note-list-item' | 'notebook-item' | 'tag-item' | 'editor',
        item: {
          label: string;
          command?: string;
          click?: (payload?: Record<string, unknown>) => boolean | void | Promise<boolean | void>;
        }
      ): () => void {
        const localId =
          item.command ?? `ctx-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const commandId = localId.startsWith('plugin:') ? localId : `plugin:${id}:${localId}`;
        if (item.click) {
          registerCommand(
            {
              id: localId.startsWith('plugin:') ? localId.slice(`plugin:${id}:`.length) : localId,
              name: item.label,
              showInPalette: false,
            },
            item.click
          );
        }
        pluginContextMenuStore.getState().add({
          pluginId: id,
          target,
          label: item.label,
          commandId,
        });
        return () => pluginContextMenuStore.getState().remove(commandId);
      },
    };

    const clipboard = createClipboardApi();

    const preview = {
      on(
        event: 'a:click' | 'checkbox:change',
        handler: (detail: {
          href?: string;
          text?: string;
          index?: number;
          checked?: boolean;
        }) => boolean | void
      ): () => void {
        return previewEventStore.getState().on(id, event, handler);
      },
    };

    const context: PluginContext = {
      layout: createLayoutManager(id),
      editor: trackedEditor,
      decorations: decoResult?.api ?? noopDecorations,
      menu,
      clipboard,
      notifications,
      contextMenu,
      preview,
      components: pluginComponents,
      markdownRenderer: createMarkdownRenderer(id),
      registerExtensions: (extId: string, extensions: Extension[]) => {
        editorPluginStore.getState().register({
          id: extId,
          pluginId: id,
          extensions,
        });
        return () => editorPluginStore.getState().unregister(extId);
      },
      registerCommand,
      registerRemarkPlugin: (
        regId: string,
        plugin: unknown,
        options?: PluginHookOptions
      ): (() => void) => {
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
      registerRehypePlugin: (
        regId: string,
        plugin: unknown,
        options?: PluginHookOptions
      ): (() => void) => {
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
      registerAiCommand: (options: PluginAiCommandOptions): (() => void) => {
        const registrationId = `${id}:${options.id}`;
        aiCommandStore.getState().register({
          id: registrationId,
          pluginId: id,
          name: options.name,
          description: options.description,
          systemPrompt: options.systemPrompt,
          userPromptTemplate: options.userPromptTemplate,
          icon: options.icon,
          outputTarget: options.outputTarget,
          category: options.category,
        });
        return () => aiCommandStore.getState().unregister(registrationId);
      },
      registerCssVariables: (regId: string, variables: Record<string, string>): (() => void) => {
        cssVariableStore.getState().register({ id: regId, pluginId: id, variables });
        return () => cssVariableStore.getState().unregister(regId);
      },
      registerTheme: (theme): (() => void) => {
        const success = themeRegistryStore.getState().register({
          ...theme,
          pluginId: id,
        });
        if (!success) {
          console.warn(`[${id}] Theme registration failed for "${theme.id}" (no valid tokens)`);
        }
        return () => themeRegistryStore.getState().unregister(theme.id);
      },
      config,
      log: createLogger(id),
      app: trackedApp,
      data: trackedData,
    };

    try {
      const disposable = entry.manifest.activate(context);
      entry.state = 'active';
      entry.disposable = disposable ?? undefined;
      if (packageFiles) {
        const applied = applyPluginPackageFiles(id, packageFiles, { setDefaultKeybinding });
        for (const err of applied.errors) {
          console.warn(`[plugin:${id}] ${err}`);
        }
      }
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
      aiCommandStore.getState().unregisterAll(id);
      pluginMenuStore.getState().removeAll(id);
      pluginContextMenuStore.getState().removeAll(id);
      previewEventStore.getState().removeAll(id);
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

    // Cleanup AI command registrations
    aiCommandStore.getState().unregisterAll(id);
    pluginMenuStore.getState().removeAll(id);
    pluginContextMenuStore.getState().removeAll(id);
    previewEventStore.getState().removeAll(id);

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
    clearPluginConfig(id);
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

  /** Reset error state so a plugin can be retried */
  resetErrors(id: string): void {
    const entry = this.plugins.get(id);
    if (!entry) return;
    entry.errorCount = 0;
    entry.lastError = undefined;
    if (entry.state === 'error') {
      entry.state = 'loaded';
    }
  }

  /** Check if a plugin is auto-disabled due to too many crashes */
  isAutoDisabled(id: string): boolean {
    const entry = this.plugins.get(id);
    if (!entry) return false;
    return entry.state === 'error' && entry.errorCount >= MAX_CRASH_COUNT;
  }
}

function createClipboardApi(): PluginContext['clipboard'] {
  const host = (
    globalThis as {
      window?: {
        dripnex?: {
          clipboard?: {
            readText: () => Promise<string>;
            writeText: (text: string) => Promise<void>;
          };
        };
      };
    }
  ).window?.dripnex?.clipboard;

  return {
    async readText() {
      if (host?.readText) {
        try {
          return await host.readText();
        } catch {
          return '';
        }
      }
      try {
        return await navigator.clipboard.readText();
      } catch {
        return '';
      }
    },
    async writeText(text) {
      if (host?.writeText) {
        await host.writeText(text);
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // locked session / missing permission
      }
    },
  };
}

function parseAccelerator(
  accelerator: string | undefined
): PluginCommandOptions['keybinding'] | undefined {
  if (!accelerator) return undefined;
  const parts = accelerator
    .split('+')
    .map(p => p.trim())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) return undefined;
  const modifiers = parts.map(p => (p === 'CmdOrCtrl' || p === 'Command' ? 'Mod' : p));
  return { key, modifiers };
}
