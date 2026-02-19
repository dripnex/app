/**
 * Claude API client (fetch-based, pure TypeScript).
 * Designed to be called via IPC proxy in the main process.
 */

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequestOptions {
  apiKey: string;
  model: string;
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}

export interface ClaudeResponse {
  ok: true;
  content: string;
}

export interface ClaudeError {
  ok: false;
  error: string;
}

export type ClaudeResult = ClaudeResponse | ClaudeError;

const API_URL = 'https://api.anthropic.com/v1/messages';

/** Minimal fetch signature for portability (no DOM lib dependency) */
type FetchFn = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

export async function queryClaudeAPI(
  options: ClaudeRequestOptions,
  fetchFn: FetchFn
): Promise<ClaudeResult> {
  const { apiKey, model, system, messages, maxTokens = 2048 } = options;

  try {
    const response = await fetchFn(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `API error ${response.status}: ${body}` };
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const textBlock = data.content.find(b => b.type === 'text');
    return {
      ok: true,
      content: textBlock?.text ?? '',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
