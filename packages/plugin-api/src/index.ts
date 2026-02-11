// Types
export type {
  EditorAPI,
  AppAPI,
  NoteInfo,
  PluginManifest,
  PluginContext,
  PluginDisposable,
  PluginConfigSchema,
  PluginConfigAPI,
  PluginLogger,
  PluginCommandOptions,
} from './types';

// Layout
export type { LayoutZoneName, ZoneEntry, ZoneComponentProps, LayoutManager } from './layout/types';
export { layoutStore, createLayoutManager } from './layout/layoutStore';
export { LayoutZone } from './layout/LayoutZone';

// Editor
export type { EditorAPIWithEvents } from './editor/createEditorAPI';
export { createEditorAPI } from './editor/createEditorAPI';
export { editorPluginStore, pluginExtensionCompartment } from './editor/editorPluginStore';

// App
export type { AppAPIWithEvents, AppAPIBridge } from './app/createAppAPI';
export { createAppAPI } from './app/createAppAPI';

// Validation
export { validateManifest, assertValidManifest } from './validation';
export type { ManifestError } from './validation';

// Loader
export { loadPluginFromSource } from './loader/loadPluginFromSource';

// Lifecycle
export { PluginRegistry } from './lifecycle/PluginRegistry';
export type { RegisterCommandFn, ConfigBridge } from './lifecycle/PluginRegistry';
export { PluginHost } from './lifecycle/PluginHost';
