export { createLogger } from '@dripnex/logger';

// Types
export type {
  EditorAPI,
  AppAPI,
  AppStore,
  AppStoreSnapshot,
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
export { createMarkdownRenderer } from './preview/createMarkdownRenderer';
export type { MarkdownRenderer } from './preview/createMarkdownRenderer';
export { remarkPluginStore } from './preview/remarkPluginStore';
export type { RemarkPluginRegistration } from './preview/remarkPluginStore';
export { rehypePluginStore } from './preview/rehypePluginStore';
export type { RehypePluginRegistration } from './preview/rehypePluginStore';
export { codeBlockStore } from './preview/codeBlockStore';
export type { CodeBlockRegistration, CodeBlockRendererProps } from './preview/codeBlockStore';
export { previewEventStore, emitPreviewEvent } from './preview/previewEventStore';
export type {
  PreviewEventName,
  PreviewEventDetail,
  PreviewEventHandler,
  PreviewLinkClickDetail,
  PreviewCheckboxChangeDetail,
} from './preview/previewEventStore';
export { safePluginWrapper } from './preview/safePluginWrapper';
export type { PluginMetadata } from './preview/safePluginWrapper';

// Theme
export { cssVariableStore } from './theme/cssVariableStore';
export type { CssVariableRegistration } from './theme/cssVariableStore';
export { useCssVariables } from './theme/useCssVariables';
export { pluginStyleStore } from './theme/pluginStyleStore';
export type { PluginStyleSheet } from './theme/pluginStyleStore';
export { usePluginStyles } from './theme/usePluginStyles';
export { useThemeOverrides } from './theme/useThemeOverrides';
export { themeRegistryStore } from './theme/themeRegistryStore';
export { createThemesApi } from './theme/createThemesApi';
export type { ThemesAPI, ThemeInfo } from './theme/createThemesApi';
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
export { pluginContextMenuStore } from './menu/pluginContextMenuStore';
export type { PluginContextMenuItem, PluginContextMenuTarget } from './menu/pluginContextMenuStore';

export { loadPluginFromSource } from './loader/loadPluginFromSource';
export type { LoadPluginOptions } from './loader/loadPluginFromSource';
export { loadInitScript } from './loader/loadInitScript';
export { createInitApi, USER_INIT_ID } from './loader/createInitApi';
export type { InitApi } from './loader/createInitApi';
export {
  setHostCommandDispatch,
  dispatchHostCommand,
  setHostNotify,
  hostNotify,
  setHostVim,
  getHostVim,
  setHostThemeActive,
  hostSetActiveTheme,
} from './loader/hostBridges';
export {
  EMPTY_STORE_SNAPSHOT,
  getHostStore,
  notifyHostStoreChanged,
  setHostStoreSnapshot,
} from './store/appStore';

// Lifecycle
export { PluginRegistry } from './lifecycle/PluginRegistry';
export type {
  RegisterCommandFn,
  ConfigBridge,
  SetDefaultKeybindingFn,
} from './lifecycle/PluginRegistry';
export { parsePluginKeymap, qualifyPluginCommandId } from './packageFiles/parsePluginKeymap';
export type {
  PluginKeymapBinding,
  ParsePluginKeymapResult,
} from './packageFiles/parsePluginKeymap';
export { parsePluginMenus } from './packageFiles/parsePluginMenus';
export { parsePluginTheme, createThemeOnlyManifest } from './packageFiles/parsePluginTheme';
export type {
  PluginPackageMenuItem,
  PluginPackageContextMenuItem,
  ParsePluginMenusResult,
} from './packageFiles/parsePluginMenus';
export { applyPluginPackageFiles } from './packageFiles/applyPluginPackageFiles';
export type {
  PluginPackageFiles,
  ApplyPackageFilesResult,
} from './packageFiles/applyPluginPackageFiles';
export { parsePluginChord } from './packageFiles/chords';
export type { PluginChord } from './packageFiles/chords';
export { applyPluginConfig } from './lifecycle/configRuntime';
export { PluginHost } from './lifecycle/PluginHost';
export { nextPluginHostActions, planPluginHostSync } from './lifecycle/pluginHostActions';
export type { PluginHostActions, PluginHostPlan } from './lifecycle/pluginHostActions';
export { sortPlugins } from './lifecycle/sortPlugins';
export type { SortResult } from './lifecycle/sortPlugins';

// API Version
export { pluginComponents } from './components/catalog';
export type { PluginComponents } from './components/catalog';
export { Button } from './components/Button';
export type { PluginButtonProps } from './components/Button';
export { Modal } from './components/Modal';
export type { PluginModalProps } from './components/Modal';
export { Dialog } from './components/Dialog';
export type { PluginDialogProps } from './components/Dialog';

export { PLUGIN_API_VERSION } from './apiVersion';
