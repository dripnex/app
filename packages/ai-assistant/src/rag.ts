/**
 * RAG (Retrieval-Augmented Generation) logic.
 * Searches user's notes and builds context for the AI query.
 */

import {
  SYSTEM_PROMPT,
  ASK_NOTES_SYSTEM_PROMPT,
  buildContextPrompt,
  buildCurrentNotePrompt,
} from './prompts';
import type { ClaudeMessage } from './claude-client';

export interface NoteContext {
  id: string;
  title: string;
  content: string;
}

export type AiPanelMode = 'chat' | 'ask-notes';

export interface RagInput {
  query: string;
  currentNote?: NoteContext | null;
  relevantNotes: NoteContext[];
  history?: ClaudeMessage[];
  /** When 'ask-notes', uses the knowledge-focused system prompt */
  mode?: AiPanelMode;
}

export interface RagOutput {
  system: string;
  messages: ClaudeMessage[];
}

/**
 * Build the system prompt and messages array for a Claude API call,
 * incorporating RAG context from relevant notes.
 */
export function buildRagPrompt(input: RagInput): RagOutput {
  const { query, currentNote, relevantNotes, history = [], mode = 'chat' } = input;

  // Build system prompt with context — use knowledge-focused prompt in ask-notes mode
  let system = mode === 'ask-notes' ? ASK_NOTES_SYSTEM_PROMPT : SYSTEM_PROMPT;

  if (currentNote) {
    system += buildCurrentNotePrompt(currentNote.title, currentNote.content);
  }

  // Filter out the current note from relevant notes to avoid duplication
  const contextNotes = currentNote
    ? relevantNotes.filter(n => n.id !== currentNote.id)
    : relevantNotes;

  if (contextNotes.length > 0) {
    system += buildContextPrompt(contextNotes.map(n => ({ title: n.title, content: n.content })));
  }

  // Build messages: history + current query
  const messages: ClaudeMessage[] = [...history, { role: 'user', content: query }];

  return { system, messages };
}
