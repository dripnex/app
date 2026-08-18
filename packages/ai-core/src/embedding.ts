import type { FetchFn, ProviderConfig } from './provider.js';

export type { FetchFn, ProviderConfig };

export interface EmbeddingModelInfo {
  id: string;
  displayName: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly displayName: string;
  embed(texts: string[], config: ProviderConfig): Promise<number[][]>;
  dimensions(model: string): number;
  validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }>;
  listModels(config: ProviderConfig): Promise<EmbeddingModelInfo[]>;
}

export class EmbeddingRegistry {
  private providers = new Map<string, EmbeddingProvider>();

  register(provider: EmbeddingProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): EmbeddingProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown embedding provider: ${id}`);
    return provider;
  }

  list(): EmbeddingProvider[] {
    return [...this.providers.values()];
  }
}

export function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end--;
  return url.slice(0, end);
}
