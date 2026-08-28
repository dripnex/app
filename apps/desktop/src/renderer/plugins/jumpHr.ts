import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const HR = /^( {0,3})([-*_])(?:\s*\2){2,}\s*$/;
const SETEXT = /^( {0,3})(=+|-+)[ \t]*$/;

function hrHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;
  let prev: string | null = null;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    const end = cursor + line.length;
    const setext =
      SETEXT.test(line) &&
      prev != null &&
      prev.trim().length > 0 &&
      !HR.test(prev) &&
      !FENCE.test(prev);
    if (!inFence && !opensFence && HR.test(line) && !setext) {
      hits.push({ from: cursor, to: end });
    }
    if (opensFence) inFence = !inFence;
    prev = line;
    cursor = end + 1;
  }
  return hits;
}

/** Next thematic break at or after offset, wrapping. Setext underlines and fences skipped. Does not rewrite. */
export function nextHrRange(content: string, offset: number): { from: number; to: number } | null {
  const hits = hrHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous thematic break at or before offset, wrapping. Setext underlines and fences skipped. Does not rewrite. */
export function previousHrRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = hrHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpHrPlugin: PluginManifest = {
  id: 'dripnex-jump-hr',
  name: 'Jump Horizontal Rule',
  version: '1.0.0',
  description: 'Jump to the next or previous horizontal rule in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target = which === 'next' ? nextHrRange(content, from) : previousHrRange(content, from);
      if (!target) {
        context.notifications.addInfo('No horizontal rules');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Horizontal Rule', icon: 'Minus' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Horizontal Rule', icon: 'Minus' },
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
