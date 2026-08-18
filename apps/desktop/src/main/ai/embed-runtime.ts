import { getEmbeddingRegistry } from './setup.js';
import { DEFAULT_EMBED_MODEL, DEFAULT_EMBED_PROVIDER } from './indexer.js';

export type EmbedProviderId = 'ollama' | 'openai';

export interface EmbedRuntimeConfig {
  provider: EmbedProviderId;
  model: string;
  baseUrl: string;
}

let config: EmbedRuntimeConfig = {
  provider: DEFAULT_EMBED_PROVIDER,
  model: DEFAULT_EMBED_MODEL,
  baseUrl: '',
};

export function getEmbedConfig(): EmbedRuntimeConfig {
  return config;
}

export function getEmbedMeta(): { provider: EmbedProviderId; model: string; dim: number } {
  const provider = getEmbeddingRegistry().get(config.provider);
  return {
    provider: config.provider,
    model: config.model,
    dim: provider.dimensions(config.model),
  };
}

export function applyEmbedConfig(next: Partial<EmbedRuntimeConfig>): {
  changed: boolean;
  meta: ReturnType<typeof getEmbedMeta>;
} {
  const provider: EmbedProviderId =
    next.provider === 'openai' || next.provider === 'ollama' ? next.provider : config.provider;
  const model =
    typeof next.model === 'string' && next.model.trim() ? next.model.trim() : config.model;
  const baseUrl = typeof next.baseUrl === 'string' ? next.baseUrl : config.baseUrl;
  const changed =
    provider !== config.provider || model !== config.model || baseUrl !== config.baseUrl;
  config = { provider, model, baseUrl };
  return { changed, meta: getEmbedMeta() };
}

export async function embedTexts(
  texts: string[],
  getOpenAiKey: () => Promise<string | null | undefined>
): Promise<number[][]> {
  const provider = getEmbeddingRegistry().get(config.provider);
  const apiKey =
    config.provider === 'openai' ? ((await getOpenAiKey()) ?? undefined) : undefined;
  return provider.embed(texts, {
    apiKey,
    baseUrl: config.baseUrl || undefined,
    options: { model: config.model },
  });
}

export async function listEmbedCatalog(baseUrl?: string): Promise<
  Array<{
    id: string;
    displayName: string;
    models: Array<{ id: string; displayName: string; dimensions: number }>;
  }>
> {
  const registry = getEmbeddingRegistry();
  const out = [];
  for (const provider of registry.list()) {
    const models = await provider.listModels({
      baseUrl: baseUrl || config.baseUrl || undefined,
    });
    out.push({
      id: provider.id,
      displayName: provider.displayName,
      models: models.map(model => ({
        id: model.id,
        displayName: model.displayName,
        dimensions: model.dimensions,
      })),
    });
  }
  return out;
}
