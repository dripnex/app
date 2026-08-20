const CONTEXT_CHARS = 2000;

export interface InlineEditContext {
  title: string;
  selection: string;
  before: string;
  after: string;
  instruction: string;
}

export function inlineEditContext(
  content: string,
  from: number,
  to: number,
  title: string,
  instruction: string
): InlineEditContext {
  const start = Math.max(0, Math.min(from, content.length));
  const end = Math.max(start, Math.min(to, content.length));
  const beforeFrom = Math.max(0, start - CONTEXT_CHARS);
  const afterTo = Math.min(content.length, end + CONTEXT_CHARS);
  return {
    title: title.trim() || 'Untitled',
    selection: content.slice(start, end),
    before: content.slice(beforeFrom, start),
    after: content.slice(end, afterTo),
    instruction,
  };
}

export function buildInlineEditPrompt(ctx: InlineEditContext): string {
  const body = ctx.selection || '(empty — insert new markdown at the cursor)';
  return [
    'Rewrite ONLY the selection. Reply with the replacement markdown only.',
    'No explanation. Do not wrap the result in a fence unless the instruction asks for a fenced block.',
    'Preserve surrounding Markdown style and indentation.',
    '',
    `TITLE: ${ctx.title}`,
    '',
    'BEFORE:',
    ctx.before || '(start of note)',
    '',
    'SELECTION:',
    body,
    '',
    'AFTER:',
    ctx.after || '(end of note)',
    '',
    `INSTRUCTION: ${ctx.instruction}`,
  ].join('\n');
}

/** Strip a single wrapping fence. Linear scan — no regex. */
export function extractInlineReplacement(raw: string, keepFence: boolean): string | null {
  if (!raw.trim()) return null;
  if (keepFence) return raw;
  const text = raw.trim();
  if (!text.startsWith('```')) return raw;
  const firstNl = text.indexOf('\n');
  if (firstNl === -1) return text;
  if (!text.endsWith('```')) return text;
  const inner = text.slice(firstNl + 1, text.length - 3);
  return inner || text;
}
