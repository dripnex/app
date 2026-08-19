import { selectAi, useSettingsStore } from '../../stores/settings';
import { resolveAiAuth } from '../../components/ai/resolveAiAuth';
import { collectChat } from '../ai/collectChat';
import { buildInlineEditPrompt, extractInlineReplacement, inlineEditContext } from './parse';

const INLINE_MAX_TOKENS = 2048;

export type InlineEditResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'missing-key' | 'empty' | 'failed' };

export async function requestInlineEdit(input: {
  content: string;
  from: number;
  to: number;
  title: string;
  instruction: string;
  keepFence?: boolean;
}): Promise<InlineEditResult> {
  const ai = window.dripnex?.ai;
  if (!ai?.chat) return { ok: false, reason: 'failed' };

  const auth = resolveAiAuth(selectAi(useSettingsStore.getState()), () => undefined);
  if (auth.missingKey) return { ok: false, reason: 'missing-key' };

  const ctx = inlineEditContext(
    input.content,
    input.from,
    input.to,
    input.title,
    input.instruction
  );
  const prompt = buildInlineEditPrompt(ctx);

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
      maxResponseTokens: INLINE_MAX_TOKENS,
    });
    const text = raw ? extractInlineReplacement(raw, Boolean(input.keepFence)) : null;
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
