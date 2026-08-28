import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const WIKI = /\[\[([^[\]|#]{1,200})(?:#[^[\]|]{1,200})?(?:\|[^\]]{1,200})?\]\]/g;

function wikilinkHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    if (!inFence && !opensFence) {
      WIKI.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = WIKI.exec(line)) !== null) {
        if (match.index > 0 && line[match.index - 1] === '!') continue;
        const target = (match[1] ?? '').trim();
        if (!target) continue;
        const from = cursor + match.index;
        hits.push({ from, to: from + match[0].length });
      }
    }
    if (opensFence) inFence = !inFence;
    cursor = cursor + line.length + 1;
  }
  return hits;
}

/** Next `[[target]]` at or after offset, wrapping. Fences and embeds skipped. Does not rewrite. */
export function nextWikilinkRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = wikilinkHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `[[target]]` at or before offset, wrapping. Fences and embeds skipped. Does not rewrite. */
export function previousWikilinkRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = wikilinkHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpWikilinkPlugin: PluginManifest = {
  id: 'dripnex-jump-wikilink',
  name: 'Jump Wikilink',
  version: '1.0.0',
  description: 'Jump to the next or previous wikilink in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextWikilinkRange(content, from) : previousWikilinkRange(content, from);
      if (!target) {
        context.notifications.addInfo('No wikilinks');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Wikilink', icon: 'Link' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Wikilink', icon: 'Link' },
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
