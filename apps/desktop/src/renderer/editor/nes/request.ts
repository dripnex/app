import type { LLMEvent } from '@dripnex/ai-core';
import { useSettingsStore } from '../../stores/settings';
import { resolveAiAuth } from '../../components/ai/resolveAiAuth';
import { buildNesPrompt, extractNesInsertion, nesLineContext } from './parse';
import type { NesCompleteInput } from './extension';

const NES_MAX_TOKENS = 96;

/**
 * Ask the configured provider for a one-line continuation.
 * Does not log prompt or completion (PHI).
 */
export async function requestNesCompletion(input: NesCompleteInput): Promise<string | null> {
  const ai = window.dripnex?.ai;
  if (!ai?.chat) return null;

  const auth = resolveAiAuth(useSettingsStore.getState().settings.ai, () => undefined);
  if (auth.missingKey) return null;

  const ctx = nesLineContext(input.content, input.cursor, input.title);
  const prompt = buildNesPrompt(ctx);

  try {
    const raw = await collectChat(ai, {
      query: prompt,
      currentNote: null,
      relevantNotes: [],
      history: [],
      mode: 'chat',
      provider: auth.provider,
      model: auth.model,
      providerConfig: { apiKey: auth.apiKey, baseUrl: auth.baseUrl },
      maxResponseTokens: NES_MAX_TOKENS,
    });
    if (raw == null) return null;
    return extractNesInsertion(raw, ctx.prefix, ctx.suffix);
  } catch {
    return null;
  }
}

type ChatApi = {
  chat: (request: {
    query: string;
    currentNote: null;
    relevantNotes: [];
    history: [];
    mode: 'chat';
    provider: string;
    model: string;
    providerConfig: { apiKey?: string; baseUrl?: string };
    maxResponseTokens: number;
  }) => Promise<{ requestId: string }>;
  onEvent: (cb: (requestId: string, event: unknown) => void) => () => void;
};

function collectChat(ai: ChatApi, request: Parameters<ChatApi['chat']>[0]): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let requestId: string | null = null;
    let text = '';
    const buffered: Array<{ id: string; event: LLMEvent }> = [];
    let settled = false;

    const finish = (value: string | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      off();
      if (error) reject(error);
      else resolve(value);
    };

    const apply = (id: string, event: LLMEvent) => {
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
    };

    const off = ai.onEvent((id, raw) => apply(id, raw as LLMEvent));

    void ai
      .chat(request)
      .then(result => {
        requestId = result.requestId;
        for (const item of buffered) apply(item.id, item.event);
      })
      .catch(error => finish(null, error));
  });
}
