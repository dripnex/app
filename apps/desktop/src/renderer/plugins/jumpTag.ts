import type { PluginManifest } from '@dripnex/plugin-api';
import { walkSourceLines } from './sourceScan';

const TAG = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]*)/g;

function maskInlineCode(line: string): string {
  return line.replace(/`[^`\n]+`/g, mark => ' '.repeat(mark.length));
}

function tagHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  for (const row of walkSourceLines(content)) {
    if (row.inFence) continue;
    const searchable = maskInlineCode(row.line);
    TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TAG.exec(searchable)) !== null) {
      const name = match[1];
      if (!name) continue;
      const hash = match[0].indexOf('#');
      if (hash < 0) continue;
      const from = row.from + match.index + hash;
      hits.push({ from, to: from + 1 + name.length });
    }
  }
  return hits;
}

/** Next `#tag` at or after offset, wrapping. Headings, fences, and inline code skipped. Does not rewrite. */
export function nextTagRange(content: string, offset: number): { from: number; to: number } | null {
  const hits = tagHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `#tag` at or before offset, wrapping. Headings, fences, and inline code skipped. Does not rewrite. */
export function previousTagRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = tagHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpTagPlugin: PluginManifest = {
  id: 'dripnex-jump-tag',
  name: 'Jump Tag',
  version: '1.0.0',
  description: 'Jump to the next or previous #tag in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextTagRange(content, from) : previousTagRange(content, from);
      if (!target) {
        context.notifications.addInfo('No tags');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Tag', icon: 'Hash' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Tag', icon: 'Hash' },
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
