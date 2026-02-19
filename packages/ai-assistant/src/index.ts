export { queryClaudeAPI } from './claude-client';
export type {
  ClaudeMessage,
  ClaudeRequestOptions,
  ClaudeResponse,
  ClaudeError,
  ClaudeResult,
} from './claude-client';

export { buildRagPrompt } from './rag';
export type { NoteContext, RagInput, RagOutput } from './rag';

export { SYSTEM_PROMPT, buildContextPrompt, buildCurrentNotePrompt } from './prompts';
