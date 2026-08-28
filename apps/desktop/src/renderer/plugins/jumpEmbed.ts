import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const EMBED = /!\[\[([^[\]|#]{1,200})((?:#[^[\]|]{1,200})?)(?:\|([^\]]{1,200}))?\]\]/g;

function embedHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    if (!inFence && !opensFence) {
      EMBED.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = EMBED.exec(line)) !== null) {
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

/** Next `![[target]]` at or after offset, wrapping. Fences, images, and wikilinks skipped. Does not rewrite. */
export function nextEmbedRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = embedHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `![[target]]` at or before offset, wrapping. Fences, images, and wikilinks skipped. Does not rewrite. */
export function previousEmbedRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = embedHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpEmbedPlugin: PluginManifest = {
  id: 'dripnex-jump-embed',
  name: 'Jump Embed',
  version: '1.0.0',
  description: 'Jump to the next or previous ![[embed]] in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextEmbedRange(content, from) : previousEmbedRange(content, from);
      if (!target) {
        context.notifications.addInfo('No embeds');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Embed', icon: 'FileText' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Embed', icon: 'FileText' },
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
