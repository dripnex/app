/**
 * System prompt templates for AI assistant.
 */

export const SYSTEM_PROMPT = `You are an AI assistant embedded in Readied, a markdown note-taking app.
You help users with their notes: answering questions, summarizing content, suggesting improvements, and generating new content.

Guidelines:
- Be concise and helpful
- Format responses in markdown
- When referencing notes, mention their titles
- Respect the user's writing style
- Never fabricate information not present in the provided context`;

export function buildContextPrompt(notes: Array<{ title: string; content: string }>): string {
  if (notes.length === 0) return '';

  const sections = notes.map(
    (n, i) => `--- Note ${i + 1}: "${n.title}" ---\n${n.content}`
  );

  return `\nHere are relevant notes from the user's knowledge base:\n\n${sections.join('\n\n')}`;
}

export function buildCurrentNotePrompt(title: string, content: string): string {
  return `\nThe user is currently viewing this note:\n\n--- Current Note: "${title}" ---\n${content}`;
}
