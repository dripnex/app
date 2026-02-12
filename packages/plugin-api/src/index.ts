// Types
export type {
  EditorAPI,
  AppAPI,
  NoteInfo,
  NoteSummaryInfo,
  NotebookInfo,
  PluginManifest,
  PluginContext,
  PluginDisposable,
  PluginConfigSchema,
  PluginConfigSchemaField,
  PluginConfigAPI,
  PluginLogger,
  PluginCommandOptions,
} from './types';

// Layout
export type { LayoutZoneName, ZoneEntry, ZoneComponentProps, LayoutManager } from './layout/types';
export { layoutStore, createLayoutManager } from './layout/layoutStore';
export { LayoutZone } from './layout/LayoutZone';
export { PluginErrorBoundary } from './layout/PluginErrorBoundary';

// Editor
export type { EditorAPIWithEvents } from './editor/createEditorAPI';
export { createEditorAPI } from './editor/createEditorAPI';
export { editorPluginStore, pluginExtensionCompartment } from './editor/editorPluginStore';
export type { EditorDecorationAPI } from './editor/decorationAPI';
export { createDecorationAPI } from './editor/decorationAPI';

// App
export type { AppAPIWithEvents, AppAPIBridge } from './app/createAppAPI';
export { createAppAPI } from './app/createAppAPI';

// Preview
export { previewComponentStore } from './preview/previewComponentStore';
export type { PreviewComponentRegistration } from './preview/previewComponentStore';
export { remarkPluginStore } from './preview/remarkPluginStore';
export type { RemarkPluginRegistration } from './preview/remarkPluginStore';
export { rehypePluginStore } from './preview/rehypePluginStore';
export type { RehypePluginRegistration } from './preview/rehypePluginStore';
export { codeBlockStore } from './preview/codeBlockStore';
export type { CodeBlockRegistration, CodeBlockRendererProps } from './preview/codeBlockStore';

// Theme
export { cssVariableStore } from './theme/cssVariableStore';
export type { CssVariableRegistration } from './theme/cssVariableStore';
export { useCssVariables } from './theme/useCssVariables';

// Validation
export { validateManifest, assertValidManifest } from './validation';
export type { ManifestError } from './validation';

// Loader
export { loadPluginFromSource } from './loader/loadPluginFromSource';

// Lifecycle
export { PluginRegistry } from './lifecycle/PluginRegistry';
export type { RegisterCommandFn, ConfigBridge } from './lifecycle/PluginRegistry';
export { PluginHost } from './lifecycle/PluginHost';
