// apps/desktop/src/main/ai/setup.ts
import { net } from 'electron';
import {
  ProviderRegistry,
  AnthropicProvider,
  OpenAIProvider,
  OllamaProvider,
  DripnexProvider,
  GrokProvider,
  AIServiceImpl,
  ToolRegistry,
  EmbeddingRegistry,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
} from '@dripnex/ai-core';
import type { AIService, FetchFn } from '@dripnex/ai-core';

let service: AIService | null = null;
let toolRegistryInstance: ToolRegistry | null = null;
let embeddingRegistryInstance: EmbeddingRegistry | null = null;

export function createAIService(): AIService {
  if (service) return service;

  const registry = new ProviderRegistry();
  const fetchFn = net.fetch as unknown as FetchFn;

  registry.register(new DripnexProvider(fetchFn));
  registry.register(new AnthropicProvider(fetchFn));
  registry.register(new OpenAIProvider(fetchFn));
  registry.register(new GrokProvider(fetchFn));
  registry.register(new OllamaProvider(fetchFn));

  service = new AIServiceImpl(registry);
  return service;
}

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ToolRegistry();
  }
  return toolRegistryInstance;
}

/** Local-first embeddings. Cloud OpenAI is opt-in via the stored OpenAI key. */
export function getEmbeddingRegistry(): EmbeddingRegistry {
  if (!embeddingRegistryInstance) {
    const fetchFn = net.fetch as unknown as FetchFn;
    embeddingRegistryInstance = new EmbeddingRegistry();
    embeddingRegistryInstance.register(new OllamaEmbeddingProvider(fetchFn));
    embeddingRegistryInstance.register(new OpenAIEmbeddingProvider(fetchFn));
  }
  return embeddingRegistryInstance;
}
