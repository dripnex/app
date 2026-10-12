export interface FenceHighlight {
  start: number;
  end: number;
}

export interface FenceInfo {
  lang: string | null;
  filename: string | null;
  startLine: number | null;
  highlight: FenceHighlight | null;
}

const LANG = /^[\w+#.-]+/;
const NAMED = /(?:^|\s)(?:title|filename)=(?:"([^"]+)"|'([^']+)'|(\S+))/i;
const START_LINE = /(?:^|\s)startLine=(\d+)/i;
const HIGHLIGHT = /\{(\d+)(?:-(\d+))?\}/;
const SPECIAL = new Set(['mermaid', 'math', 'katex', 'latex']);

/** Parse a fence info-string: `ts title=src/a.ts`, `ts:src/a.ts`, `ts src/a.ts {10-20}`. */
export function parseFenceInfo(info: string): FenceInfo {
  const trimmed = info.trim();
  const highlight = parseHighlight(trimmed);
  const startLine = parseStartLine(trimmed);
  if (!trimmed) return { lang: null, filename: null, startLine, highlight };

  const colon = trimmed.match(/^([\w+#.-]+):(\S+)$/);
  if (colon) {
    return withSpecial(colon[1] ?? null, colon[2] ?? null, startLine, highlight);
  }

  const langMatch = trimmed.match(LANG);
  const lang = langMatch?.[0] ?? null;
  const rest = lang ? trimmed.slice(lang.length).trim() : trimmed;
  const named = rest.match(NAMED);
  if (named) {
    return withSpecial(lang, named[1] ?? named[2] ?? named[3] ?? null, startLine, highlight);
  }

  const bare = rest.split(/\s+/)[0] ?? '';
  if (bare && !bare.startsWith('{') && /[./]/.test(bare)) {
    return withSpecial(lang, bare, startLine, highlight);
  }

  return withSpecial(lang, null, startLine, highlight);
}

function parseHighlight(info: string): FenceHighlight | null {
  const match = info.match(HIGHLIGHT);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return null;
  }
  return { start, end };
}

function parseStartLine(info: string): number | null {
  const match = info.match(START_LINE);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function withSpecial(
  lang: string | null,
  filename: string | null,
  startLine: number | null,
  highlight: FenceHighlight | null
): FenceInfo {
  if (lang && SPECIAL.has(lang.toLowerCase())) {
    return { lang, filename: null, startLine: null, highlight: null };
  }
  return { lang, filename, startLine, highlight };
}
