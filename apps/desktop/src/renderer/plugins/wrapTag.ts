import type { PluginManifest } from '@dripnex/plugin-api';
import { maskInlineCode, offsetInFence, walkSourceLines } from './sourceScan';

const TAG = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]*)/g;
const NAME = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

function isBoundary(ch: string | undefined): boolean {
  return !ch || /[\s]/.test(ch);
}

/** Wrap the selection (or the cursor) as `#tag`. Letter-first; fences and existing marks skipped. Does not rewrite the rest of the note. */
export function wrapTagPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const selected = content.slice(from, to);
  if (/\r|\n/.test(selected)) return null;
  if (!isBoundary(content[from - 1]) || !isBoundary(content[to])) return null;

  const inner = selected.trim();
  if (/^#[a-zA-Z][a-zA-Z0-9_-]*$/.test(inner)) return null;

  if (!inner) {
    return { from, to, text: '#', cursor: from + 1 };
  }
  if (!NAME.test(inner)) return null;

  const text = `#${inner}`;
  return { from, to, text, cursor: from + text.length };
}

/** Unwrap the `#tag` under the cursor. Fences, headings, and inline code skipped. Does not rewrite the rest of the note. */
export function unwrapTagPlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (from > to) return null;
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const searchable = maskInlineCode(content);

  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(searchable)) !== null) {
    const name = match[1];
    if (!name) continue;
    const hash = match[0].indexOf('#');
    if (hash < 0) continue;
    const hitFrom = match.index + hash;
    const hitTo = hitFrom + 1 + name.length;
    if (from < hitFrom || to > hitTo) continue;
    return { from: hitFrom, to: hitTo, text: name, cursor: hitFrom + name.length };
  }
  return null;
}

/** Drop every `#tag` in source (fences and inline code skipped). Chip remove uses this. */
export function stripHashTag(content: string, tag: string): string {
  const needle = tag.trim().toLowerCase().replace(/^#/, '');
  if (!needle) return content;

  const cuts: Array<{ from: number; to: number }> = [];
  for (const row of walkSourceLines(content)) {
    if (row.inFence) continue;
    const masked = maskInlineCode(row.line);
    TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TAG.exec(masked)) !== null) {
      const name = match[1];
      if (!name || name.toLowerCase() !== needle) continue;
      const hash = match[0].indexOf('#');
      if (hash < 0) continue;
      const from = row.from + match.index + hash;
      let to = from + 1 + name.length;
      if (content[to] === ' ' || content[to] === '\t') to += 1;
      cuts.push({ from, to });
    }
  }

  let result = content;
  for (let i = cuts.length - 1; i >= 0; i--) {
    const cut = cuts[i];
    if (!cut) continue;
    result = result.slice(0, cut.from) + result.slice(cut.to);
  }
  return result;
}

export const wrapTagPlugin: PluginManifest = {
  id: 'dripnex-wrap-tag',
  name: 'Wrap Tag',
  version: '1.0.0',
  description: 'Wrap the selection as a #tag, or unwrap the mark under the cursor',

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
        wrapTagPlan(context.editor.getContent(), from, to),
        'Selection is not a tag candidate'
      );
    };

    const unwrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(unwrapTagPlan(context.editor.getContent(), from, to), 'Cursor is not on a tag');
    };

    const unregisterWrap = context.registerCommand(
      { id: 'wrap', name: 'Wrap as Tag', icon: 'Hash' },
      wrap
    );
    const unregisterUnwrap = context.registerCommand(
      { id: 'unwrap', name: 'Unwrap Tag', icon: 'Hash' },
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
