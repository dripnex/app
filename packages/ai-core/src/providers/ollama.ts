// packages/ai-core/src/providers/ollama.ts
import type { LLMProvider, ProviderConfig, ModelInfo, FetchFn } from '../provider.js';
import type { LLMEvent, ChatOptions, MessageContent, ContentPart } from '../types.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

/**
 * Strip trailing slashes without a regex. `String.replace(/\/+$/, '')` is
 * flagged as polynomial ReDoS (js/polynomial-redos) because baseUrl is
 * config-controlled; a linear scan is backtracking-free.
 */
function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47 /* '/' */) end--;
  return url.slice(0, end);
}

function normalizeContent(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .map((part: ContentPart) => {
      switch (part.type) {
        case 'text':
          return part.text;
        case 'tool_use':
          return '';
        case 'tool_result':
          return part.content;
        case 'image':
          return '[image]';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
}

function buildToolResultMessages(
  content: MessageContent
): Array<{ role: string; content: string }> {
  if (typeof content === 'string') return [];
  const results: Array<{ role: string; content: string }> = [];
  for (const part of content) {
    if (part.type === 'tool_result') {
      results.push({ role: 'tool', content: part.content });
    }
  }
  return results;
}

function classifyHttpStatus(status: number): {
  code: Extract<LLMEvent, { type: 'error' }>['code'];
  retryable: boolean;
} {
  if (status === 429) return { code: 'rate_limit', retryable: true };
  if (status === 404) return { code: 'model_not_found', retryable: false };
  if (status === 400) return { code: 'invalid_request', retryable: false };
  if (status >= 500) return { code: 'provider_error', retryable: true };
  return { code: 'provider_error', retryable: false };
}

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama';
  readonly displayName = 'Ollama (Local)';

  constructor(private fetchFn: FetchFn) {}

  async *chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent> {
    const { model, system, messages, maxTokens, signal, tools } = options;
    const baseUrl = stripTrailingSlashes(config.baseUrl ?? DEFAULT_BASE_URL);

    // Build Ollama message format
    const ollamaMessages: Array<Record<string, unknown>> = [];

    // System message
    if (system) {
      ollamaMessages.push({ role: 'system', content: system });
    }

    // Convert chat messages to Ollama format
    for (const m of messages) {
      // Check for tool_result parts — Ollama expects these as role: 'tool'
      const toolResults = buildToolResultMessages(m.content);
      if (toolResults.length > 0) {
        ollamaMessages.push(...toolResults);
      } else {
        ollamaMessages.push({
          role: m.role,
          content: normalizeContent(m.content),
        });
      }
    }

    const body: Record<string, unknown> = {
      model,
      messages: ollamaMessages,
      stream: true,
      options: {
        num_predict: maxTokens,
      },
    };

    // Tool support — Ollama uses OpenAI-compatible tool format
    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await this.fetchFn(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort) {
        yield { type: 'error', code: 'cancelled', error: 'Request cancelled', retryable: false };
      } else {
        const message = err instanceof Error ? err.message : String(err);
        const isConnectionError =
          message.includes('ECONNREFUSED') ||
          message.includes('fetch failed') ||
          message.includes('Failed to fetch');
        yield {
          type: 'error',
          code: 'network',
          error: isConnectionError
            ? `Cannot connect to Ollama at ${baseUrl}. Is Ollama running? Start it with: ollama serve`
            : message,
          retryable: !isAbort,
        };
      }
      return;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      const { code, retryable } = classifyHttpStatus(response.status);
      yield {
        type: 'error',
        code,
        error: `Ollama error ${response.status}: ${errorBody}`,
        retryable,
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', code: 'provider_error', error: 'No response body', retryable: false };
      return;
    }

    // Parse newline-delimited JSON stream (NDJSON)
    yield* this.parseNDJSONStream(response.body);
  }

  private async *parseNDJSONStream(body: ReadableStream<Uint8Array>): AsyncIterable<LLMEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalOutputTokens = 0;
    let totalInputTokens = 0;
    let emittedToolCalls = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let chunk: Record<string, unknown>;
          try {
            chunk = JSON.parse(trimmed);
          } catch {
            continue; // Skip malformed lines
          }

          // Handle errors from Ollama
          if (chunk.error) {
            yield {
              type: 'error',
              code: 'provider_error',
              error: chunk.error as string,
              retryable: false,
            };
            return;
          }

          const message = chunk.message as Record<string, unknown> | undefined;

          // Handle tool calls
          if (message?.tool_calls) {
            const toolCalls = message.tool_calls as Array<{
              function: { name: string; arguments: Record<string, unknown> };
            }>;
            for (const tc of toolCalls) {
              emittedToolCalls = true;
              yield {
                type: 'tool_call',
                id: `ollama-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: tc.function.name,
                args: tc.function.arguments,
              };
            }
          }

          // Handle text content
          if (message?.content) {
            const delta = message.content as string;
            if (delta) {
              yield { type: 'text', delta };
            }
          }

          // Handle completion
          if (chunk.done === true) {
            // Extract token usage if available
            if (chunk.eval_count != null) {
              totalOutputTokens = chunk.eval_count as number;
            }
            if (chunk.prompt_eval_count != null) {
              totalInputTokens = chunk.prompt_eval_count as number;
            }

            if (totalInputTokens > 0 || totalOutputTokens > 0) {
              yield {
                type: 'usage',
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
              };
            }

            // Determine stop reason
            const hadToolCalls = emittedToolCalls || message?.tool_calls != null;
            yield {
              type: 'stop',
              reason: hadToolCalls ? 'tool_use' : 'end_turn',
            };
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer.trim());
          if (chunk.done === true) {
            if (chunk.eval_count != null || chunk.prompt_eval_count != null) {
              yield {
                type: 'usage',
                inputTokens: (chunk.prompt_eval_count as number) ?? 0,
                outputTokens: (chunk.eval_count as number) ?? 0,
              };
            }
            yield { type: 'stop', reason: 'end_turn' };
          }
        } catch {
          // Ignore malformed trailing data
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    const baseUrl = stripTrailingSlashes(config.baseUrl ?? DEFAULT_BASE_URL);

    try {
      const response = await this.fetchFn(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: {},
        body: '',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `Ollama returned status ${response.status}`,
        };
      }

      const text = await response.text();
      const data = JSON.parse(text);
      if (!data.models || !Array.isArray(data.models)) {
        return { ok: false, error: 'Unexpected response from Ollama' };
      }

      return { ok: true };
    } catch {
      return {
        ok: false,
        error: `Cannot connect to Ollama at ${baseUrl}. Is Ollama running? Start it with: ollama serve`,
      };
    }
  }

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = stripTrailingSlashes(config.baseUrl ?? DEFAULT_BASE_URL);

    try {
      const response = await this.fetchFn(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: {},
        body: '',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const text = await response.text();
      const data = JSON.parse(text) as {
        models: Array<{
          name: string;
          details?: {
            parameter_size?: string;
            family?: string;
          };
        }>;
      };

      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      return data.models.map(m => ({
        id: m.name,
        displayName: m.name,
        // Ollama doesn't expose these directly; use sensible defaults
        contextWindow: 4096,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
      }));
    } catch {
      // Ollama not running or unreachable
      return [];
    }
  }
}
