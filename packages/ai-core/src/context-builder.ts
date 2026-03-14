// packages/ai-core/src/context-builder.ts
import type { ChatMessage, MessageContent } from './types.js';

// ─── Types ──────────────────────────────────────────────────

export type AiPanelMode = 'chat' | 'ask-notes';

export interface NoteContext {
  id: string;
  title: string;
  content: string;
}

export interface ContextSources {
  systemPrompt: string;
  currentNote?: NoteContext | null;
  history: ChatMessage[];
  relevantNotes: NoteContext[];
  toolResults?: Array<{ callId: string; result: unknown }>;
}

export interface ContextBudget {
  maxContextTokens: number;
  maxResponseTokens: number;
}

export interface ContextBuildResult {
  system: string;
  messages: ChatMessage[];
  tokenEstimate: number;
  truncated: boolean;
  notesIncluded: number;
}

// ─── Token Estimation ───────────────────────────────────────

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(content: MessageContent): number {
  if (typeof content === 'string') return estimateTokens(content);
  return content.reduce((sum, part) => {
    if (part.type === 'text') return sum + estimateTokens(part.text);
    if (part.type === 'image') return sum + 1000;
    return sum;
  }, 0);
}

// ─── System Prompts ─────────────────────────────────────────

export const SYSTEM_PROMPT = `You are an AI assistant embedded in Readied, a markdown note-taking app.
You help users with their notes: answering questions, summarizing content, suggesting improvements, and generating new content.

Guidelines:
- Be concise and helpful
- Format responses in markdown
- When referencing notes, mention their titles
- Respect the user's writing style
- Never fabricate information not present in the provided context`;

export const ASK_NOTES_SYSTEM_PROMPT = `You are an AI assistant embedded in Readied, a markdown note-taking app.
You are in "Ask Your Notes" mode. Your primary job is to answer the user's question using ONLY the notes provided as context.

Guidelines:
- Answer based on the content found in the user's notes
- If the notes do not contain enough information, say so clearly
- Cite note titles when referencing information
- Format responses in markdown
- Be concise and helpful
- Never fabricate information not present in the provided notes`;

export const SUMMARIZE_SYSTEM_PROMPT = `You are a concise summarizer. Produce a clear, accurate summary in markdown. Do not add information that is not present in the source text.`;
export const SUMMARIZE_USER_TEMPLATE = `Summarize the following text concisely:\n\n{{selection}}`;
export const REWRITE_SYSTEM_PROMPT = `You are a skilled editor. Rewrite the provided text to improve clarity, flow, and readability while preserving the original meaning. Output only the rewritten text in markdown.`;
export const REWRITE_USER_TEMPLATE = `Rewrite the following text to improve clarity:\n\n{{selection}}`;
export const TWEET_SYSTEM_PROMPT = `You are a social media copywriter. Convert the provided text into a single tweet (max 280 characters). Be punchy and engaging. Output only the tweet text, no quotes or labels.`;
export const TWEET_USER_TEMPLATE = `Convert this into a tweet (max 280 chars):\n\n{{selection}}`;

// ─── Context Builder ────────────────────────────────────────

function formatCurrentNote(note: NoteContext): string {
  return `\n\nThe user is currently viewing this note:\n\n--- Current Note: "${note.title}" ---\n${note.content}`;
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... truncated]';
}

export function buildContext(sources: ContextSources, budget: ContextBudget): ContextBuildResult {
  const available = budget.maxContextTokens - budget.maxResponseTokens;
  let used = 0;
  let truncated = false;

  // 1. System prompt (always fits)
  let system = sources.systemPrompt;
  used += estimateTokens(system);

  // 2. Current note (high priority, truncate if huge)
  if (sources.currentNote) {
    const noteText = formatCurrentNote(sources.currentNote);
    const noteTokens = estimateTokens(noteText);
    if (used + noteTokens <= available * 0.5) {
      system += noteText;
      used += noteTokens;
    } else {
      const truncatedNote = truncateToTokens(noteText, (available - used) * 0.4);
      system += truncatedNote;
      used += estimateTokens(truncatedNote);
      truncated = true;
    }
  }

  // 3. Conversation history (newest turns first, drop oldest on overflow)
  const messages: ChatMessage[] = [];
  const reversedHistory = [...sources.history].reverse();
  for (const msg of reversedHistory) {
    const msgTokens = estimateMessageTokens(msg.content);
    if (used + msgTokens > available * 0.8) {
      truncated = true;
      break;
    }
    messages.unshift(msg);
    used += msgTokens;
  }

  // 4. Relevant notes (fill remaining budget)
  let notesIncluded = 0;
  if (sources.relevantNotes.length > 0) {
    const notesSections: string[] = [];
    for (const note of sources.relevantNotes) {
      const section = `--- Note: "${note.title}" ---\n${note.content}`;
      const sectionTokens = estimateTokens(section);
      if (used + sectionTokens > available) {
        truncated = true;
        break;
      }
      notesSections.push(section);
      used += sectionTokens;
      notesIncluded++;
    }
    if (notesSections.length > 0) {
      system += `\n\nRelevant notes from user's knowledge base:\n\n${notesSections.join('\n\n')}`;
    }
  }

  return { system, messages, tokenEstimate: used, truncated, notesIncluded };
}
