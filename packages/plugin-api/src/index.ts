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
  PluginAiCommandOptions,
  PluginHookOptions,
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

// Data
export type { DataAPI, DataAPIWithEvents, DataAPIBridge } from './data/createDataAPI';
export { createDataAPI } from './data/createDataAPI';
export type {
  NoteQueryOptions,
  NoteQueryResult,
  SearchOptions,
  SearchResult,
  NotebookQueryOptions,
  NotebookDetailInfo,
  NotebookTreeNode,
  NotebookResult,
  TagQueryOptions,
  TagInfo,
  GraphQueryOptions,
  GraphData,
  LinkInfo,
  OutgoingLinkInfo,
  DataChangeEvent,
} from './data/dataTypes';
export { DataAccessError } from './data/dataTypes';

// Preview
export { previewComponentStore } from './preview/previewComponentStore';
export type { PreviewComponentRegistration } from './preview/previewComponentStore';
export { remarkPluginStore } from './preview/remarkPluginStore';
export type { RemarkPluginRegistration } from './preview/remarkPluginStore';
export { rehypePluginStore } from './preview/rehypePluginStore';
export type { RehypePluginRegistration } from './preview/rehypePluginStore';
export { codeBlockStore } from './preview/codeBlockStore';
export type { CodeBlockRegistration, CodeBlockRendererProps } from './preview/codeBlockStore';
export { safePluginWrapper } from './preview/safePluginWrapper';
export type { PluginMetadata } from './preview/safePluginWrapper';

// Theme
export { cssVariableStore } from './theme/cssVariableStore';
export type { CssVariableRegistration } from './theme/cssVariableStore';
export { useCssVariables } from './theme/useCssVariables';
export { useThemeOverrides } from './theme/useThemeOverrides';
export { themeRegistryStore } from './theme/themeRegistryStore';
export {
  isValidThemeToken,
  validateThemeTokens,
  CORE_THEME_TOKENS,
  THEME_EXTENSION_SCOPES,
} from './theme/themeTypes';
export type { ThemeDefinition } from './theme/themeTypes';

// AI Commands
export { aiCommandStore } from './ai/aiCommandStore';
export type { AiCommandRegistration } from './ai/aiCommandStore';

// Validation
export { validateManifest, assertValidManifest, validateConfigValue } from './validation';
export type { ManifestError, ConfigValidationResult } from './validation';

// Loader
export { pluginMenuStore } from './menu/pluginMenuStore';
export type { PluginMenuItem } from './menu/pluginMenuStore';

export { loadPluginFromSource } from './loader/loadPluginFromSource';
export { loadInitScript } from './loader/loadInitScript';
export { createInitApi, USER_INIT_ID } from './loader/createInitApi';
export type { InitApi } from './loader/createInitApi';
export {
  setHostCommandDispatch,
  dispatchHostCommand,
  setHostVim,
  getHostVim,
} from './loader/hostBridges';

// Lifecycle
export { PluginRegistry } from './lifecycle/PluginRegistry';
export type { RegisterCommandFn, ConfigBridge } from './lifecycle/PluginRegistry';
export { applyPluginConfig } from './lifecycle/configRuntime';
export { PluginHost } from './lifecycle/PluginHost';
export { sortPlugins } from './lifecycle/sortPlugins';
export type { SortResult } from './lifecycle/sortPlugins';

// API Version
export { PLUGIN_API_VERSION } from './apiVersion';
