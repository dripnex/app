/**
 * Plugin Runtime Store
 *
 * Single source of truth for discovered plugin state.
 * Owns scanning, loading, and reload lifecycle.
 * React observes this store — it does not drive it.
 *
 * IPC listener for cross-window reload lives here,
 * not in a React hook or component lifecycle.
 */

import { createStore } from 'zustand/vanilla';
import type { PluginManifest } from '@readied/plugin-api';
import { loadPluginFromSource, loadInitScript } from '@readied/plugin-api';

export interface PluginLoadError {
  pluginId: string;
  pluginName: string;
  reason: string;
}

export interface PluginLoadTiming {
  pluginId: string;
  pluginName: string;
  loadTimeMs: number;
}

type RuntimeStatus = 'idle' | 'scanning' | 'ready';

interface PluginRuntimeState {
  /** Successfully loaded plugin manifests */
  plugins: PluginManifest[];
  /** Plugins that failed to load */
  errors: PluginLoadError[];
  /** Load timing per plugin */
  timings: PluginLoadTiming[];
  /** Current lifecycle status */
  status: RuntimeStatus;
}

interface PluginRuntimeActions {
  /** Initial scan — also starts IPC listener. Call once on app boot. */
  init(): Promise<void>;
  /** Re-scan and reload plugins. Idempotent, race-safe. */
  reload(): Promise<void>;
}

type PluginRuntimeStore = PluginRuntimeState & PluginRuntimeActions;

/** Monotonic generation counter for race protection */
let scanGeneration = 0;

/** Whether IPC listener has been attached */
let listenerAttached = false;

function attachIpcListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  window.readied.ipc.on('plugins:reload', () => {
    pluginRuntimeStore.getState().reload();
  });
}

async function executeScan(generation: number): Promise<{
  plugins: PluginManifest[];
  errors: PluginLoadError[];
  timings: PluginLoadTiming[];
} | null> {
  try {
    const [scanned, stateList, initCode] = await Promise.all([
      window.readied.plugins.scan(),
      window.readied.plugins.listState(),
      window.readied.plugins.readInitScript(),
    ]);

    // Race check: another scan started while this one was in-flight
    if (scanGeneration !== generation) return null;

    const stateMap = new Map(stateList.map(s => [s.pluginId, s.enabled]));
    const plugins: PluginManifest[] = [];
    const errors: PluginLoadError[] = [];
    const timings: PluginLoadTiming[] = [];

    for (const sp of scanned) {
      const enabled = stateMap.get(sp.id) ?? true;
      if (!enabled) continue;

      const start = performance.now();
      const manifest = loadPluginFromSource(sp.code, sp.id);
      const elapsed = performance.now() - start;

      if (manifest) {
        plugins.push(manifest);
        timings.push({ pluginId: sp.id, pluginName: sp.name, loadTimeMs: elapsed });
      } else {
        errors.push({
          pluginId: sp.id,
          pluginName: sp.name,
          reason: 'Failed to load plugin code',
        });
      }
    }

    // Load init.js user script (if present)
    if (initCode) {
      const initManifest = loadInitScript(initCode);
      if (initManifest) {
        const enabled = stateMap.get(initManifest.id) ?? true;
        if (enabled) {
          plugins.push(initManifest);
        }
      } else {
        errors.push({
          pluginId: 'user-init',
          pluginName: 'init.js',
          reason: 'Failed to load init.js — check console for details',
        });
      }
    }

    // Race check again after CPU-bound eval loop
    if (scanGeneration !== generation) return null;

    return { plugins, errors, timings };
  } catch (error) {
    console.error('[pluginRuntime] scan failed:', error);
    return null;
  }
}

export const pluginRuntimeStore = createStore<PluginRuntimeStore>(set => ({
  plugins: [],
  errors: [],
  timings: [],
  status: 'idle',

  async init() {
    attachIpcListener();
    const gen = ++scanGeneration;
    set({ status: 'scanning' });
    const result = await executeScan(gen);
    if (result) {
      set({
        plugins: result.plugins,
        errors: result.errors,
        timings: result.timings,
        status: 'ready',
      });
    } else if (scanGeneration === gen) {
      set({ status: 'ready' });
    }
  },

  async reload() {
    const gen = ++scanGeneration;
    set({ status: 'scanning' });
    const result = await executeScan(gen);
    if (result) {
      set({
        plugins: result.plugins,
        errors: result.errors,
        timings: result.timings,
        status: 'ready',
      });
    } else if (scanGeneration === gen) {
      set({ status: 'ready' });
    }
  },
}));
