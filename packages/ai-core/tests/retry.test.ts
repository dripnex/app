// packages/ai-core/tests/retry.test.ts
import { describe, it, expect } from 'vitest';
import { withRetry, classifyError } from '../src/retry';
import type { LLMEvent } from '../src/types';

async function collectEvents(iterable: AsyncIterable<LLMEvent>): Promise<LLMEvent[]> {
  const events: LLMEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

describe('classifyError', () => {
  it('classifies 429 as rate_limit', () => {
    expect(classifyError(new Error('API error 429: rate limit'))).toBe('rate_limit');
  });

  it('classifies 401 as auth_failed', () => {
    expect(classifyError(new Error('401 Unauthorized'))).toBe('auth_failed');
  });

  it('classifies AbortError as cancelled', () => {
    const err = new DOMException('Aborted', 'AbortError');
    expect(classifyError(err)).toBe('cancelled');
  });

  it('classifies network errors', () => {
    expect(classifyError(new Error('fetch failed: network error'))).toBe('network');
  });

  it('defaults to provider_error', () => {
    expect(classifyError(new Error('something weird'))).toBe('provider_error');
  });
});

describe('withRetry', () => {
  it('passes through events on success', async () => {
    async function* success(): AsyncIterable<LLMEvent> {
      yield { type: 'text', delta: 'hello' };
      yield { type: 'done', durationMs: 100 };
    }

    const events = await collectEvents(
      withRetry(() => success(), {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('text');
    expect(events[1]?.type).toBe('done');
  });

  it('retries on retryable error and succeeds', async () => {
    let attempt = 0;
    function makeStream(): AsyncIterable<LLMEvent> {
      return {
        [Symbol.asyncIterator]() {
          attempt++;
          if (attempt === 1) {
            return {
              async next() {
                return {
                  done: false,
                  value: {
                    type: 'error' as const,
                    code: 'rate_limit' as const,
                    error: '429',
                    retryable: true,
                  },
                };
              },
            };
          }
          let yielded = false;
          return {
            async next() {
              if (!yielded) {
                yielded = true;
                return { done: false, value: { type: 'text' as const, delta: 'success' } };
              }
              return { done: false, value: { type: 'done' as const, durationMs: 50 } };
            },
          };
        },
      };
    }

    const events = await collectEvents(
      withRetry(() => makeStream(), {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('gives up after max retries', async () => {
    async function* alwaysFail(): AsyncIterable<LLMEvent> {
      yield { type: 'error', code: 'rate_limit' as const, error: '429', retryable: true };
    }

    const events = await collectEvents(
      withRetry(() => alwaysFail(), {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 50,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );

    const finalError = events.filter(e => e.type === 'error').pop();
    expect(finalError).toBeDefined();
    if (finalError?.type === 'error') {
      expect(finalError.retryable).toBe(false);
    }
  });

  it('does not retry non-retryable errors', async () => {
    async function* authFail(): AsyncIterable<LLMEvent> {
      yield { type: 'error', code: 'auth_failed' as const, error: '401', retryable: false };
    }

    const events = await collectEvents(
      withRetry(() => authFail(), {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
  });
});
