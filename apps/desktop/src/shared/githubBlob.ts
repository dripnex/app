export const GITHUB_CONNECT_REQUIRED = 'Connect GitHub in Settings → Integrations';

export const MAX_EMBED_LINES = 200;

export interface GithubLineRange {
  start: number;
  end: number;
}

export interface GithubBlobRef {
  kind: 'blob';
  owner: string;
  repo: string;
  ref: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
  url: string;
}

export interface GithubIssueRef {
  kind: 'issue';
  owner: string;
  repo: string;
  number: number;
  url: string;
}

export interface GithubPullRef {
  kind: 'pull';
  owner: string;
  repo: string;
  number: number;
  url: string;
}

export interface GithubCommitRef {
  kind: 'commit';
  owner: string;
  repo: string;
  sha: string;
  url: string;
}

export type GithubPasteTarget = GithubBlobRef | GithubIssueRef | GithubPullRef | GithubCommitRef;

const LANG_BY_EXT: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  mjs: 'js',
  cjs: 'js',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  md: 'md',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  css: 'css',
  scss: 'scss',
  html: 'html',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  cs: 'csharp',
  php: 'php',
  vue: 'vue',
  svelte: 'svelte',
};

/** Parse `https://github.com/owner/repo/blob/<ref>/path#L10-L20`. */
export function parseGithubBlobUrl(raw: string): GithubBlobRef | null {
  const parsed = parseGithubPasteUrl(raw);
  return parsed?.kind === 'blob' ? parsed : null;
}

export function parseGithubPasteUrl(raw: string): GithubPasteTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'github.com') return null;

  const parts = parsed.pathname
    .split('/')
    .filter(Boolean)
    .map(segment => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  if (parts.length < 4) return null;
  const owner = parts[0]!;
  const repo = parts[1]!;
  const kind = parts[2]!;
  const rest = parts.slice(3);
  const url = raw.trim();

  if (kind === 'blob') {
    if (rest.length < 2) return null;
    const ref = rest[0]!;
    const path = rest.slice(1).join('/');
    if (!path) return null;
    const range = parseGithubLineRange(parsed.hash);
    return {
      kind: 'blob',
      owner,
      repo,
      ref,
      path,
      startLine: range?.start ?? null,
      endLine: range?.end ?? null,
      url,
    };
  }

  if (kind === 'issues' && rest[0] && /^\d+$/.test(rest[0])) {
    return { kind: 'issue', owner, repo, number: Number(rest[0]), url };
  }
  if (kind === 'pull' && rest[0] && /^\d+$/.test(rest[0])) {
    return { kind: 'pull', owner, repo, number: Number(rest[0]), url };
  }
  if ((kind === 'commit' || kind === 'commits') && rest[0]) {
    return { kind: 'commit', owner, repo, sha: rest[0], url };
  }
  return null;
}

export function parseGithubLineRange(hash: string): GithubLineRange | null {
  const match = hash.match(/^#L(\d+)(?:C\d+)?(?:-L?(\d+)(?:C\d+)?)?/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return null;
  }
  return { start, end };
}

/** Inclusive 1-indexed slice, matching GitHub `#L10-L20`. */
export function sliceFileLines(
  content: string,
  start: number,
  end: number,
  cap = MAX_EMBED_LINES
): { text: string; start: number; end: number } | null {
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (start < 1 || start > lines.length) return null;
  const last = Math.min(end, start + cap - 1, lines.length);
  if (last < start) return null;
  return {
    text: lines.slice(start - 1, last).join('\n'),
    start,
    end: last,
  };
}

export function languageFromPath(filePath: string): string {
  const base = filePath.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  const ext = base.slice(dot + 1).toLowerCase();
  return LANG_BY_EXT[ext] ?? ext.replace(/[^a-z0-9+#.-]/g, '');
}

export function formatGithubBlobMarkdown(
  blob: GithubBlobRef,
  sliced: { text: string; start: number; end: number }
): string {
  const lang = languageFromPath(blob.path);
  const range =
    sliced.start === sliced.end ? `{${sliced.start}}` : `{${sliced.start}-${sliced.end}}`;
  const quoted = /[\s"']/.test(blob.path);
  const title = quoted ? `title="${blob.path.replace(/"/g, '')}"` : `title=${blob.path}`;
  const info = [lang, title, `startLine=${sliced.start}`, range].filter(Boolean).join(' ');
  const ticks = fenceTicks(sliced.text);
  const hash =
    sliced.start === sliced.end ? `#L${sliced.start}` : `#L${sliced.start}-L${sliced.end}`;
  const label = `${blob.owner}/${blob.repo}/${blob.path}${hash}`;
  return `[${label}](${blob.url})\n\n${ticks}${info}\n${sliced.text}\n${ticks}`;
}

function fenceTicks(body: string): string {
  let longest = 2;
  for (const match of body.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return '`'.repeat(longest + 1);
}
