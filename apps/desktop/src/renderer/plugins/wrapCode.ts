import type { PluginManifest } from '@dripnex/plugin-api';
import { inlineCodeSpans, offsetInFence } from './sourceScan';

/** Wrap the selection (or the cursor) as `` `code` ``. Does not rewrite the rest of the note. */
export function wrapCodePlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const selected = content.slice(from, to);
  if (/\r|\n/.test(selected)) return null;

  const inner = selected.trim();
  if (inner.includes('`')) return null;

  if (!inner) {
    return { from, to, text: '``', cursor: from + 1 };
  }

  const text = `\`${inner}\``;
  return { from, to, text, cursor: from + text.length };
}

/** Unwrap the `` `code` `` under the cursor. Fences skipped. Does not rewrite the rest of the note. */
export function unwrapCodePlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; cursor: number } | null {
  if (from > to) return null;
  if (offsetInFence(content, from) || offsetInFence(content, to)) return null;

  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  const nl = content.indexOf('\n', from);
  const line = content.slice(lineStart, nl === -1 ? content.length : nl);

  for (const span of inlineCodeSpans(line)) {
    const hitFrom = lineStart + span.from;
    const hitTo = lineStart + span.to;
    if (from < hitFrom || to > hitTo) continue;
    const text = line.slice(span.innerFrom, span.innerTo).trim();
    if (!text) continue;
    return { from: hitFrom, to: hitTo, text, cursor: hitFrom + text.length };
  }
  return null;
}

export const wrapCodePlugin: PluginManifest = {
  id: 'dripnex-wrap-code',
  name: 'Wrap Code',
  version: '1.0.0',
  description: 'Wrap the selection as inline code, or unwrap the mark under the cursor',

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
        wrapCodePlan(context.editor.getContent(), from, to),
        'Selection is not a code candidate'
      );
    };

    const unwrap = () => {
      const { from, to } = context.editor.getSelection();
      return apply(
        unwrapCodePlan(context.editor.getContent(), from, to),
        'Cursor is not on inline code'
      );
    };

    const unregisterWrap = context.registerCommand(
      { id: 'wrap', name: 'Wrap as Code', icon: 'Code' },
      wrap
    );
    const unregisterUnwrap = context.registerCommand(
      { id: 'unwrap', name: 'Unwrap Code', icon: 'Code' },
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
