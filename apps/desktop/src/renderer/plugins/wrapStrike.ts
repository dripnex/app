import type { PluginManifest } from '@dripnex/plugin-api';
import { offsetInFence, walkSourceLines } from './sourceScan';
const STRIKE = /~~([^~\n]+)~~/g;

function strikeHitsOnLine(line: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  STRIKE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STRIKE.exec(line)) !== null) {
    if (match.index > 0 && line[match.index - 1] === '~') continue;
    const after = match.index + match[0].length;
    if (after < line.length && line[after] === '~') continue;
    const inner = (match[1] ?? '').trim();
    if (!inner) continue;
    hits.push({ from: match.index, to: match.index + match[0].length });
  }
  return hits;
}

/** `~~text~~` ranges outside fences. Tilde runs skipped. Does not rewrite. */
export function strikeHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  for (const row of walkSourceLines(content)) {
    if (row.inFence) continue;
    for (const hit of strikeHitsOnLine(row.line)) {
      hits.push({ from: row.from + hit.from, to: row.from + hit.to });
    }
  }
  return hits;
}

/** Wrap the selection (or the cursor) as `~~text~~`. Fences and existing marks skipped. Does not rewrite the rest of the note. */
export function wrapStrikePlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const selected = content.slice(from, to);
  if (/\r|\n/.test(selected)) return null;

  const inner = selected.trim();
  if (inner.includes('~~')) return null;

  if (!inner) {
    return { from, to, text: '~~~~', cursor: from + 2 };
  }

  const text = `~~${inner}~~`;
  return { from, to, text, cursor: from + text.length };
}

/** Unwrap the `~~text~~` under the cursor. Fences and tilde runs skipped. Does not rewrite the rest of the note. */
export function unwrapStrikePlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (from > to) return null;
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  const nl = content.indexOf('\n', from);
  const line = content.slice(lineStart, nl === -1 ? content.length : nl);

  for (const hit of strikeHitsOnLine(line)) {
    const hitFrom = lineStart + hit.from;
    const hitTo = lineStart + hit.to;
    if (from < hitFrom || to > hitTo) continue;
    const text = content.slice(hitFrom + 2, hitTo - 2).trim();
    if (!text) continue;
    return { from: hitFrom, to: hitTo, text, cursor: hitFrom + text.length };
  }
  return null;
}

export const wrapStrikePlugin: PluginManifest = {
  id: 'dripnex-wrap-strike',
  name: 'Wrap Strikethrough',
  version: '1.0.0',
  description: 'Wrap the selection as ~~strikethrough~~, or unwrap the mark under the cursor',

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
        wrapStrikePlan(context.editor.getContent(), from, to),
        'Selection is not a strikethrough candidate'
      );
    };

    const unwrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(
        unwrapStrikePlan(context.editor.getContent(), from, to),
        'Cursor is not on strikethrough'
      );
    };

    const unregisterWrap = context.registerCommand(
      { id: 'wrap', name: 'Wrap as Strikethrough', icon: 'Strikethrough' },
      wrap
    );
    const unregisterUnwrap = context.registerCommand(
      { id: 'unwrap', name: 'Unwrap Strikethrough', icon: 'Strikethrough' },
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
