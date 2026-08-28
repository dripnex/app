import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const DISPLAY = /\$\$([^$\n]+)\$\$/g;

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

function covered(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some(r => from < r.to && to > r.from);
}

function mathHitsOnLine(line: string): Array<{ from: number; to: number; inner: string }> {
  const hits: Array<{ from: number; to: number; inner: string }> = [];
  DISPLAY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DISPLAY.exec(line)) !== null) {
    const inner = (match[1] ?? '').trim();
    if (!inner) continue;
    hits.push({ from: match.index, to: match.index + match[0].length, inner });
  }

  let i = 0;
  while (i < line.length) {
    if (covered(i, i + 1, hits)) {
      i += 1;
      continue;
    }
    if (line[i] !== '$' || line[i - 1] === '\\' || line[i + 1] === '$') {
      i += 1;
      continue;
    }
    let close = -1;
    for (let j = i + 1; j < line.length; j++) {
      if (covered(j, j + 1, hits)) break;
      if (line[j] !== '$' || line[j - 1] === '\\' || line[j + 1] === '$') continue;
      close = j;
      break;
    }
    if (close < 0) {
      i += 1;
      continue;
    }
    const inner = line.slice(i + 1, close);
    if (!inner || inner.startsWith(' ') || inner.endsWith(' ')) {
      i += 1;
      continue;
    }
    hits.push({ from: i, to: close + 1, inner: inner.trim() });
    i = close + 1;
  }
  hits.sort((a, b) => a.from - b.from);
  return hits;
}

/** `$math$` / `$$math$$` ranges outside fences. Spaced dollars skipped. Does not rewrite. */
export function mathHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    if (!inFence && !opensFence) {
      for (const hit of mathHitsOnLine(line)) {
        hits.push({ from: cursor + hit.from, to: cursor + hit.to });
      }
    }
    if (opensFence) inFence = !inFence;
    cursor = cursor + line.length + 1;
  }
  return hits;
}

/** Wrap the selection (or the cursor) as `$math$`. Fences and existing marks skipped. Does not rewrite the rest of the note. */
export function wrapMathPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (inFence(content, from) || inFence(content, to)) return null;

  const selected = content.slice(from, to);
  if (/\r|\n/.test(selected)) return null;

  const inner = selected.trim();
  if (inner.includes('$')) return null;

  if (!inner) {
    return { from, to, text: '$$', cursor: from + 1 };
  }

  const text = `$${inner}$`;
  return { from, to, text, cursor: from + text.length };
}

/** Unwrap `$math$` or `$$math$$` under the cursor. Fences skipped. Does not rewrite the rest of the note. */
export function unwrapMathPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (from > to) return null;
  if (inFence(content, from) || inFence(content, to)) return null;

  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  const nl = content.indexOf('\n', from);
  const line = content.slice(lineStart, nl === -1 ? content.length : nl);

  for (const hit of mathHitsOnLine(line)) {
    const hitFrom = lineStart + hit.from;
    const hitTo = lineStart + hit.to;
    if (from < hitFrom || to > hitTo) continue;
    if (!hit.inner) continue;
    return { from: hitFrom, to: hitTo, text: hit.inner, cursor: hitFrom + hit.inner.length };
  }
  return null;
}

export const wrapMathPlugin: PluginManifest = {
  id: 'dripnex-wrap-math',
  name: 'Wrap Math',
  version: '1.0.0',
  description: 'Wrap the selection as $math$, or unwrap the mark under the cursor',

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
        wrapMathPlan(context.editor.getContent(), from, to),
        'Selection is not a math candidate'
      );
    };

    const unwrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(unwrapMathPlan(context.editor.getContent(), from, to), 'Cursor is not on math');
    };

    const unregisterWrap = context.registerCommand(
      { id: 'wrap', name: 'Wrap as Math', icon: 'FileCode' },
      wrap
    );
    const unregisterUnwrap = context.registerCommand(
      { id: 'unwrap', name: 'Unwrap Math', icon: 'FileCode' },
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
