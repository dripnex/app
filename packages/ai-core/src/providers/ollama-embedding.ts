import type { FetchFn, ProviderConfig } from '../provider.js';
import type { EmbeddingModelInfo, EmbeddingProvider } from '../embedding.js';
import { stripTrailingSlashes } from '../embedding.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'nomic-embed-text';

const KNOWN: Record<string, EmbeddingModelInfo> = {
  'nomic-embed-text': { id: 'nomic-embed-text', displayName: 'Nomic Embed', dimensions: 768 },
  'mxbai-embed-large': { id: 'mxbai-embed-large', displayName: 'mxbai Embed Large', dimensions: 1024 },
  'all-minilm': { id: 'all-minilm', displayName: 'all-MiniLM', dimensions: 384 },
};

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'ollama';
  readonly displayName = 'Ollama (Local)';

  constructor(private fetchFn: FetchFn) {}

  dimensions(model: string): number {
    return KNOWN[model]?.dimensions ?? KNOWN[DEFAULT_MODEL]!.dimensions;
  }

  async listModels(config: ProviderConfig): Promise<EmbeddingModelInfo[]> {
    const baseUrl = stripTrailingSlashes(config.baseUrl ?? DEFAULT_BASE_URL);
    try {
      const response = await this.fetchFn(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: {},
        body: '',
      });
      if (!response.ok) return Object.values(KNOWN);
      const body = JSON.parse(await response.text()) as {
        models?: Array<{ name?: string }>;
      };
      const names = (body.models ?? [])
        .map(model => model.name?.split(':')[0] ?? '')
        .filter(name => name in KNOWN);
      const unique = [...new Set(names)];
      if (unique.length === 0) return Object.values(KNOWN);
      return unique.map(name => KNOWN[name]!);
    } catch {
      return Object.values(KNOWN);
    }
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    const baseUrl = stripTrailingSlashes(config.baseUrl ?? DEFAULT_BASE_URL);
    try {
      const response = await this.fetchFn(`${baseUrl}/api/version`, {
        method: 'GET',
        headers: {},
        body: '',
      });
      if (!response.ok) {
        return { ok: false, error: `Ollama returned ${response.status}` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Cannot reach Ollama. Is it running on this machine?' };
    }
  }

  async embed(texts: string[], config: ProviderConfig): Promise<number[][]> {
    if (texts.length === 0) return [];
    const baseUrl = stripTrailingSlashes(config.baseUrl ?? DEFAULT_BASE_URL);
    const model =
      typeof config.options?.model === 'string' && config.options.model
        ? config.options.model
        : DEFAULT_MODEL;

    const response = await this.fetchFn(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embed failed (${response.status})`);
    }
    const body = JSON.parse(await response.text()) as { embeddings?: number[][] };
    if (!Array.isArray(body.embeddings) || body.embeddings.length !== texts.length) {
      throw new Error('Ollama embed returned an unexpected payload');
    }
    return body.embeddings;
  }
}
