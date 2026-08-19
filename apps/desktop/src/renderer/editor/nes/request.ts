import { selectAi, useSettingsStore } from '../../stores/settings';
import { resolveAiAuth } from '../../components/ai/resolveAiAuth';
import { collectChat } from '../ai/collectChat';
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

  const auth = resolveAiAuth(selectAi(useSettingsStore.getState()), () => undefined);
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
