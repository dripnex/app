/** Next-edit suggestions: prompt + insertion extract. No regex — linear scans. */

export const NES_CONTEXT_CHARS = 1200;
export const NES_MAX_INSERTION = 200;

export interface NesLineContext {
  prefix: string;
  suffix: string;
  before: string;
  after: string;
  title: string;
}

export function nesLineContext(content: string, cursor: number, title: string): NesLineContext {
  const safeCursor = Math.max(0, Math.min(cursor, content.length));
  let lineStart = safeCursor;
  while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart -= 1;
  let lineEnd = safeCursor;
  while (lineEnd < content.length && content[lineEnd] !== '\n') lineEnd += 1;

  const prefix = content.slice(lineStart, safeCursor);
  const suffix = content.slice(safeCursor, lineEnd);
  const beforeFrom = Math.max(0, lineStart - NES_CONTEXT_CHARS);
  const afterTo = Math.min(content.length, lineEnd + NES_CONTEXT_CHARS);

  return {
    prefix,
    suffix,
    before: content.slice(beforeFrom, lineStart),
    after: content.slice(lineEnd, afterTo),
    title,
  };
}

export function buildNesPrompt(ctx: NesLineContext): string {
  const title = ctx.title.trim() || 'Untitled';
  return [
    'Complete a single Markdown line. Reply with ONLY that completed line.',
    'No quotes, no fences, no explanation.',
    'Reproduce the existing text on both sides of ⟦CURSOR⟧ exactly.',
    'Insert at most one short continuation at ⟦CURSOR⟧ so lists, tables, and emphasis stay valid.',
    '',
    `TITLE: ${title}`,
    '',
    'BEFORE:',
    ctx.before || '(start of note)',
    '',
    'LINE:',
    `${ctx.prefix}⟦CURSOR⟧${ctx.suffix}`,
    '',
    'AFTER:',
    ctx.after || '(end of note)',
  ].join('\n');
}

export function extractNesInsertion(raw: string, prefix: string, suffix: string): string | null {
  const line = firstContentLine(raw);
  if (!line) return null;

  let body = line;
  if (prefix) {
    const at = body.indexOf(prefix);
    if (at === -1) return null;
    body = body.slice(at + prefix.length);
  }
  if (suffix) {
    const at = body.lastIndexOf(suffix);
    if (at === -1) return null;
    body = body.slice(0, at);
  }
  if (!body || body.length > NES_MAX_INSERTION) return null;
  return body;
}

function firstContentLine(raw: string): string | null {
  let i = 0;
  const n = raw.length;
  while (i < n) {
    let end = i;
    while (end < n && raw[end] !== '\n') end += 1;
    const line = raw.slice(i, end).trim();
    i = end + 1;
    if (!line) continue;
    if (line.startsWith('```')) continue;
    if (line === '"""' || line === "'''") continue;
    return stripWrappingQuotes(line);
  }
  return null;
}

function stripWrappingQuotes(line: string): string {
  if (line.length >= 2) {
    const a = line[0];
    const b = line[line.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return line.slice(1, -1);
    }
  }
  return line;
}
