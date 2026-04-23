import { ipcRenderer } from 'electron';
import type { NotebookSnapshot, NotebookTree, NotebookWithMetadata } from './types';

export interface NotebooksAPI {
  list: () => Promise<NotebookSnapshot[]>;
  tree: () => Promise<NotebookTree>;
  get: (id: string) => Promise<NotebookSnapshot | null>;
  getWithMetadata: (id: string) => Promise<NotebookWithMetadata | null>;
  create: (input: { name: string; parentId?: string }) => Promise<NotebookSnapshot>;
  rename: (id: string, name: string) => Promise<NotebookSnapshot>;
  move: (id: string, newParentId: string | null) => Promise<NotebookSnapshot>;
  delete: (id: string) => Promise<{ success: boolean }>;
  reorder: (parentId: string | null, orderedIds: string[]) => Promise<{ success: boolean }>;
  enableGit: (notebookId: string) => Promise<{ success: boolean; error?: string }>;
  disableGit: (notebookId: string) => Promise<{ success: boolean; error?: string }>;
  isGitEnabled: (
    notebookId: string
  ) => Promise<{ success: boolean; enabled?: boolean; error?: string }>;
  getGitSettings: (notebookId: string) => Promise<{
    success: boolean;
    settings?: {
      enabled: boolean;
      autoCommit: boolean;
      initializedAt: string | null;
    };
    error?: string;
  }>;
  setGitAutoCommit: (
    notebookId: string,
    enabled: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  getGitEnabled: () => Promise<{
    success: boolean;
    notebooks?: NotebookSnapshot[];
    error?: string;
  }>;
}

export function createNotebooksApi(): NotebooksAPI {
  return {
    list: () => ipcRenderer.invoke('notebooks:list'),
    tree: () => ipcRenderer.invoke('notebooks:tree'),
    get: id => ipcRenderer.invoke('notebooks:get', id),
    getWithMetadata: id => ipcRenderer.invoke('notebooks:getWithMetadata', id),
    create: input => ipcRenderer.invoke('notebooks:create', input),
    rename: (id, name) => ipcRenderer.invoke('notebooks:rename', id, name),
    move: (id, newParentId) => ipcRenderer.invoke('notebooks:move', id, newParentId),
    delete: id => ipcRenderer.invoke('notebooks:delete', id),
    reorder: (parentId, orderedIds) =>
      ipcRenderer.invoke('notebooks:reorder', parentId, orderedIds),
    enableGit: notebookId => ipcRenderer.invoke('notebooks:enableGit', notebookId),
    disableGit: notebookId => ipcRenderer.invoke('notebooks:disableGit', notebookId),
    isGitEnabled: notebookId => ipcRenderer.invoke('notebooks:isGitEnabled', notebookId),
    getGitSettings: notebookId => ipcRenderer.invoke('notebooks:getGitSettings', notebookId),
    setGitAutoCommit: (notebookId, enabled) =>
      ipcRenderer.invoke('notebooks:setGitAutoCommit', notebookId, enabled),
    getGitEnabled: () => ipcRenderer.invoke('notebooks:getGitEnabled'),
  };
}
