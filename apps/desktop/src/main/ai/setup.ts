// apps/desktop/src/main/ai/setup.ts
import { net } from 'electron';
import { ProviderRegistry, AnthropicProvider, AIServiceImpl, ToolRegistry } from '@readied/ai-core';
import type { AIService, FetchFn } from '@readied/ai-core';

let service: AIService | null = null;
let toolRegistryInstance: ToolRegistry | null = null;

export function createAIService(): AIService {
  if (service) return service;

  const registry = new ProviderRegistry();
  registry.register(new AnthropicProvider(net.fetch as unknown as FetchFn));

  service = new AIServiceImpl(registry);
  return service;
}

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ToolRegistry();
  }
  return toolRegistryInstance;
}
