import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const LINK = /\[([^\]\n]{0,200})\]\((<[^>\n]+>|[^)\s]*)(?:\s+"[^"\n]*")?\)/g;

function inFence(content: string, offset: number): boolean {
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let fenced = false;

  for (const line of lines) {
    const end = cursor + line.length;
    const opensFence = FENCE.test(line);
    if (offset >= cursor && offset <= end + 1) {
      return fenced || opensFence;
    }
    if (opensFence) fenced = !fenced;
    cursor = end + 1;
  }
  return false;
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function hrefFor(url: string): string {
  return url.includes(')') ? `<${url}>` : url;
}

/** Wrap the selection (or the cursor) as `[text](url)`. Does not rewrite the rest of the note. */
export function wrapLinkPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (inFence(content, from) || inFence(content, to)) return null;

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

  const label = inner.replace(/]/g, '');
  if (!label) return null;
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
  if (inFence(content, from) || inFence(content, to)) return null;

  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  const nl = content.indexOf('\n', from);
  const line = content.slice(lineStart, nl === -1 ? content.length : nl);

  LINK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK.exec(line)) !== null) {
    if (match.index > 0 && line[match.index - 1] === '!') continue;
    const hitFrom = lineStart + match.index;
    const hitTo = hitFrom + match[0].length;
    if (from < hitFrom || to > hitTo) continue;
    const label = (match[1] ?? '').trim();
    const rawHref = (match[2] ?? '').trim();
    const href = rawHref.replace(/^<|>$/g, '').trim();
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
