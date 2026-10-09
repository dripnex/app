import type { PluginManifest } from '@dripnex/plugin-api';
import { walkSourceLines } from './sourceScan';

function isDelimiterRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = inner.split('|');
  return cells.length > 0 && cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function isTableRow(line: string): boolean {
  return line.includes('|');
}

function tableOpenHits(content: string): Array<{ from: number; to: number; blockEnd: number }> {
  const hits: Array<{ from: number; to: number; blockEnd: number }> = [];
  const rows = walkSourceLines(content);
  let open: { from: number; to: number; blockEnd: number } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const next = rows[i + 1];
    if (row.inFence) {
      open = null;
      continue;
    }
    const starts =
      isTableRow(row.line) && next != null && !next.inFence && isDelimiterRow(next.line);
    const continues = open && isTableRow(row.line);
    if (starts) {
      open = { from: row.from, to: row.to, blockEnd: next!.to };
      hits.push(open);
      continue;
    }
    if (continues && open) {
      open.blockEnd = row.to;
      continue;
    }
    open = null;
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
