/**
 * AI Key Storage IPC Handlers
 *
 * Handles saving, retrieving, and managing AI provider API keys.
 *
 * Inputs are validated at the IPC boundary via Zod. Renderer-supplied
 * provider names and keys are bounded in length and shape — a malformed
 * payload throws an IpcValidationError before ever reaching aiKeyStorage.
 */

import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import type { AiKeyStorage } from './types.js';

export interface AiKeyHandlerDeps {
  aiKeyStorage: AiKeyStorage;
}

// A provider name is short, kebab-case-ish, and ASCII. Cap at 64 to defend
// against accidental large inputs.
const ProviderSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Provider name must be alphanumeric (with _ or -)');

// Keys can be long (sk-... up to a few hundred chars on some providers);
// 4096 is well above anything real and well below "this is junk".
const ApiKeySchema = z.string().min(1).max(4096);

export function registerAiKeyHandlers(deps: AiKeyHandlerDeps): void {
  const { aiKeyStorage } = deps;

  defineIpcHandler({
    channel: 'ai:saveKey',
    args: z.tuple([ProviderSchema, ApiKeySchema]),
    handler: (provider, apiKey) => aiKeyStorage.saveKey(provider, apiKey),
  });

  defineIpcHandler({
    channel: 'ai:getKey',
    args: z.tuple([ProviderSchema]),
    handler: provider => aiKeyStorage.getKey(provider),
  });

  defineIpcHandler({
    channel: 'ai:removeKey',
    args: z.tuple([ProviderSchema]),
    handler: provider => aiKeyStorage.removeKey(provider),
  });

  defineIpcHandler({
    channel: 'ai:hasKey',
    args: z.tuple([ProviderSchema]),
    handler: provider => aiKeyStorage.hasKey(provider),
  });

  defineIpcHandler({
    channel: 'ai:listConnectedProviders',
    args: z.tuple([]),
    handler: () => aiKeyStorage.listProviders(),
  });
}
