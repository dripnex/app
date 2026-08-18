import type { LLMProvider, ProviderConfig, ModelInfo, FetchFn } from '../provider.js';
import type { LLMEvent, ChatOptions } from '../types.js';
import { OpenAIProvider } from './openai.js';

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';

const GROK_MODELS: ModelInfo[] = [
  {
    id: 'grok-4',
    displayName: 'Grok 4',
    contextWindow: 256_000,
    maxOutputTokens: 64_000,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'grok-3',
    displayName: 'Grok 3',
    contextWindow: 131_072,
    maxOutputTokens: 16_384,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'grok-3-mini',
    displayName: 'Grok 3 Mini',
    contextWindow: 131_072,
    maxOutputTokens: 16_384,
    supportsStreaming: true,
    supportsTools: true,
  },
];

/**
 * xAI Grok. OpenAI-compatible chat completions at api.x.ai.
 */
export class GrokProvider implements LLMProvider {
  readonly id = 'grok';
  readonly displayName = 'Grok';
  private readonly inner: OpenAIProvider;

  constructor(fetchFn: FetchFn) {
    this.inner = new OpenAIProvider(fetchFn);
  }

  private withXai(config: ProviderConfig): ProviderConfig {
    return { ...config, baseUrl: config.baseUrl ?? XAI_CHAT_URL };
  }

  async *chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent> {
    yield* this.inner.chat(options, this.withXai(config));
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    return this.inner.validate(this.withXai(config));
  }

  async listModels(_config: ProviderConfig): Promise<ModelInfo[]> {
    return GROK_MODELS;
  }
}
