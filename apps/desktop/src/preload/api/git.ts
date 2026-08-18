import { ipcRenderer } from 'electron';

export interface GitAPI {
  init: (notebookId: string) => Promise<{ success: boolean; repoPath?: string; error?: string }>;
  isRepo: (notebookId: string) => Promise<{ success: boolean; isRepo?: boolean; error?: string }>;
  commit: (
    notebookId: string,
    message: string,
    files?: string[]
  ) => Promise<{ success: boolean; sha?: string; error?: string }>;
  log: (
    notebookId: string,
    limit?: number
  ) => Promise<{
    success: boolean;
    commits?: Array<{
      oid: string;
      message: string;
      author: { name: string; email: string; timestamp: number };
      committer: { name: string; email: string; timestamp: number };
    }>;
    error?: string;
  }>;
  status: (notebookId: string) => Promise<{
    success: boolean;
    status?: {
      modified: string[];
      added: string[];
      deleted: string[];
      untracked: string[];
    };
    error?: string;
  }>;
  checkout: (
    notebookId: string,
    commitSha: string
  ) => Promise<{ success: boolean; error?: string }>;
  writeNote: (
    notebookId: string,
    noteId: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>;
  readNote: (
    notebookId: string,
    noteId: string
  ) => Promise<{ success: boolean; content?: string | null; error?: string }>;
  deleteNote: (notebookId: string, noteId: string) => Promise<{ success: boolean; error?: string }>;
  remotes: (notebookId: string) => Promise<{
    success: boolean;
    remotes?: Array<{ remote: string; url: string }>;
    error?: string;
  }>;
  setRemote: (
    notebookId: string,
    url: string
  ) => Promise<{ success: boolean; remote?: string; error?: string }>;
  push: (notebookId: string) => Promise<{ success: boolean; error?: string }>;
}

export function createGitApi(): GitAPI {
  return {
    init: (notebookId: string) => ipcRenderer.invoke('git:init', notebookId),
    isRepo: (notebookId: string) => ipcRenderer.invoke('git:isRepo', notebookId),
    commit: (notebookId: string, message: string, files?: string[]) =>
      ipcRenderer.invoke('git:commit', notebookId, message, files),
    log: (notebookId: string, limit?: number) => ipcRenderer.invoke('git:log', notebookId, limit),
    status: (notebookId: string) => ipcRenderer.invoke('git:status', notebookId),
    checkout: (notebookId: string, commitSha: string) =>
      ipcRenderer.invoke('git:checkout', notebookId, commitSha),
    writeNote: (notebookId: string, noteId: string, content: string) =>
      ipcRenderer.invoke('git:writeNote', notebookId, noteId, content),
    readNote: (notebookId: string, noteId: string) =>
      ipcRenderer.invoke('git:readNote', notebookId, noteId),
    deleteNote: (notebookId: string, noteId: string) =>
      ipcRenderer.invoke('git:deleteNote', notebookId, noteId),
    remotes: notebookId => ipcRenderer.invoke('git:remotes', notebookId),
    setRemote: (notebookId, url) => ipcRenderer.invoke('git:setRemote', notebookId, url),
    push: notebookId => ipcRenderer.invoke('git:push', notebookId),
  };
}
