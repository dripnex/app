import type { LLMProvider, ProviderConfig, ModelInfo, FetchFn } from '../provider.js';
import type { LLMEvent, ChatOptions } from '../types.js';
import { AnthropicProvider } from './anthropic.js';

/**
 * First-party Dripnex AI. Same models as Claude, key owned by the product
 * (passed in by the host — never collected from the user).
 */
export class DripnexProvider implements LLMProvider {
  readonly id = 'dripnex';
  readonly displayName = 'Dripnex AI';
  private readonly inner: AnthropicProvider;

  constructor(fetchFn: FetchFn) {
    this.inner = new AnthropicProvider(fetchFn);
  }

  async *chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent> {
    if (!config.apiKey) {
      yield {
        type: 'error',
        code: 'auth_failed',
        error: 'Dripnex AI is not configured on this install.',
        retryable: false,
      };
      return;
    }
    yield* this.inner.chat(options, config);
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.apiKey) {
      return { ok: false, error: 'Dripnex AI is not configured on this install.' };
    }
    return this.inner.validate(config);
  }

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    return this.inner.listModels(config);
  }
}
