// apps/desktop/src/main/ai/setup.ts
import { net } from 'electron';
import {
  ProviderRegistry,
  AnthropicProvider,
  OpenAIProvider,
  OllamaProvider,
  AIServiceImpl,
  ToolRegistry,
} from '@readied/ai-core';
import type { AIService, FetchFn } from '@readied/ai-core';

let service: AIService | null = null;
let toolRegistryInstance: ToolRegistry | null = null;

export function createAIService(): AIService {
  if (service) return service;

  const registry = new ProviderRegistry();
  const fetchFn = net.fetch as unknown as FetchFn;

  registry.register(new AnthropicProvider(fetchFn));
  registry.register(new OpenAIProvider(fetchFn));
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
