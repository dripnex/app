import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const WIKI = /\[\[([^[\]|#]{1,200})((?:#[^[\]|]{1,200})?)(?:\|([^\]]{1,200}))?\]\]/g;

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

/** Wrap the selection (or the cursor) as `[[target]]`. Does not rewrite the rest of the note. */
export function wrapWikilinkPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (inFence(content, from) || inFence(content, to)) return null;

  const selected = content.slice(from, to);
  if (/\r|\n/.test(selected)) return null;

  const inner = selected.trim();
  if (!inner) {
    return { from, to, text: '[[]]', cursor: from + 2 };
  }
  if (/^\[\[[^[\]]*\]\]$/.test(inner)) return null;
  if (/\[\[|\]\]/.test(inner)) return null;

  const text = `[[${inner}]]`;
  return { from, to, text, cursor: from + text.length };
}

/** Unwrap the `[[target]]` under the cursor. Alias wins; fences and embeds skipped. Does not rewrite the rest of the note. */
export function unwrapWikilinkPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (from > to) return null;
  if (inFence(content, from) || inFence(content, to)) return null;

  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  const nl = content.indexOf('\n', from);
  const line = content.slice(lineStart, nl === -1 ? content.length : nl);

  WIKI.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKI.exec(line)) !== null) {
    if (match.index > 0 && line[match.index - 1] === '!') continue;
    const target = (match[1] ?? '').trim();
    if (!target) continue;
    const heading = match[2] ?? '';
    const alias = (match[3] ?? '').trim();
    const hitFrom = lineStart + match.index;
    const hitTo = hitFrom + match[0].length;
    if (from < hitFrom || to > hitTo) continue;
    const text = alias || `${target}${heading}`;
    return { from: hitFrom, to: hitTo, text, cursor: hitFrom + text.length };
  }
  return null;
}

export const wrapWikilinkPlugin: PluginManifest = {
  id: 'dripnex-wrap-wikilink',
  name: 'Wrap Wikilink',
  version: '1.0.0',
  description: 'Wrap the selection as a wikilink, or unwrap the mark under the cursor',

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
        wrapWikilinkPlan(context.editor.getContent(), from, to),
        'Selection is not a wikilink candidate'
      );
    };

    const unwrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(
        unwrapWikilinkPlan(context.editor.getContent(), from, to),
        'Cursor is not on a wikilink'
      );
    };

    const unregisterWrap = context.registerCommand(
      { id: 'wrap', name: 'Wrap as Wikilink', icon: 'Link' },
      wrap
    );
    const unregisterUnwrap = context.registerCommand(
      { id: 'unwrap', name: 'Unwrap Wikilink', icon: 'Link' },
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
