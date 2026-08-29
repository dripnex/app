import type { PluginManifest } from '@dripnex/plugin-api';
import { walkSourceLines } from './sourceScan';

function fenceOpenHits(content: string): Array<{ from: number; to: number }> {
  return walkSourceLines(content)
    .filter(row => row.isFenceOpener)
    .map(row => ({ from: row.from, to: row.to }));
}

/** Next fence opener at or after offset, wrapping. Closers skipped. Does not rewrite. */
export function nextFenceRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = fenceOpenHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous fence opener at or before offset, wrapping. Closers skipped. Does not rewrite. */
export function previousFenceRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = fenceOpenHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpFencePlugin: PluginManifest = {
  id: 'dripnex-jump-fence',
  name: 'Jump Fence',
  version: '1.0.0',
  description: 'Jump to the next or previous code fence in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextFenceRange(content, from) : previousFenceRange(content, from);
      if (!target) {
        context.notifications.addInfo('No code fences');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Fence', icon: 'FileCode' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Fence', icon: 'FileCode' },
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
