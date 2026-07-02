// packages/ai-core/src/retry.ts
import type { LLMEvent, LLMErrorCode } from './types.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryableCodes: LLMErrorCode[];
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  jitter: true,
  retryableCodes: ['rate_limit', 'network', 'provider_error'],
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, opts: RetryOptions): number {
  const exponential = Math.min(opts.baseDelay * 2 ** attempt, opts.maxDelay);
  if (!opts.jitter) return exponential;
  return exponential * (0.5 + Math.random() * 0.5);
}

export function classifyError(err: unknown): LLMErrorCode {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'cancelled';
    const msg = err.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit'))
      return 'rate_limit';
    if (msg.includes('401') || msg.includes('unauthorized') || /invalid.{0,80}key/.test(msg))
      return 'auth_failed';
    if (msg.includes('context') || msg.includes('too long') || msg.includes('too many tokens'))
      return 'context_overflow';
    if (msg.includes('404')) return 'model_not_found';
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused'))
      return 'network';
    if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  }
  return 'provider_error';
}

export async function* withRetry(
  fn: () => AsyncIterable<LLMEvent>,
  options: Partial<RetryOptions> = {}
): AsyncIterable<LLMEvent> {
  const opts = { ...DEFAULT_RETRY, ...options };
  let lastError: LLMEvent | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      let hadRetryableError = false;
      let emittedPayload = false;

      for await (const event of fn()) {
        if (event.type === 'error' && event.retryable && opts.retryableCodes.includes(event.code)) {
          if (!emittedPayload && attempt < opts.maxRetries) {
            lastError = event;
            hadRetryableError = true;
            break;
          } else {
            // Already emitted content or final attempt — yield as non-retryable
            yield { ...event, retryable: false };
            return;
          }
        }
        if (
          event.type === 'text' ||
          event.type === 'tool_call' ||
          event.type === 'tool_result' ||
          event.type === 'stop'
        ) {
          emittedPayload = true;
        }
        yield event;
        if (event.type === 'done') return;
      }

      if (!hadRetryableError) return;

      const delay = calculateDelay(attempt, opts);
      yield {
        type: 'error',
        code: (lastError as Extract<LLMEvent, { type: 'error' }>).code,
        error: `Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 2}/${opts.maxRetries + 1})`,
        retryable: true,
        metadata: { retryAttempt: attempt + 1, delayMs: delay },
      };
      await sleep(delay);
    } catch (err) {
      const code = classifyError(err);
      if (!opts.retryableCodes.includes(code) || attempt >= opts.maxRetries) {
        yield {
          type: 'error',
          code,
          error: err instanceof Error ? err.message : String(err),
          retryable: false,
        };
        return;
      }
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  if (lastError) {
    yield { ...(lastError as Extract<LLMEvent, { type: 'error' }>), retryable: false };
  }
}
