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

/** App-wide default model (Anthropic Sonnet). Single source of truth — do not
 * hardcode this string elsewhere; import it. */
export const DEFAULT_MODEL = 'claude-sonnet-5';

export { ProviderRegistry } from './provider-registry.js';

export { ToolRegistry } from './tool-registry.js';
export type { ToolRegistration, ToolResult } from './tool-registry.js';

export { runToolLoop } from './tool-loop.js';
export type { ToolCall, ToolLoopEvent, ToolLoopOptions } from './tool-loop.js';

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
export { OpenAIProvider } from './providers/openai.js';
export { OllamaProvider } from './providers/ollama.js';

export { AIServiceImpl } from './ai-service.js';
export type {
  ChatRequest,
  ChatHandle,
  ToolChatRequest,
  ToolChatHandle,
  AIService,
} from './ai-service.js';

export type {
  AiCommandDefinition,
  AiCommandPreset,
  AiTemplatePlaceholder,
  AiCommandValidationError,
} from './ai-command-types.js';
export {
  AI_TEMPLATE_PLACEHOLDERS,
  resolveTemplate,
  validateAiCommandDefinition,
  validateAiCommandPreset,
  serializePreset,
  parsePreset,
} from './ai-command-types.js';
