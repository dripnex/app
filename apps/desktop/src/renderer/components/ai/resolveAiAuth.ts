import { DEFAULT_MODEL } from '@dripnex/ai-core';

interface AiSettingsSlice {
  provider: string;
  apiKey?: string;
  model: string;
  maxContextNotes: number;
  baseUrl?: string;
}

export interface ResolvedAiAuth {
  apiKey: string;
  missingKey: boolean;
  model: string;
  provider: string;
  maxContextNotes: number;
  baseUrl: string | undefined;
}

export function resolveAiAuth(
  ai: AiSettingsSlice,
  getConfig: <T>(key: string) => T | undefined
): ResolvedAiAuth {
  const firstParty = ai.provider === 'dripnex' || ai.provider === 'ollama';
  const hasSettingsKey = Boolean(ai.apiKey);
  const apiKey = firstParty
    ? (ai.apiKey ?? '')
    : hasSettingsKey
      ? (ai.apiKey ?? '')
      : (getConfig<string>('apiKey') ?? '');

  return {
    apiKey,
    missingKey: !firstParty && !apiKey,
    model: hasSettingsKey ? ai.model : getConfig<string>('model') || DEFAULT_MODEL,
    provider: ai.provider,
    maxContextNotes: hasSettingsKey
      ? ai.maxContextNotes
      : getConfig<number>('maxContextNotes') || 5,
    baseUrl: ai.baseUrl || undefined,
  };
}
