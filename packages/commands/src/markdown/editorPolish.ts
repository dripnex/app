/**
 * Source-mode helpers for Inkdrop-style editor chrome:
 * checked-task ranges, markdown link hits, and the fenced block at a position.
 */

export interface TextSpan {
  from: number;
  to: number;
}

export interface MarkdownLinkHit extends TextSpan {
  url: string;
  label: string;
}

export interface FenceRange {
  openFrom: number;
  openTo: number;
  closeFrom: number;
  closeTo: number;
  language: string;
  body: string;
}

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const CHECKED_TASK = /^([ \t]*(?:>[ \t]*)*(?:[-*+]|\d+[.)]) \[[xX]\])(.*)$/;
const MD_LINK = /(?<!!)\[([^\]\n]{0,400})\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]{0,200}")?\s*\)/g;
const AUTO_LINK = /<((?:https?:\/\/)[^>\s]{1,500})>/gi;

interface FenceMark {
  ch: '`' | '~';
  len: number;
}

function fenceAfterLine(line: string, fence: FenceMark | null): FenceMark | null {
  const m = line.match(FENCE_LINE);
  if (!m) return fence;
  const marker = m[2] ?? '';
  const ch = marker[0] as '`' | '~';
  const len = marker.length;
  const info = m[3] ?? '';
  if (!fence) {
    if (ch === '`' && info.includes('`')) return fence;
    return { ch, len };
  }
  if (fence.ch === ch && len >= fence.len && info.trim() === '') return null;
  return fence;
}

/** Column range of the task text after `- [x]`. Null when the item is empty. */
export function checkedTaskTextOnLine(line: string): TextSpan | null {
  const m = line.match(CHECKED_TASK);
  if (!m) return null;
  const rest = m[2] ?? '';
  const trimmed = rest.trimStart();
  if (!trimmed) return null;
  const from = (m[1]?.length ?? 0) + (rest.length - trimmed.length);
  return { from, to: line.length };
}

/** Document ranges to strike for completed GFM tasks. Skips fenced code. */
export function checkedTaskMarks(doc: string): TextSpan[] {
  const marks: TextSpan[] = [];
  let offset = 0;
  let fence: FenceMark | null = null;
  for (const line of doc.split('\n')) {
    const inside = fence !== null;
    fence = fenceAfterLine(line, fence);
    if (!inside) {
      const hit = checkedTaskTextOnLine(line);
      if (hit) marks.push({ from: offset + hit.from, to: offset + hit.to });
    }
    offset += line.length + 1;
  }
  return marks;
}

export function markdownLinksInLine(line: string): MarkdownLinkHit[] {
  const hits: MarkdownLinkHit[] = [];
  MD_LINK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MD_LINK.exec(line)) !== null) {
    const index = match.index;
    if (index > 0 && line[index - 1] === '!') continue;
    hits.push({
      from: index,
      to: index + match[0].length,
      label: match[1] ?? '',
      url: match[2] ?? '',
    });
  }
  AUTO_LINK.lastIndex = 0;
  while ((match = AUTO_LINK.exec(line)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (hits.some(hit => from < hit.to && to > hit.from)) continue;
    const url = match[1] ?? '';
    hits.push({ from, to, url, label: url });
  }
  return hits;
}

/** Link whose span contains `offset` (inclusive). */
export function markdownLinkAt(line: string, offset: number): MarkdownLinkHit | null {
  for (const hit of markdownLinksInLine(line)) {
    if (offset >= hit.from && offset <= hit.to) return hit;
  }
  return null;
}

function fenceBody(doc: string, openTo: number, closeFrom: number): string {
  const start = Math.min(openTo + 1, closeFrom);
  const end = closeFrom > start ? closeFrom - 1 : start;
  return doc.slice(start, end);
}

function languageOf(info: string): string {
  const token = info.trim().split(/\s+/)[0] ?? '';
  return token;
}

/** Fenced block that contains `pos`, including the opening and closing lines. */
export function fenceAt(doc: string, pos: number): FenceRange | null {
  let offset = 0;
  let open: { from: number; to: number; ch: '`' | '~'; len: number; language: string } | null =
    null;
  for (const line of doc.split('\n')) {
    const from = offset;
    const to = offset + line.length;
    const m = line.match(FENCE_LINE);
    if (m) {
      const marker = m[2] ?? '';
      const ch = marker[0] as '`' | '~';
      const len = marker.length;
      const info = m[3] ?? '';
      if (!open) {
        if (!(ch === '`' && info.includes('`'))) {
          open = { from, to, ch, len, language: languageOf(info) };
        }
      } else if (open.ch === ch && len >= open.len && info.trim() === '') {
        if (pos >= open.from && pos <= to) {
          return {
            openFrom: open.from,
            openTo: open.to,
            closeFrom: from,
            closeTo: to,
            language: open.language,
            body: fenceBody(doc, open.to, from),
          };
        }
        open = null;
      }
    }
    offset = to + 1;
  }
  if (open && pos >= open.from) {
    return {
      openFrom: open.from,
      openTo: open.to,
      closeFrom: doc.length,
      closeTo: doc.length,
      language: open.language,
      body: fenceBody(doc, open.to, doc.length + 1),
    };
  }
  return null;
}
