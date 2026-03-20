// packages/ai-core/src/providers/openai.ts
import type { LLMProvider, ProviderConfig, ModelInfo, FetchFn } from '../provider.js';
import type { LLMEvent, ChatOptions, ContentPart } from '../types.js';
import { parseSSEStream } from './sse-parser.js';

const API_URL = 'https://api.openai.com/v1/chat/completions';

const STATIC_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'o1',
    displayName: 'o1',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'o1-mini',
    displayName: 'o1 Mini',
    contextWindow: 128_000,
    maxOutputTokens: 65_536,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    supportsStreaming: true,
    supportsTools: true,
  },
];

function classifyHttpStatus(status: number): {
  code: Extract<LLMEvent, { type: 'error' }>['code'];
  retryable: boolean;
} {
  if (status === 429) return { code: 'rate_limit', retryable: true };
  if (status === 401) return { code: 'auth_failed', retryable: false };
  if (status === 404) return { code: 'model_not_found', retryable: false };
  if (status === 400) return { code: 'invalid_request', retryable: false };
  if (status === 413) return { code: 'context_overflow', retryable: false };
  if (status >= 500) return { code: 'provider_error', retryable: true };
  return { code: 'provider_error', retryable: false };
}

/**
 * Convert our generic messages to OpenAI chat format.
 * OpenAI uses a different structure for tool calls and tool results:
 * - tool_use content parts become assistant messages with tool_calls
 * - tool_result content parts become messages with role: "tool"
 */
function convertMessages(
  messages: ChatOptions['messages'],
  system: string
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  // OpenAI uses a system message in the messages array
  if (system) {
    result.push({ role: 'system', content: system });
  }

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    // Process content parts — split tool_result into separate tool messages,
    // and convert tool_use into OpenAI's tool_calls format
    const textParts: string[] = [];
    const toolCalls: Array<Record<string, unknown>> = [];
    const toolResults: Array<{ tool_call_id: string; content: string }> = [];

    for (const part of msg.content as ContentPart[]) {
      switch (part.type) {
        case 'text':
          textParts.push(part.text);
          break;
        case 'tool_use':
          toolCalls.push({
            id: part.id,
            type: 'function',
            function: {
              name: part.name,
              arguments: JSON.stringify(part.input),
            },
          });
          break;
        case 'tool_result':
          toolResults.push({
            tool_call_id: part.tool_use_id,
            content: part.content,
          });
          break;
        case 'image':
          textParts.push('[image]');
          break;
      }
    }

    // Emit assistant message with tool_calls if present
    if (toolCalls.length > 0) {
      const assistantMsg: Record<string, unknown> = {
        role: 'assistant',
        tool_calls: toolCalls,
      };
      if (textParts.length > 0) {
        assistantMsg.content = textParts.join('');
      }
      result.push(assistantMsg);
    } else if (textParts.length > 0) {
      result.push({ role: msg.role, content: textParts.join('') });
    }

    // Emit tool result messages
    for (const tr of toolResults) {
      result.push({
        role: 'tool',
        tool_call_id: tr.tool_call_id,
        content: tr.content,
      });
    }
  }

  return result;
}

function convertTools(tools: ChatOptions['tools']): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI';

  constructor(private fetchFn: FetchFn) {}

  async *chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent> {
    const { model, system, messages, maxTokens, signal, tools } = options;
    const baseUrl = config.baseUrl ?? API_URL;

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      messages: convertMessages(messages, system),
    };

    const convertedTools = convertTools(tools);
    if (convertedTools) {
      body.tools = convertedTools;
    }

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await this.fetchFn(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey ?? ''}`,
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

    // Tool call accumulation state: index -> { id, name, argsBuf }
    const toolCalls = new Map<number, { id: string; name: string; argsBuf: string }>();

    for await (const sseEvent of parseSSEStream(response.body)) {
      // OpenAI sends `data: [DONE]` as the final event, which won't parse as JSON
      // and will be skipped by the SSE parser. Handle any that slip through.
      if (sseEvent.data === '[DONE]') break;

      const data = sseEvent.data as Record<string, unknown>;

      // Handle error events
      if (data.error) {
        const err = data.error as Record<string, string>;
        yield {
          type: 'error',
          code: 'provider_error',
          error: err.message ?? 'Unknown streaming error',
          retryable: true,
        };
        continue;
      }

      // Process usage info (sent in the final chunk when stream_options.include_usage is true)
      const usage = data.usage as { prompt_tokens: number; completion_tokens: number } | undefined;
      if (usage) {
        yield {
          type: 'usage',
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
        };
      }

      // Process choices
      const choices = data.choices as
        | Array<{
            index: number;
            delta: Record<string, unknown>;
            finish_reason: string | null;
          }>
        | undefined;

      if (!choices || choices.length === 0) continue;

      const choice = choices[0]!;
      const delta = choice.delta;

      if (!delta) continue;

      // Text content
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        yield { type: 'text', delta: delta.content };
      }

      // Tool calls (streamed incrementally)
      const deltaToolCalls = delta.tool_calls as
        | Array<{
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>
        | undefined;

      if (deltaToolCalls) {
        for (const tc of deltaToolCalls) {
          const idx = tc.index;
          if (!toolCalls.has(idx)) {
            toolCalls.set(idx, {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              argsBuf: '',
            });
          }
          const block = toolCalls.get(idx)!;
          if (tc.id) block.id = tc.id;
          if (tc.function?.name) block.name = tc.function.name;
          if (tc.function?.arguments) block.argsBuf += tc.function.arguments;
        }
      }

      // Finish reason
      if (choice.finish_reason) {
        // Emit accumulated tool calls before the stop event
        if (choice.finish_reason === 'tool_calls' || toolCalls.size > 0) {
          for (const [, block] of toolCalls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(block.argsBuf || '{}');
            } catch {
              // Malformed JSON — use empty args
            }
            yield { type: 'tool_call', id: block.id, name: block.name, args };
          }
          toolCalls.clear();
        }

        const reason =
          choice.finish_reason === 'stop'
            ? 'end_turn'
            : choice.finish_reason === 'tool_calls'
              ? 'tool_use'
              : choice.finish_reason === 'length'
                ? 'max_tokens'
                : 'end_turn';

        yield { type: 'stop', reason };
      }
    }
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.apiKey) {
      return { ok: false, error: 'API key is required' };
    }

    try {
      // Use the models endpoint for a lightweight validation call
      const url = config.baseUrl
        ? config.baseUrl.replace('/chat/completions', '/models')
        : 'https://api.openai.com/v1/models';

      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: '',
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { ok: false, error: 'Invalid API key' };
        }
        return { ok: false, error: `API error: ${response.status}` };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async listModels(_config: ProviderConfig): Promise<ModelInfo[]> {
    return STATIC_MODELS;
  }
}
