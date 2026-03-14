export { queryClaudeAPI } from './claude-client';
export type {
  ClaudeMessage,
  ClaudeRequestOptions,
  ClaudeResponse,
  ClaudeError,
  ClaudeResult,
} from './claude-client';

export { buildRagPrompt } from './rag';
export type { NoteContext, AiPanelMode, RagInput, RagOutput } from './rag';

export {
  SYSTEM_PROMPT,
  ASK_NOTES_SYSTEM_PROMPT,
  SUMMARIZE_SYSTEM_PROMPT,
  SUMMARIZE_USER_TEMPLATE,
  REWRITE_SYSTEM_PROMPT,
  REWRITE_USER_TEMPLATE,
  TWEET_SYSTEM_PROMPT,
  TWEET_USER_TEMPLATE,
  buildContextPrompt,
  buildCurrentNotePrompt,
} from './prompts';

// AI Command extensibility (Phase 5)
export type {
  AiCommandDefinition,
  AiCommandPreset,
  AiTemplatePlaceholder,
  AiCommandValidationError,
} from './aiCommandTypes';
export {
  AI_TEMPLATE_PLACEHOLDERS,
  resolveTemplate,
  validateAiCommandDefinition,
  validateAiCommandPreset,
  serializePreset,
  parsePreset,
} from './aiCommandTypes';
