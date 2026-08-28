import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const ATX = /^( {0,3}(?:> ?)* {0,3})(#{1,6})(?:[ \t]+|(?=$))/;

function headingHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    if (!inFence && !opensFence && ATX.test(line) && !/^ {4,}/.test(line) && !/^\t/.test(line)) {
      hits.push({ from: cursor, to: cursor + line.length });
    }
    if (opensFence) inFence = !inFence;
    cursor = cursor + line.length + 1;
  }
  return hits;
}

/** Next ATX heading at or after offset, wrapping. Fences skipped. Does not rewrite. */
export function nextHeadingRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = headingHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous ATX heading at or before offset, wrapping. Fences skipped. Does not rewrite. */
export function previousHeadingRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = headingHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpHeadingPlugin: PluginManifest = {
  id: 'dripnex-jump-heading',
  name: 'Jump Heading',
  version: '1.0.0',
  description: 'Jump to the next or previous ATX heading in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextHeadingRange(content, from) : previousHeadingRange(content, from);
      if (!target) {
        context.notifications.addInfo('No headings');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Heading', icon: 'Heading2' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Heading', icon: 'Heading2' },
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
