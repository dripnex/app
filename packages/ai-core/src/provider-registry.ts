// packages/ai-core/src/provider-registry.ts
import type { LLMProvider } from './provider.js';

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): LLMProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  list(): LLMProvider[] {
    return [...this.providers.values()];
  }
}
