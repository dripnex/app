import type { LLMEvent } from '@dripnex/ai-core';
import type { AiAPI } from '../../../preload/api/ai';

export const AI_CHAT_TIMEOUT_MS = 8_000;

export type ChatApi = Pick<AiAPI, 'chat' | 'onEvent' | 'cancel'>;

/** Collect a streamed chat into one string. Does not log text (PHI). */
export function collectChat(
  ai: ChatApi,
  request: Parameters<AiAPI['chat']>[0],
  timeoutMs = AI_CHAT_TIMEOUT_MS
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let requestId: string | null = null;
    let text = '';
    const buffered: Array<{ id: string; event: LLMEvent }> = [];
    let settled = false;

    function finish(value: string | null, error?: unknown): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      off();
      if (error) reject(error);
      else resolve(value);
    }

    function apply(id: string, event: LLMEvent): void {
      if (settled) return;
      if (!requestId) {
        buffered.push({ id, event });
        return;
      }
      if (id !== requestId) return;
      switch (event.type) {
        case 'text':
          text += event.delta;
          break;
        case 'error':
          finish(null, new Error(event.error));
          break;
        case 'done':
          finish(text);
          break;
      }
    }

    const off = ai.onEvent((id, raw) => apply(id, raw as LLMEvent));
    const timeout = setTimeout(() => {
      if (requestId) void ai.cancel(requestId);
      finish(null);
    }, timeoutMs);

    void ai
      .chat(request)
      .then(result => {
        if (settled) {
          void ai.cancel(result.requestId);
          return;
        }
        requestId = result.requestId;
        for (const item of buffered) apply(item.id, item.event);
      })
      .catch(error => finish(null, error));
  });
}
