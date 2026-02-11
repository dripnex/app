import { useEffect, useRef } from 'react';
import type { PluginManifest, EditorAPI, AppAPI } from '../types';
import { PluginRegistry, type RegisterCommandFn, type ConfigBridge } from './PluginRegistry';

interface PluginHostProps {
  plugins: PluginManifest[];
  editorAPI: EditorAPI;
  appAPI: AppAPI;
  registerCommand?: RegisterCommandFn;
  configBridge?: ConfigBridge;
}

/**
 * Headless React component that manages plugin lifecycle.
 * Loads and activates plugins on mount, deactivates on unmount.
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
export function PluginHost({ plugins, editorAPI, appAPI, registerCommand, configBridge }: PluginHostProps) {
  const registryRef = useRef<PluginRegistry | null>(null);

  if (!registryRef.current) {
    registryRef.current = new PluginRegistry();
  }

  useEffect(() => {
    const registry = registryRef.current!;
    let cancelled = false;

    // Load and activate all plugins (async for config hydration)
    const activateAll = async () => {
      for (const manifest of plugins) {
        if (cancelled) return;
        const loaded = registry.load(manifest);
        if (!loaded) continue; // validation failed, skip
        await registry.activate(manifest.id, editorAPI, appAPI, registerCommand, configBridge);
      }
    };

    activateAll();

    return () => {
      cancelled = true;
      // Deactivate all on unmount
      for (const manifest of plugins) {
        registry.unload(manifest.id);
      }
    };
  }, [plugins, editorAPI, appAPI, registerCommand, configBridge]);

  // Headless - renders nothing
  return null;
}
