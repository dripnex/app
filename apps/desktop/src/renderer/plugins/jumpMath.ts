import type { PluginManifest } from '@dripnex/plugin-api';
import { mathHits } from './wrapMath';

/** Next `$math$` / `$$math$$` at or after offset, wrapping. Fences and spaced dollars skipped. Does not rewrite. */
export function nextMathRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = mathHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `$math$` / `$$math$$` at or before offset, wrapping. Fences and spaced dollars skipped. Does not rewrite. */
export function previousMathRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = mathHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpMathPlugin: PluginManifest = {
  id: 'dripnex-jump-math',
  name: 'Jump Math',
  version: '1.0.0',
  description: 'Jump to the next or previous $math$ mark in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextMathRange(content, from) : previousMathRange(content, from);
      if (!target) {
        context.notifications.addInfo('No math');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Math', icon: 'FileCode' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Math', icon: 'FileCode' },
      () => jump('previous')
    );

    return {
      dispose() {
        unregisterNext();
        unregisterPrevious();
      },
    };
  },
};
