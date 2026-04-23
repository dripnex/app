/**
 * AI Key Storage IPC Handlers
 *
 * Handles saving, retrieving, and managing AI provider API keys.
 */

import { ipcMain } from 'electron';
import type { AiKeyStorage } from './types.js';

export interface AiKeyHandlerDeps {
  aiKeyStorage: AiKeyStorage;
}

export function registerAiKeyHandlers(deps: AiKeyHandlerDeps): void {
  const { aiKeyStorage } = deps;

  ipcMain.handle('ai:saveKey', async (_event, provider: string, apiKey: string) => {
    await aiKeyStorage.saveKey(provider, apiKey);
  });

  ipcMain.handle('ai:getKey', async (_event, provider: string) => {
    return aiKeyStorage.getKey(provider);
  });

  ipcMain.handle('ai:removeKey', async (_event, provider: string) => {
    await aiKeyStorage.removeKey(provider);
  });

  ipcMain.handle('ai:hasKey', async (_event, provider: string) => {
    return aiKeyStorage.hasKey(provider);
  });

  ipcMain.handle('ai:listConnectedProviders', async () => {
    return aiKeyStorage.listProviders();
  });
}
