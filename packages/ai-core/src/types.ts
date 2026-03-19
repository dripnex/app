// packages/ai-core/src/types.ts

// ─── Event Protocol ─────────────────────────────────────────

type BaseEvent = {
  metadata?: Record<string, unknown>;
};

export type LLMErrorCode =
  | 'rate_limit'
  | 'auth_failed'
  | 'context_overflow'
  | 'invalid_request'
  | 'model_not_found'
  | 'network'
  | 'provider_error'
  | 'cancelled'
  | 'timeout';

export type LLMEvent =
  | ({ type: 'start'; model: string; requestId: string; provider: string } & BaseEvent)
  | ({ type: 'text'; delta: string } & BaseEvent)
  | ({ type: 'tool_call'; id: string; name: string; args: unknown } & BaseEvent)
  | ({ type: 'tool_result'; callId: string; result: unknown } & BaseEvent)
  | ({ type: 'usage'; inputTokens: number; outputTokens: number } & BaseEvent)
  | ({ type: 'error'; code: LLMErrorCode; error: string; retryable: boolean } & BaseEvent)
  | ({ type: 'done'; durationMs: number; cancelled?: boolean } & BaseEvent)
  | ({ type: 'stop'; reason: 'end_turn' | 'tool_use' | 'max_tokens' } & BaseEvent);

// ─── Chat Types ─────────────────────────────────────────────

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export type MessageContent = string | ContentPart[];

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
}
