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
