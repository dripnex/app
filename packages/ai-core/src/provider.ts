// packages/ai-core/src/provider.ts
import type { LLMEvent, ChatOptions } from './types.js';

// ─── Fetch Function Injection ───────────────────────────────

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  body: ReadableStream<Uint8Array> | null;
}>;

// ─── Provider Config ────────────────────────────────────────

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, unknown>;
}

// ─── Model Info ─────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

// ─── Provider Interface ─────────────────────────────────────

export interface LLMProvider {
  readonly id: string;
  readonly displayName: string;

  chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent>;
  validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }>;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
}
