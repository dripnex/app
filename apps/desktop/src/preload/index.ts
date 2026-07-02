/**
 * Electron Preload Script
 *
 * Exposes a typed API to the renderer process via contextBridge.
 * Each domain lives in its own module under ./api/.
 */

import { contextBridge } from 'electron';
import {
  createNotesApi,
  createNotebooksApi,
  createDataApi,
  createSyncApi,
  createEncryptionApi,
  createAuthApi,
  createPluginsApi,
  createPluginConfigApi,
  createDevicesApi,
  createSubscriptionApi,
  createLicenseApi,
  createAiApi,
  createGitApi,
  createUpdatesApi,
  createSettingsApi,
  createIpcApi,
  createThemeApi,
  createAppApi,
  createLogApi,
  createLinksApi,
  createEmbedsApi,
  createWindowsApi,
  createShareApi,
  createEditorApi,
  createLocalServerApi,
} from './api';
import type {
  NotesAPI,
  NotebooksAPI,
  DataAPI,
  SyncAPI,
  EncryptionAPI,
  AuthAPI,
  PluginsAPI,
  PluginConfigAPI,
  DevicesAPI,
  SubscriptionAPI,
  LicenseAPI,
  AiAPI,
  GitAPI,
  UpdatesAPI,
  SettingsAPI,
  IpcAPI,
  ThemeAPI,
  AppVersionAPI,
  LogAPI,
  LinksAPI,
  EmbedsAPI,
  WindowsAPI,
  ShareAPI,
  EditorAPI,
  LocalServerAPI,
} from './api';

// Re-export all types so the renderer can still import from '../preload/index'
export type {
  Result,
  NoteStatus,
  NoteSnapshot,
  NotebookSnapshot,
  NotebookWithMetadata,
  NotebookTreeNode,
  NotebookTree,
  ListOptions,
  NoteCounts,
  BackupInfo,
  BackupResult,
  ExportResult,
  ImportResult,
  DataPaths,
  LicenseStatus,
  TrialInfo,
  SubscriptionInfo,
  LicenseState,
  LicenseResult,
  TagWithColor,
  BacklinkInfo,
  OutgoingLinkInfo,
  GraphData,
  LogLevel,
  User,
  SyncChange,
  PullResponse,
  PushResult,
  PushResponse,
  SyncStatus,
  SubscriptionStatus,
  PluginConfigSchemaField,
  ScannedPlugin,
  PluginRegistryState,
} from './api/types';

/** The API exposed to the renderer */
export interface DripnexAPI {
  notes: NotesAPI;
  notebooks: NotebooksAPI;
  data: DataAPI;
  app: AppVersionAPI;
  license: LicenseAPI;
  log: LogAPI;
  links: LinksAPI;
  embeds: EmbedsAPI;
  windows: WindowsAPI;
  auth: AuthAPI;
  sync: SyncAPI;
  subscription: SubscriptionAPI;
  devices: DevicesAPI;
  settings: SettingsAPI;
  ipc: IpcAPI;
  share: ShareAPI;
  encryption: EncryptionAPI;
  git: GitAPI;
  updates: UpdatesAPI;
  ai: AiAPI;
  pluginConfig: PluginConfigAPI;
  theme: ThemeAPI;
  plugins: PluginsAPI;
  editor: EditorAPI;
  localServer: LocalServerAPI;
}

// Compose and expose the API
const api: DripnexAPI = {
  notes: createNotesApi(),
  notebooks: createNotebooksApi(),
  data: createDataApi(),
  app: createAppApi(),
  license: createLicenseApi(),
  log: createLogApi(),
  links: createLinksApi(),
  embeds: createEmbedsApi(),
  windows: createWindowsApi(),
  auth: createAuthApi(),
  sync: createSyncApi(),
  subscription: createSubscriptionApi(),
  devices: createDevicesApi(),
  settings: createSettingsApi(),
  ipc: createIpcApi(),
  share: createShareApi(),
  encryption: createEncryptionApi(),
  git: createGitApi(),
  updates: createUpdatesApi(),
  ai: createAiApi(),
  pluginConfig: createPluginConfigApi(),
  theme: createThemeApi(),
  plugins: createPluginsApi(),
  editor: createEditorApi(),
  localServer: createLocalServerApi(),
};

contextBridge.exposeInMainWorld('dripnex', api);

// Type augmentation for window
declare global {
  interface Window {
    dripnex: DripnexAPI;
  }
}
