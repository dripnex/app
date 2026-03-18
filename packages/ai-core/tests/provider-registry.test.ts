// packages/ai-core/tests/provider-registry.test.ts
import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../src/provider-registry';
import type { LLMProvider, ProviderConfig, ModelInfo } from '../src/provider';
import type { LLMEvent, ChatOptions } from '../src/types';

function createMockProvider(id: string): LLMProvider {
  return {
    id,
    displayName: `Mock ${id}`,
    async *chat(_options: ChatOptions, _config: ProviderConfig): AsyncIterable<LLMEvent> {
      yield { type: 'text', delta: 'hello' };
    },
    async validate(_config: ProviderConfig) {
      return { ok: true as const };
    },
    async listModels(_config: ProviderConfig): Promise<ModelInfo[]> {
      return [
        {
          id: 'test-model',
          displayName: 'Test',
          contextWindow: 4096,
          maxOutputTokens: 1024,
          supportsStreaming: true,
          supportsTools: false,
        },
      ];
    },
  };
}

describe('ProviderRegistry', () => {
  it('registers and retrieves a provider', () => {
    const registry = new ProviderRegistry();
    const provider = createMockProvider('test');
    registry.register(provider);
    expect(registry.get('test')).toBe(provider);
  });

  it('throws on unknown provider', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.get('unknown')).toThrow('Unknown provider: unknown');
  });

  it('lists all registered providers', () => {
    const registry = new ProviderRegistry();
    registry.register(createMockProvider('a'));
    registry.register(createMockProvider('b'));
    expect(registry.list().map(p => p.id)).toEqual(['a', 'b']);
  });
});
