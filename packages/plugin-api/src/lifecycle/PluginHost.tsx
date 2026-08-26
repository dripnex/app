import { useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import type { PluginManifest, EditorAPI, AppAPI } from '../types';
import type { DataAPI } from '../data/createDataAPI';
import { PLUGIN_API_VERSION } from '../apiVersion';
import type { PluginPackageFiles } from '../packageFiles/applyPluginPackageFiles';
import {
  PluginRegistry,
  type RegisterCommandFn,
  type ConfigBridge,
  type SetDefaultKeybindingFn,
} from './PluginRegistry';
import { planPluginHostSync } from './pluginHostActions';

interface PluginHostProps {
  plugins: PluginManifest[];
  editorAPI: EditorAPI;
  appAPI: AppAPI;
  dataAPI: DataAPI;
  registerCommand?: RegisterCommandFn;
  configBridge?: ConfigBridge;
  getView?: () => EditorView | null;
  packageFiles?: Record<string, PluginPackageFiles>;
  setDefaultKeybinding?: SetDefaultKeybindingFn;
}

/**
 * Headless React component that manages plugin lifecycle.
 * Loads and activates plugins on mount, deactivates on unmount.
 * Re-scans are incremental: a newly installed pack is activated without
 * unloading the rest (full teardown is unmount only).
 *
 * Usage:
 * ```tsx
 * <PluginHost
 *   plugins={[wordCountPlugin]}
 *   editorAPI={editorAPI}
 *   appAPI={appAPI}
 *   registerCommand={(cmd) => registry.register(cmd)}
 *   configBridge={configBridge}
 * />
 * ```
 */
export function PluginHost({
  plugins,
  editorAPI,
  appAPI,
  dataAPI,
  registerCommand,
  configBridge,
  getView,
  packageFiles,
  setDefaultKeybinding,
}: PluginHostProps) {
  const registryRef = useRef<PluginRegistry | null>(null);

  if (!registryRef.current) {
    registryRef.current = new PluginRegistry();
  }

  const apisRef = useRef({
    editorAPI,
    appAPI,
    dataAPI,
    registerCommand,
    configBridge,
    getView,
    packageFiles,
    setDefaultKeybinding,
  });
  apisRef.current = {
    editorAPI,
    appAPI,
    dataAPI,
    registerCommand,
    configBridge,
    getView,
    packageFiles,
    setDefaultKeybinding,
  };

  const pluginsRef = useRef(plugins);
  pluginsRef.current = plugins;

  // Load/unload by id. A new `plugins` array from a re-scan must not
  // deactivate every plugin — that remount raced theme activation and
  // exited the Linux AppImage after Settings → Themes → Install.
  const pluginIdKey = plugins.map(p => p.id).join('\0');

  useEffect(() => {
    const registry = registryRef.current!;
    let cancelled = false;
    const next = pluginsRef.current;
    const loadedIds = registry.getLoadedIds();
    const activeIds = loadedIds.filter(id => registry.isActive(id));
    const { unload, activate, skipped } = planPluginHostSync(loadedIds, activeIds, next);

    for (const id of unload) {
      registry.unload(id);
    }

    for (const { plugin, missingDeps } of skipped) {
      console.warn(
        `[PluginHost] Skipping "${plugin.id}": missing dependencies: ${missingDeps.join(', ')}`
      );
    }

    const activateNew = async () => {
      const apis = apisRef.current;
      for (const manifest of activate) {
        if (cancelled) return;

        if (manifest.apiVersion && manifest.apiVersion !== PLUGIN_API_VERSION) {
          console.warn(
            `[PluginHost] Plugin "${manifest.id}" targets API v${manifest.apiVersion} but current is v${PLUGIN_API_VERSION}, skipping`
          );
          continue;
        }

        if (!registry.getLoadedIds().includes(manifest.id)) {
          const loaded = registry.load(manifest);
          if (!loaded) continue;
        }
        if (registry.isActive(manifest.id)) continue;
        try {
          await registry.activate(
            manifest.id,
            apis.editorAPI,
            apis.appAPI,
            apis.dataAPI,
            apis.registerCommand,
            apis.configBridge,
            apis.getView,
            apis.packageFiles?.[manifest.id],
            apis.setDefaultKeybinding
          );
        } catch (error) {
          console.error(`[PluginHost] Failed to activate ${manifest.id}:`, error);
        }
        if (cancelled) return;
      }
    };

    void activateNew();

    return () => {
      cancelled = true;
    };
  }, [pluginIdKey]);

  useEffect(() => {
    const registry = registryRef.current!;
    return () => {
      for (const id of registry.getLoadedIds()) {
        registry.unload(id);
      }
    };
  }, []);

  // Headless - renders nothing
  return null;
}
