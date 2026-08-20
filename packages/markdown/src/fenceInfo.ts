export interface FenceInfo {
  lang: string | null;
  filename: string | null;
}

const LANG = /^[\w+#.-]+/;
const NAMED = /(?:^|\s)(?:title|filename)=(?:"([^"]+)"|'([^']+)'|(\S+))/i;
const SPECIAL = new Set(['mermaid', 'math', 'katex', 'latex']);

/** Parse a fence info-string: `ts title=src/a.ts`, `ts:src/a.ts`, `ts src/a.ts`. */
export function parseFenceInfo(info: string): FenceInfo {
  const trimmed = info.trim();
  if (!trimmed) return { lang: null, filename: null };

  const colon = trimmed.match(/^([\w+#.-]+):(\S+)$/);
  if (colon) {
    return withSpecial(colon[1] ?? null, colon[2] ?? null);
  }

  const langMatch = trimmed.match(LANG);
  const lang = langMatch?.[0] ?? null;
  const rest = lang ? trimmed.slice(lang.length).trim() : trimmed;
  const named = rest.match(NAMED);
  if (named) {
    return withSpecial(lang, named[1] ?? named[2] ?? named[3] ?? null);
  }

  const bare = rest.split(/\s+/)[0] ?? '';
  if (bare && !bare.startsWith('{') && /[./]/.test(bare)) {
    return withSpecial(lang, bare);
  }

  return withSpecial(lang, null);
}

function withSpecial(lang: string | null, filename: string | null): FenceInfo {
  if (lang && SPECIAL.has(lang.toLowerCase())) {
    return { lang, filename: null };
  }
  return { lang, filename };
}
