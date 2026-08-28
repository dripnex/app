import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const TABLE = /^( {0,3}(?:> ?)* {0,3})\|/;

function tableOpenHits(content: string): Array<{ from: number; to: number; blockEnd: number }> {
  const hits: Array<{ from: number; to: number; blockEnd: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;
  let open: { from: number; to: number; blockEnd: number } | null = null;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    const end = cursor + line.length;
    const isTable = !inFence && !opensFence && TABLE.test(line);

    if (isTable) {
      if (!open) {
        open = { from: cursor, to: end, blockEnd: end };
        hits.push(open);
      } else {
        open.blockEnd = end;
      }
    } else {
      open = null;
    }

    if (opensFence) inFence = !inFence;
    cursor = end + 1;
  }
  return hits;
}

function hereTable(
  hits: Array<{ from: number; to: number; blockEnd: number }>,
  offset: number
): { from: number; to: number; blockEnd: number } | undefined {
  return hits.find(h => offset >= h.from && offset <= h.blockEnd);
}

/** Next GFM table opener at or after offset, wrapping. Body rows and fences skipped. Does not rewrite. */
export function nextTableRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = tableOpenHits(content);
  if (hits.length === 0) return null;
  const here = hereTable(hits, offset);
  const after = here ? here.to : offset;
  const next = hits.find(h => h.from >= after) ?? hits[0];
  return next ? { from: next.from, to: next.to } : null;
}

/** Previous GFM table opener at or before offset, wrapping. Body rows and fences skipped. Does not rewrite. */
export function previousTableRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = tableOpenHits(content);
  if (hits.length === 0) return null;
  const here = hereTable(hits, offset);
  if (here && offset > here.to) return { from: here.from, to: here.to };
  const before = here ? here.from : offset;
  const prev = [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1];
  return prev ? { from: prev.from, to: prev.to } : null;
}

export const jumpTablePlugin: PluginManifest = {
  id: 'dripnex-jump-table',
  name: 'Jump Table',
  version: '1.0.0',
  description: 'Jump to the next or previous GFM table in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextTableRange(content, from) : previousTableRange(content, from);
      if (!target) {
        context.notifications.addInfo('No tables');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Table', icon: 'Table' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Table', icon: 'Table' },
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
