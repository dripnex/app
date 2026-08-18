import type { FetchFn, ProviderConfig } from '../provider.js';
import type { EmbeddingModelInfo, EmbeddingProvider } from '../embedding.js';

const API_URL = 'https://api.openai.com/v1/embeddings';

const KNOWN: Record<string, EmbeddingModelInfo> = {
  'text-embedding-3-small': {
    id: 'text-embedding-3-small',
    displayName: 'Embedding 3 Small',
    dimensions: 1536,
  },
  'text-embedding-3-large': {
    id: 'text-embedding-3-large',
    displayName: 'Embedding 3 Large',
    dimensions: 3072,
  },
  'text-embedding-ada-002': {
    id: 'text-embedding-ada-002',
    displayName: 'Ada 002',
    dimensions: 1536,
  },
};

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI';

  constructor(private fetchFn: FetchFn) {}

  dimensions(model: string): number {
    return KNOWN[model]?.dimensions ?? KNOWN['text-embedding-3-small']!.dimensions;
  }

  async listModels(_config: ProviderConfig): Promise<EmbeddingModelInfo[]> {
    return Object.values(KNOWN);
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.apiKey?.trim()) {
      return { ok: false, error: 'OpenAI API key is required' };
    }
    try {
      const response = await this.fetchFn('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: '',
      });
      if (response.status === 401) return { ok: false, error: 'Invalid OpenAI API key' };
      if (!response.ok) return { ok: false, error: `OpenAI returned ${response.status}` };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Cannot reach OpenAI' };
    }
  }

  async embed(texts: string[], config: ProviderConfig): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!config.apiKey?.trim()) {
      throw new Error('OpenAI API key is required');
    }
    const model =
      typeof config.options?.model === 'string' && config.options.model
        ? config.options.model
        : 'text-embedding-3-small';

    const response = await this.fetchFn(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI embed failed (${response.status})`);
    }
    const body = JSON.parse(await response.text()) as {
      data?: Array<{ embedding: number[]; index: number }>;
    };
    const rows = [...(body.data ?? [])].sort((a, b) => a.index - b.index);
    if (rows.length !== texts.length) {
      throw new Error('OpenAI embed returned an unexpected payload');
    }
    return rows.map(row => row.embedding);
  }
}
