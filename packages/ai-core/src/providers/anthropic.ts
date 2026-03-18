// packages/ai-core/src/providers/anthropic.ts
import type { LLMProvider, ProviderConfig, ModelInfo, FetchFn } from '../provider.js';
import type { LLMEvent, ChatOptions, MessageContent } from '../types.js';
import { parseSSEStream } from './sse-parser.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const STATIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
  },
];

function classifyHttpStatus(status: number): {
  code: Extract<LLMEvent, { type: 'error' }>['code'];
  retryable: boolean;
} {
  if (status === 429 || status === 529) return { code: 'rate_limit', retryable: true };
  if (status === 401) return { code: 'auth_failed', retryable: false };
  if (status === 404) return { code: 'model_not_found', retryable: false };
  if (status === 400) return { code: 'invalid_request', retryable: false };
  if (status >= 500) return { code: 'provider_error', retryable: true };
  return { code: 'provider_error', retryable: false };
}

function normalizeContent(content: MessageContent): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') return content;
  return content.map(part => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };
      case 'tool_use':
        return { type: 'tool_use', id: part.id, name: part.name, input: part.input };
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_use_id: part.tool_use_id,
          content: part.content,
          ...(part.is_error ? { is_error: true } : {}),
        };
      case 'image':
        return { type: 'text', text: '[image]' };
      default:
        return { type: 'text', text: '' };
    }
  });
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly displayName = 'Anthropic Claude';

  constructor(private fetchFn: FetchFn) {}

  async *chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent> {
    const { model, system, messages, maxTokens, signal, tools } = options;
    const baseUrl = config.baseUrl ?? API_URL;

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      system,
      stream: true,
      messages: messages.map(m => ({
        role: m.role,
        content: normalizeContent(m.content),
      })),
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await this.fetchFn(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey ?? '',
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      yield {
        type: 'error',
        code: isAbort ? 'cancelled' : 'network',
        error: err instanceof Error ? err.message : String(err),
        retryable: !isAbort,
      };
      return;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      const { code, retryable } = classifyHttpStatus(response.status);
      yield {
        type: 'error',
        code,
        error: `API error ${response.status}: ${errorBody}`,
        retryable,
        metadata: {
          retryAfter: response.headers.get('retry-after'),
        },
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', code: 'provider_error', error: 'No response body', retryable: false };
      return;
    }

    // Track input tokens from message_start for the usage event
    let inputTokens = 0;

    // Tool use accumulation state
    const toolBlocks = new Map<number, { id: string; name: string; jsonBuf: string }>();

    for await (const sseEvent of parseSSEStream(response.body)) {
      const data = sseEvent.data as Record<string, unknown>;

      switch (data.type) {
        case 'message_start': {
          const message = data.message as Record<string, unknown>;
          const usage = message.usage as { input_tokens: number } | undefined;
          if (usage) inputTokens = usage.input_tokens;
          break;
        }

        case 'content_block_start': {
          const block = data.content_block as Record<string, unknown>;
          const index = data.index as number;
          if (block.type === 'tool_use') {
            toolBlocks.set(index, {
              id: block.id as string,
              name: block.name as string,
              jsonBuf: '',
            });
          }
          break;
        }

        case 'content_block_delta': {
          const delta = data.delta as Record<string, unknown>;
          const index = data.index as number;
          if (delta.type === 'text_delta') {
            yield { type: 'text', delta: delta.text as string };
          } else if (delta.type === 'input_json_delta') {
            const block = toolBlocks.get(index);
            if (block) {
              block.jsonBuf += delta.partial_json as string;
            }
          }
          break;
        }

        case 'content_block_stop': {
          const index = data.index as number;
          const block = toolBlocks.get(index);
          if (block) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(block.jsonBuf || '{}');
            } catch {
              // Malformed JSON — use empty args
            }
            yield { type: 'tool_call', id: block.id, name: block.name, args };
            toolBlocks.delete(index);
          }
          break;
        }

        case 'message_delta': {
          const delta = data.delta as Record<string, unknown>;
          const usage = data.usage as { output_tokens: number } | undefined;
          if (usage) {
            yield { type: 'usage', inputTokens, outputTokens: usage.output_tokens };
          }
          if (delta.stop_reason) {
            yield {
              type: 'stop',
              reason: delta.stop_reason as 'end_turn' | 'tool_use' | 'max_tokens',
            };
          }
          break;
        }

        case 'message_stop':
          // Provider does NOT emit 'done' — AIService handles that
          break;

        case 'error': {
          yield {
            type: 'error',
            code: 'provider_error',
            error: (data.error as Record<string, string>)?.message ?? 'Unknown streaming error',
            retryable: true,
          };
          break;
        }
      }
    }
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.apiKey) {
      return { ok: false, error: 'API key is required' };
    }
    return { ok: true };
  }

  async listModels(_config: ProviderConfig): Promise<ModelInfo[]> {
    return STATIC_MODELS;
  }
}
