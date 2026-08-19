import { ipcRenderer } from 'electron';
import type { BackupResult, BackupInfo, ExportResult, ImportResult, DataPaths } from './types';

export interface DataAPI {
  backup: () => Promise<BackupResult>;
  listBackups: () => Promise<BackupInfo[]>;
  restoreBackup: (backupPath: string) => Promise<BackupResult>;
  export: () => Promise<ExportResult>;
  exportNote: (
    content: string,
    suggestedName: string
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  exportFile: (
    content: string,
    suggestedName: string,
    kind: 'md' | 'html' | 'pdf'
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  printHtml: (html: string) => Promise<{ success: boolean; error?: string }>;
  import: () => Promise<ImportResult>;
  paths: () => Promise<DataPaths>;
  openFolder: () => Promise<{ success: boolean }>;
}

export function createDataApi(): DataAPI {
  return {
    backup: () => ipcRenderer.invoke('data:backup'),
    listBackups: () => ipcRenderer.invoke('data:backups:list'),
    restoreBackup: path => ipcRenderer.invoke('data:backup:restore', path),
    export: () => ipcRenderer.invoke('data:export'),
    exportNote: (content: string, suggestedName: string) =>
      ipcRenderer.invoke('data:exportNote', content, suggestedName),
    exportFile: (content, suggestedName, kind) =>
      ipcRenderer.invoke('data:exportFile', content, suggestedName, kind),
    printHtml: html => ipcRenderer.invoke('note:printHtml', html),
    import: () => ipcRenderer.invoke('data:import'),
    paths: () => ipcRenderer.invoke('data:paths'),
    openFolder: () => ipcRenderer.invoke('data:openFolder'),
  };
}
