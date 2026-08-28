import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)(\?[^\s]*)?$/i;
const IMAGE = /!\[([^\]\n]{0,200})\]\((<[^>\n]+>|[^)\s]*)(?:\s+"[^"\n]*")?\)/g;

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
  if (/^https?:\/\/\S+$/i.test(value)) return true;
  if (!/\s/.test(value) && IMAGE_EXT.test(value)) return true;
  return false;
}

function hrefFor(url: string): string {
  return url.includes(')') ? `<${url}>` : url;
}

/** Wrap the selection (or the cursor) as `![alt](url)`. Does not rewrite the rest of the note. */
export function wrapImagePlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (inFence(content, from) || inFence(content, to)) return null;

  const selected = content.slice(from, to);
  if (/\r|\n/.test(selected)) return null;

  const inner = selected.trim();
  if (/^!\[[^\]]*\]\([^)]*\)$/.test(inner)) return null;
  if (/!\[[^\]]*\]\(/.test(inner)) return null;

  if (!inner) {
    return { from, to, text: '![]()', cursor: from + 2 };
  }
  if (looksLikeUrl(inner)) {
    const href = hrefFor(inner);
    const text = `![](${href})`;
    return { from, to, text, cursor: from + text.length };
  }

  const alt = inner.replace(/]/g, '');
  if (!alt) return null;
  const text = `![${alt}]()`;
  return { from, to, text, cursor: from + text.length - 1 };
}

/** Unwrap the `![alt](url)` under the cursor. Alt wins; fences skipped. Does not rewrite the rest of the note. */
export function unwrapImagePlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (from > to) return null;
  if (inFence(content, from) || inFence(content, to)) return null;

  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  const nl = content.indexOf('\n', from);
  const line = content.slice(lineStart, nl === -1 ? content.length : nl);

  IMAGE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMAGE.exec(line)) !== null) {
    const hitFrom = lineStart + match.index;
    const hitTo = hitFrom + match[0].length;
    if (from < hitFrom || to > hitTo) continue;
    const alt = (match[1] ?? '').trim();
    const rawHref = (match[2] ?? '').trim();
    const href = rawHref.replace(/^<|>$/g, '').trim();
    const text = alt || href;
    if (!text) continue;
    return { from: hitFrom, to: hitTo, text, cursor: hitFrom + text.length };
  }
  return null;
}

export const wrapImagePlugin: PluginManifest = {
  id: 'dripnex-wrap-image',
  name: 'Wrap Image',
  version: '1.0.0',
  description: 'Wrap the selection as a Markdown image, or unwrap the mark under the cursor',

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
        wrapImagePlan(context.editor.getContent(), from, to),
        'Selection is not an image candidate'
      );
    };

    const unwrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(
        unwrapImagePlan(context.editor.getContent(), from, to),
        'Cursor is not on an image'
      );
    };

    const unregisterWrap = context.registerCommand(
      { id: 'wrap', name: 'Wrap as Image', icon: 'Image' },
      wrap
    );
    const unregisterUnwrap = context.registerCommand(
      { id: 'unwrap', name: 'Unwrap Image', icon: 'Image' },
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
