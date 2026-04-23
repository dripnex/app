/**
 * Preload API barrel — re-exports all module creators and interfaces.
 */

export { createNotesApi } from './notes';
export type { NotesAPI } from './notes';

export { createNotebooksApi } from './notebooks';
export type { NotebooksAPI } from './notebooks';

export { createDataApi } from './data';
export type { DataAPI } from './data';

export { createSyncApi, createEncryptionApi } from './sync';
export type { SyncAPI, EncryptionAPI } from './sync';

export { createAuthApi } from './auth';
export type { AuthAPI } from './auth';

export { createPluginsApi, createPluginConfigApi } from './plugins';
export type { PluginsAPI, PluginConfigAPI } from './plugins';

export { createDevicesApi } from './devices';
export type { DevicesAPI } from './devices';

export { createSubscriptionApi, createLicenseApi } from './subscription';
export type { SubscriptionAPI, LicenseAPI } from './subscription';

export { createAiApi } from './ai';
export type { AiAPI } from './ai';

export { createGitApi } from './git';
export type { GitAPI } from './git';

export { createUpdatesApi } from './updates';
export type { UpdatesAPI } from './updates';

export { createSettingsApi, createIpcApi, createThemeApi } from './settings';
export type { SettingsAPI, IpcAPI, ThemeAPI } from './settings';

export {
  createAppApi,
  createLogApi,
  createLinksApi,
  createEmbedsApi,
  createWindowsApi,
  createShareApi,
  createEditorApi,
} from './app';
export type {
  AppVersionAPI,
  LogAPI,
  LinksAPI,
  EmbedsAPI,
  WindowsAPI,
  ShareAPI,
  EditorAPI,
} from './app';
