import type { PluginManifest } from '@dripnex/plugin-api';
import { offsetInFence } from './sourceScan';

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function hrefFor(url: string): string {
  return url.includes(')') ? `<${url}>` : url;
}

interface LineLink {
  from: number;
  to: number;
  label: string;
  href: string;
}

/** Parse `[label](dest)` on one line. Bare destinations keep balanced parentheses. */
function parseLinkAt(line: string, start: number): LineLink | null {
  if (line[start] !== '[') return null;
  let i = start + 1;
  let label = '';
  while (i < line.length && line[i] !== ']' && line[i] !== '\n') {
    if (label.length >= 200) return null;
    label += line[i];
    i += 1;
  }
  if (line[i] !== ']') return null;
  i += 1;
  if (line[i] !== '(') return null;
  i += 1;

  let href: string;
  if (line[i] === '<') {
    const close = line.indexOf('>', i + 1);
    if (close < 0 || line.slice(i + 1, close).includes('\n')) return null;
    href = line.slice(i + 1, close);
    i = close + 1;
  } else {
    const hrefStart = i;
    let depth = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === ' ' || ch === '\t' || ch === '\n') break;
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        if (depth === 0) break;
        depth -= 1;
      }
      i += 1;
    }
    href = line.slice(hrefStart, i);
  }

  while (line[i] === ' ' || line[i] === '\t') i += 1;
  if (line[i] === '"') {
    i += 1;
    while (i < line.length && line[i] !== '"' && line[i] !== '\n') i += 1;
    if (line[i] !== '"') return null;
    i += 1;
    while (line[i] === ' ' || line[i] === '\t') i += 1;
  }
  if (line[i] !== ')') return null;
  return { from: start, to: i + 1, label, href };
}

function linksOnLine(line: string): LineLink[] {
  const hits: LineLink[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '[') continue;
    if (i > 0 && line[i - 1] === '!') continue;
    const parsed = parseLinkAt(line, i);
    if (!parsed) continue;
    hits.push(parsed);
    i = parsed.to - 1;
  }
  return hits;
}

/** Wrap the selection (or the cursor) as `[text](url)`. Does not rewrite the rest of the note. */
export function wrapLinkPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const selected = content.slice(from, to);
  if (/\r|\n/.test(selected)) return null;

  const inner = selected.trim();
  if (/^\[[^\]]*\]\([^)]*\)$/.test(inner)) return null;
  if (/\[[^\]]*\]\(/.test(inner)) return null;
  if (/\[\[|\]\]/.test(inner)) return null;

  if (!inner) {
    return { from, to, text: '[]()', cursor: from + 1 };
  }
  if (looksLikeUrl(inner)) {
    const href = hrefFor(inner);
    const text = `[](${href})`;
    return { from, to, text, cursor: from + 1 };
  }

  if (/[[\]]/.test(inner)) return null;
  const label = inner;
  const text = `[${label}]()`;
  return { from, to, text, cursor: from + text.length - 1 };
}

/** Unwrap the `[text](url)` under the cursor. Text wins; fences and images skipped. Does not rewrite the rest of the note. */
export function unwrapLinkPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (from > to) return null;
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  const nl = content.indexOf('\n', from);
  const line = content.slice(lineStart, nl === -1 ? content.length : nl);

  for (const match of linksOnLine(line)) {
    const hitFrom = lineStart + match.from;
    const hitTo = lineStart + match.to;
    if (from < hitFrom || to > hitTo) continue;
    const label = match.label.trim();
    const href = match.href.trim();
    const text = label || href;
    if (!text) continue;
    return { from: hitFrom, to: hitTo, text, cursor: hitFrom + text.length };
  }
  return null;
}

export const wrapLinkPlugin: PluginManifest = {
  id: 'dripnex-wrap-link',
  name: 'Wrap Link',
  version: '1.0.0',
  description: 'Wrap the selection as a Markdown link, or unwrap the mark under the cursor',

  activate(context) {
    const apply = (
      plan: { from: number; to: number; text: string; cursor: number } | null,
      miss: string
    ) => {
      if (!plan) {
        context.log.info(miss);
        return false;
      }
      context.editor.replaceRange(plan.from, plan.to, plan.text);
      context.editor.setSelection(plan.cursor);
      context.editor.focus();
      return true;
    };

    const wrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(
        wrapLinkPlan(context.editor.getContent(), from, to),
        'Selection is not a link candidate'
      );
    };

    const unwrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(
        unwrapLinkPlan(context.editor.getContent(), from, to),
        'Cursor is not on a link'
      );
    };

    const unregisterWrap = context.registerCommand(
      { id: 'wrap', name: 'Wrap as Link', icon: 'Link' },
      wrap
    );
    const unregisterUnwrap = context.registerCommand(
      { id: 'unwrap', name: 'Unwrap Link', icon: 'Link' },
      unwrap
    );

    return {
      dispose() {
        unregisterWrap();
        unregisterUnwrap();
      },
    };
  },
};
