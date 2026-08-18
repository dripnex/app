import { ipcRenderer } from 'electron';

export interface OnePasswordSaveInput {
  account?: string | null;
  email?: string | null;
  passphrase: string;
  recoveryKey?: string | null;
}

export interface OnePasswordSecretInput {
  account?: string | null;
  title: string;
  username: string;
  password: string;
  notes?: string;
  websiteUrl: string;
  websiteLabel: string;
}

export type OnePasswordSaveResult =
  | { success: true; vaultTitle: string; itemTitle: string }
  | { success: false; needsAccount: true; accounts: string[] }
  | { success: false; needsAccount?: false; error: string };

export interface OnePasswordAPI {
  discover: () => Promise<{ success: boolean; stored: string | null; accounts: string[] }>;
  setAccount: (account: string) => Promise<{ success: boolean; account: string }>;
  save: (input: OnePasswordSaveInput) => Promise<OnePasswordSaveResult>;
  saveSecret: (input: OnePasswordSecretInput) => Promise<OnePasswordSaveResult>;
}

export interface GitHubStatus {
  connected: boolean;
  login: string | null;
  via: 'token' | null;
}

export interface GitHubWatcher {
  id: string;
  spec: string;
  kind: 'issue' | 'repo' | 'search';
  label: string;
  notebookId: string;
  lastPulledAt: string | null;
  lastError: string | null;
}

export interface GitHubPullResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface GitHubAPI {
  status: () => Promise<GitHubStatus>;
  connect: (token?: string | null) => Promise<{ success: true; login: string } | { success: false; error: string }>;
  disconnect: () => Promise<{ success: true }>;
  importIssue: (
    url: string
  ) => Promise<
    { success: true; title: string; content: string; htmlUrl: string } | { success: false; error: string }
  >;
  listWatchers: () => Promise<GitHubWatcher[]>;
  addWatcher: (
    spec: string
  ) => Promise<{ success: true; watcher: GitHubWatcher } | { success: false; error: string }>;
  removeWatcher: (id: string) => Promise<{ success: true }>;
  pullWatchers: (
    watcherId?: string
  ) => Promise<({ success: true } & GitHubPullResult) | { success: false; error: string }>;
}

/** Optional third-party bridges. Never put these on the DripnexAPI root. */
export interface IntegrationsAPI {
  onePassword: OnePasswordAPI;
  github: GitHubAPI;
}

export function createIntegrationsApi(): IntegrationsAPI {
  return {
    onePassword: {
      discover: () => ipcRenderer.invoke('integrations:onepassword:discover'),
      setAccount: account => ipcRenderer.invoke('integrations:onepassword:setAccount', account),
      save: input => ipcRenderer.invoke('integrations:onepassword:save', input),
      saveSecret: input => ipcRenderer.invoke('integrations:onepassword:saveSecret', input),
    },
    github: {
      status: () => ipcRenderer.invoke('integrations:github:status'),
      connect: token => ipcRenderer.invoke('integrations:github:connect', token ?? null),
      disconnect: () => ipcRenderer.invoke('integrations:github:disconnect'),
      importIssue: url => ipcRenderer.invoke('integrations:github:importIssue', url),
      listWatchers: () => ipcRenderer.invoke('integrations:github:listWatchers'),
      addWatcher: spec => ipcRenderer.invoke('integrations:github:addWatcher', spec),
      removeWatcher: id => ipcRenderer.invoke('integrations:github:removeWatcher', id),
      pullWatchers: watcherId =>
        ipcRenderer.invoke('integrations:github:pullWatchers', watcherId ?? null),
    },
  };
}
