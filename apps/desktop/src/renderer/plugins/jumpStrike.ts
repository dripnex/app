import type { PluginManifest } from '@dripnex/plugin-api';
import { strikeHits } from './wrapStrike';

/** Next `~~text~~` at or after offset, wrapping. Fences and tilde runs skipped. Does not rewrite. */
export function nextStrikeRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = strikeHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `~~text~~` at or before offset, wrapping. Fences and tilde runs skipped. Does not rewrite. */
export function previousStrikeRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = strikeHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpStrikePlugin: PluginManifest = {
  id: 'dripnex-jump-strike',
  name: 'Jump Strikethrough',
  version: '1.0.0',
  description: 'Jump to the next or previous ~~strikethrough~~ in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextStrikeRange(content, from) : previousStrikeRange(content, from);
      if (!target) {
        context.notifications.addInfo('No strikethrough');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Strikethrough', icon: 'Strikethrough' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Strikethrough', icon: 'Strikethrough' },
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
