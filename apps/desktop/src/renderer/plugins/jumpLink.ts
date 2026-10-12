import type { PluginManifest } from '@dripnex/plugin-api';
import { walkSourceLines } from './sourceScan';

const LINK = /\[([^\]\n]{1,200})\]\((<[^>\n]+>|[^)\s]+)(?:\s+"[^"\n]*")?\)/g;

function linkHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  for (const row of walkSourceLines(content)) {
    if (row.inFence) continue;
    LINK.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK.exec(row.line)) !== null) {
      if (match.index > 0 && row.line[match.index - 1] === '!') continue;
      const from = row.from + match.index;
      hits.push({ from, to: from + match[0].length });
    }
  }
  return hits;
}

/** Next `[text](url)` at or after offset, wrapping. Fences and images skipped. Does not rewrite. */
export function nextLinkRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = linkHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `[text](url)` at or before offset, wrapping. Fences and images skipped. Does not rewrite. */
export function previousLinkRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = linkHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpLinkPlugin: PluginManifest = {
  id: 'dripnex-jump-link',
  name: 'Jump Link',
  version: '1.0.0',
  description: 'Jump to the next or previous Markdown link in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextLinkRange(content, from) : previousLinkRange(content, from);
      if (!target) {
        context.notifications.addInfo('No links');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Link', icon: 'Link' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Link', icon: 'Link' },
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
