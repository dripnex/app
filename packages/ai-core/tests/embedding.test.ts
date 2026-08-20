import { describe, expect, it, vi } from 'vitest';
import { EmbeddingRegistry } from '../src/embedding';
import { OllamaEmbeddingProvider } from '../src/providers/ollama-embedding';
import { OpenAIEmbeddingProvider } from '../src/providers/openai-embedding';
import type { FetchFn } from '../src/provider';

function jsonFetch(payload: unknown, status = 200): FetchFn {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
    body: null,
  }));
}

describe('EmbeddingRegistry', () => {
  it('registers and looks up providers', () => {
    const registry = new EmbeddingRegistry();
    const ollama = new OllamaEmbeddingProvider(jsonFetch({}));
    registry.register(ollama);
    expect(registry.get('ollama')).toBe(ollama);
    expect(() => registry.get('missing')).toThrow('Unknown embedding provider');
  });
});

describe('OllamaEmbeddingProvider', () => {
  it('embeds a batch via /api/embed', async () => {
    const fetchFn = jsonFetch({
      embeddings: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    });
    const provider = new OllamaEmbeddingProvider(fetchFn);
    const vectors = await provider.embed(['a', 'b'], {});
    expect(vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(provider.dimensions('nomic-embed-text')).toBe(768);
  });

  it('validate fails when Ollama is down', async () => {
    const fetchFn: FetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const provider = new OllamaEmbeddingProvider(fetchFn);
    const result = await provider.validate({});
    expect(result.ok).toBe(false);
  });
});

describe('OpenAIEmbeddingProvider', () => {
  it('orders embeddings by index', async () => {
    const fetchFn = jsonFetch({
      data: [
        { index: 1, embedding: [2] },
        { index: 0, embedding: [1] },
      ],
    });
    const provider = new OpenAIEmbeddingProvider(fetchFn);
    const vectors = await provider.embed(['a', 'b'], { apiKey: 'sk-test' });
    expect(vectors).toEqual([[1], [2]]);
  });

  it('validate requires a key', async () => {
    const provider = new OpenAIEmbeddingProvider(jsonFetch({}));
    expect(await provider.validate({})).toMatchObject({ ok: false });
  });
});
