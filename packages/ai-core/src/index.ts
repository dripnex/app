// packages/ai-core/src/index.ts
export type {
  LLMEvent,
  LLMErrorCode,
  ContentPart,
  MessageContent,
  ChatMessage,
  ToolDefinition,
  ChatOptions,
} from './types.js';

export type { FetchFn, ProviderConfig, ModelInfo, LLMProvider } from './provider.js';

export { ProviderRegistry } from './provider-registry.js';

export {
  buildContext,
  estimateTokens,
  estimateMessageTokens,
  SYSTEM_PROMPT,
  ASK_NOTES_SYSTEM_PROMPT,
  SUMMARIZE_SYSTEM_PROMPT,
  SUMMARIZE_USER_TEMPLATE,
  REWRITE_SYSTEM_PROMPT,
  REWRITE_USER_TEMPLATE,
  TWEET_SYSTEM_PROMPT,
  TWEET_USER_TEMPLATE,
} from './context-builder.js';

export type {
  AiPanelMode,
  NoteContext,
  ContextSources,
  ContextBudget,
  ContextBuildResult,
} from './context-builder.js';

export { withRetry, classifyError } from './retry.js';
export type { RetryOptions } from './retry.js';

export { AnthropicProvider } from './providers/anthropic.js';
