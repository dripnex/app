import type { PluginManifest } from '@dripnex/plugin-api';
import { FENCE, walkSourceLines } from './sourceScan';
const HR = /^( {0,3})([-*_])(?:\s*\2){2,}\s*$/;
const SETEXT = /^( {0,3})(=+|-+)[ \t]*$/;
const ATX = /^( {0,3}(?:> ?)* {0,3})#{1,6}(?:[ \t]+|$)/;
const TABLE = /^( {0,3}(?:> ?)* {0,3})\|/;
const QUOTE = /^((?: {0,3}> ?)*)(.*)$/;
const OL = /^([ \t]*)(\d+[.)])[ \t]+(.*)$/;
const UL = /^([ \t]*)([-*+])[ \t]+(.*)$/;

function isListLine(line: string): boolean {
  if (FENCE.test(line) || HR.test(line) || SETEXT.test(line)) return false;
  if (ATX.test(line) || TABLE.test(line)) return false;
  const rest = line.match(QUOTE)?.[2] ?? line;
  return OL.test(rest) || UL.test(rest);
}

function listOpenHits(content: string): Array<{ from: number; to: number; blockEnd: number }> {
  const hits: Array<{ from: number; to: number; blockEnd: number }> = [];
  let open: { from: number; to: number; blockEnd: number } | null = null;

  for (const row of walkSourceLines(content)) {
    const isList = !row.inFence && isListLine(row.line);
    if (isList) {
      if (!open) {
        open = { from: row.from, to: row.to, blockEnd: row.to };
        hits.push(open);
      } else {
        open.blockEnd = row.to;
      }
    } else {
      open = null;
    }
  }
  return hits;
}

function hereList(
  hits: Array<{ from: number; to: number; blockEnd: number }>,
  offset: number
): { from: number; to: number; blockEnd: number } | undefined {
  return hits.find(h => offset >= h.from && offset <= h.blockEnd);
}

/** Next list opener at or after offset, wrapping. Body items, HRs, and fences skipped. Does not rewrite. */
export function nextListRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = listOpenHits(content);
  if (hits.length === 0) return null;
  const here = hereList(hits, offset);
  const after = here ? here.to : offset;
  const next = hits.find(h => h.from >= after) ?? hits[0];
  return next ? { from: next.from, to: next.to } : null;
}

/** Previous list opener at or before offset, wrapping. Body items, HRs, and fences skipped. Does not rewrite. */
export function previousListRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = listOpenHits(content);
  if (hits.length === 0) return null;
  const here = hereList(hits, offset);
  if (here && offset > here.to) return { from: here.from, to: here.to };
  const before = here ? here.from : offset;
  const prev = [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1];
  return prev ? { from: prev.from, to: prev.to } : null;
}

export const jumpListPlugin: PluginManifest = {
  id: 'dripnex-jump-list',
  name: 'Jump List',
  version: '1.0.0',
  description: 'Jump to the next or previous list in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextListRange(content, from) : previousListRange(content, from);
      if (!target) {
        context.notifications.addInfo('No lists');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next List', icon: 'List' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous List', icon: 'List' },
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
