import type { LLMProvider, ProviderConfig, ModelInfo, FetchFn } from '../provider.js';
import type { LLMEvent, ChatOptions } from '../types.js';
import { AnthropicProvider } from './anthropic.js';

/**
 * First-party Dripnex AI is hosted Claude (Anthropic), not a separate model
 * family. The product owns the key (`DRIPNEX_AI_KEY` in the host). Users never
 * paste one. Dev / unsigned builds usually have no key — that is expected.
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
        error:
          'Dripnex AI is hosted Claude and is not configured on this install. Pick Anthropic, OpenAI, Grok, or Ollama.',
        retryable: false,
      };
      return;
    }
    yield* this.inner.chat(options, config);
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.apiKey) {
      return {
        ok: false,
        error:
          'Dripnex AI is hosted Claude and is not configured on this install. Pick Anthropic, OpenAI, Grok, or Ollama.',
      };
    }
    return this.inner.validate(config);
  }

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    return this.inner.listModels(config);
  }
}
