/** CommonMark fence opener: 0–3 spaces, then 3+ backticks or tildes. */
export const FENCE = /^( {0,3})(`{3,}|~{3,})/;

/** GFM task-list prefix: indent, then `-` `+` `*` or `1.` / `1)`, then spaces or tabs. */
export const TASK_LIST_PREFIX = String.raw`[ \t]*(?:[-+*]|[0-9]{1,9}[.)])[ \t]+`;
export const TASK_LINE = new RegExp(`^(${TASK_LIST_PREFIX})\\[([ \\txX])\\](?=[ \\t]|$)`);
export const OPEN_TASK_LINE = new RegExp(`^(${TASK_LIST_PREFIX})\\[([ \\t])\\](?=[ \\t]|$)`);
export const DONE_TASK_LINE = new RegExp(`^(${TASK_LIST_PREFIX})\\[([xX])\\](?=[ \\t]|$)`);

export interface SourceLine {
  line: string;
  from: number;
  to: number;
  nextFrom: number;
  inFence: boolean;
  isFenceOpener: boolean;
  isFenceCloser: boolean;
  next: string | null;
}

export interface InlineCodeSpan {
  from: number;
  to: number;
  innerFrom: number;
  innerTo: number;
}

function fenceMarker(line: string): { marker: string; rest: string } | null {
  const match = line.match(FENCE);
  if (!match?.[2]) return null;
  return { marker: match[2], rest: line.slice(match[0].length) };
}

/**
 * Walk markdown source with CRLF-aware offsets and CommonMark fence pairing.
 * A closer must use the same marker character, be at least as long as the opener,
 * and have only spaces or tabs after the marker.
 */
export function walkSourceLines(content: string): SourceLine[] {
  const rows: SourceLine[] = [];
  let i = 0;
  let fence: string | null = null;

  while (i < content.length || rows.length === 0) {
    const nl = content.indexOf('\n', i);
    const crlf = nl > 0 && content[nl - 1] === '\r';
    const lineEnd = nl === -1 ? content.length : crlf ? nl - 1 : nl;
    const line = content.slice(i, lineEnd);
    const nextFrom = nl === -1 ? content.length : nl + 1;
    const parts = fenceMarker(line);

    let isFenceOpener = false;
    let isFenceCloser = false;
    if (parts) {
      if (!fence) {
        fence = parts.marker;
        isFenceOpener = true;
      } else if (
        parts.marker[0] === fence[0] &&
        parts.marker.length >= fence.length &&
        /^[ \t]*$/.test(parts.rest)
      ) {
        isFenceCloser = true;
        fence = null;
      }
    }

    rows.push({
      line,
      from: i,
      to: lineEnd,
      nextFrom,
      inFence: Boolean(fence) || isFenceOpener || isFenceCloser,
      isFenceOpener,
      isFenceCloser,
      next: null,
    });

    if (nl === -1) break;
    i = nextFrom;
  }

  for (let k = 0; k < rows.length - 1; k++) {
    rows[k]!.next = rows[k + 1]!.line;
  }
  return rows;
}

/** Line containing `offset`. A newline belongs to the preceding line; the next line starts after it. */
export function lineAtOffset(content: string, offset: number): SourceLine | null {
  const clamped = Math.max(0, Math.min(offset, content.length));
  const rows = walkSourceLines(content);
  for (const row of rows) {
    if (clamped >= row.from && clamped < row.nextFrom) return row;
  }
  return rows[rows.length - 1] ?? null;
}

export function offsetInFence(content: string, offset: number): boolean {
  return lineAtOffset(content, offset)?.inFence ?? false;
}

/** CommonMark code spans: a run of n backticks closed by a run of the same length. Newlines are allowed. */
export function inlineCodeSpans(line: string): InlineCodeSpan[] {
  const spans: InlineCodeSpan[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') {
      i += 1;
      continue;
    }
    let n = 0;
    while (i + n < line.length && line[i + n] === '`') n += 1;
    let j = i + n;
    let closed = false;
    while (j < line.length) {
      if (line[j] !== '`') {
        j += 1;
        continue;
      }
      let m = 0;
      while (j + m < line.length && line[j + m] === '`') m += 1;
      if (m === n) {
        spans.push({ from: i, to: j + m, innerFrom: i + n, innerTo: j });
        i = j + m;
        closed = true;
        break;
      }
      j += m;
    }
    if (!closed) i += n;
  }
  return spans;
}

export function maskInlineCode(line: string): string {
  if (!line.includes('`')) return line;
  const chars = line.split('');
  for (const span of inlineCodeSpans(line)) {
    for (let k = span.from; k < span.to; k++) chars[k] = ' ';
  }
  return chars.join('');
}
