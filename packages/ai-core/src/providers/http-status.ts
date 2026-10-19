// packages/ai-core/src/providers/http-status.ts
import type { LLMEvent } from '../types.js';

export type HttpErrorClassification = {
  code: Extract<LLMEvent, { type: 'error' }>['code'];
  retryable: boolean;
};

/**
 * Shared HTTP status -> LLMErrorCode mapping used by every provider.
 * Pass `overrides` for the handful of status codes a given provider
 * classifies differently (e.g. Anthropic's 529, OpenAI's 413).
 */
export function classifyHttpStatus(
  status: number,
  overrides: Partial<Record<number, HttpErrorClassification>> = {}
): HttpErrorClassification {
  const override = overrides[status];
  if (override) return override;

  if (status === 429) return { code: 'rate_limit', retryable: true };
  if (status === 401) return { code: 'auth_failed', retryable: false };
  if (status === 404) return { code: 'model_not_found', retryable: false };
  if (status === 400) return { code: 'invalid_request', retryable: false };
  if (status >= 500) return { code: 'provider_error', retryable: true };
  return { code: 'provider_error', retryable: false };
}
