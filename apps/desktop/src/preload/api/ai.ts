import { ipcRenderer } from 'electron';

export interface AiAPI {
  chat: (request: {
    query: string;
    currentNote?: { id: string; title: string; content: string } | null;
    relevantNotes: Array<{ id: string; title: string; content: string }>;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    mode: 'chat' | 'ask-notes';
    provider: string;
    model: string;
    providerConfig: { apiKey?: string; baseUrl?: string };
    maxResponseTokens?: number;
    tools?: boolean;
  }) => Promise<{ requestId: string }>;
  onEvent: (cb: (requestId: string, event: unknown) => void) => () => void;
  cancel: (requestId: string) => Promise<void>;
  validate: (config: {
    provider: string;
    apiKey?: string;
    baseUrl?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  exportPreset: (
    presetJson: string
  ) => Promise<{ ok: true; filePath: string } | { ok: false; error: string }>;
  importPreset: () => Promise<{ ok: true; content: string } | { ok: false; error: string }>;
  confirmTool: (requestId: string, callId: string, approved: boolean) => Promise<void>;
  onToolExecuteRequest: (
    cb: (requestId: string, callId: string, toolName: string, args: unknown) => void
  ) => () => void;
  sendToolResult: (
    requestId: string,
    callId: string,
    result: { ok: boolean; content: string; error?: string }
  ) => Promise<void>;
  saveKey: (provider: string, apiKey: string) => Promise<void>;
  getKey: (provider: string) => Promise<string | null>;
  removeKey: (provider: string) => Promise<void>;
  hasKey: (provider: string) => Promise<boolean>;
  listConnectedProviders: () => Promise<string[]>;
  firstPartyStatus: () => Promise<{ available: boolean }>;
  kbStatus: () => Promise<{
    pending: number;
    embedded: number;
    model: string;
    provider: string;
    dim: number;
  }>;
  kbReindex: () => Promise<void>;
  kbSetEmbed: (input: {
    provider: 'ollama' | 'openai';
    model: string;
    baseUrl?: string;
  }) => Promise<{ provider: string; model: string; dim: number }>;
  kbCatalog: () => Promise<
    Array<{
      id: string;
      displayName: string;
      models: Array<{ id: string; displayName: string; dimensions: number }>;
    }>
  >;
  inferredGraph: () => Promise<Array<{ source: string; target: string; score: number }>>;
  retrieve: (input: {
    query: string;
    relatedQuery?: string | null;
    topK: number;
    excludeIds?: string[];
  }) => Promise<
    Array<{ id: string; title: string; content: string; heading?: string | null; score?: number }>
  >;
  listModels: (config: {
    provider: string;
    apiKey?: string;
    baseUrl?: string;
  }) => Promise<
    | { ok: true; models: Array<{ id: string; displayName?: string }> }
    | { ok: false; error: string }
  >;
}

export function createAiApi(): AiAPI {
  return {
    chat: request => ipcRenderer.invoke('ai:chat', request),
    onEvent: cb => {
      const handler = (_event: unknown, requestId: string, aiEvent: unknown) =>
        cb(requestId, aiEvent);
      ipcRenderer.on('ai:event', handler);
      return () => {
        ipcRenderer.removeListener('ai:event', handler);
      };
    },
    cancel: requestId => ipcRenderer.invoke('ai:cancel', requestId),
    validate: config => ipcRenderer.invoke('ai:validate', config),
    exportPreset: presetJson => ipcRenderer.invoke('ai:exportPreset', presetJson),
    importPreset: () => ipcRenderer.invoke('ai:importPreset'),
    confirmTool: (requestId: string, callId: string, approved: boolean) =>
      ipcRenderer.invoke('ai:tool-confirm', requestId, callId, approved),
    onToolExecuteRequest: (
      cb: (requestId: string, callId: string, toolName: string, args: unknown) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        requestId: string,
        callId: string,
        toolName: string,
        args: unknown
      ) => cb(requestId, callId, toolName, args);
      ipcRenderer.on('ai:tool-execute-in-renderer', handler);
      return () => {
        ipcRenderer.removeListener('ai:tool-execute-in-renderer', handler);
      };
    },
    sendToolResult: (
      requestId: string,
      callId: string,
      result: { ok: boolean; content: string; error?: string }
    ) => ipcRenderer.invoke('ai:tool-renderer-result', requestId, callId, result),
    saveKey: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('ai:saveKey', provider, apiKey),
    getKey: (provider: string) => ipcRenderer.invoke('ai:getKey', provider),
    removeKey: (provider: string) => ipcRenderer.invoke('ai:removeKey', provider),
    hasKey: (provider: string) => ipcRenderer.invoke('ai:hasKey', provider),
    listConnectedProviders: () => ipcRenderer.invoke('ai:listConnectedProviders'),
    firstPartyStatus: () => ipcRenderer.invoke('ai:firstPartyStatus'),
    kbStatus: () => ipcRenderer.invoke('kb:status'),
    kbReindex: () => ipcRenderer.invoke('kb:reindex'),
    kbSetEmbed: input => ipcRenderer.invoke('kb:setEmbed', input),
    kbCatalog: () => ipcRenderer.invoke('kb:catalog'),
    inferredGraph: () => ipcRenderer.invoke('kb:inferredGraph'),
    retrieve: input => ipcRenderer.invoke('ai:retrieve', input),
    listModels: config => ipcRenderer.invoke('ai:listModels', config),
  };
}
