import type { PluginManifest } from '@dripnex/plugin-api';
import { walkSourceLines } from './sourceScan';

const IMAGE = /!\[([^\]\n]{0,200})\]\((<[^>\n]+>|[^)\s]+)(?:\s+"[^"\n]*")?\)/g;

function imageHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  for (const row of walkSourceLines(content)) {
    if (row.inFence) continue;
    IMAGE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMAGE.exec(row.line)) !== null) {
      const from = row.from + match.index;
      hits.push({ from, to: from + match[0].length });
    }
  }
  return hits;
}

/** Next `![alt](url)` at or after offset, wrapping. Fences and links skipped. Does not rewrite. */
export function nextImageRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = imageHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `![alt](url)` at or before offset, wrapping. Fences and links skipped. Does not rewrite. */
export function previousImageRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = imageHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpImagePlugin: PluginManifest = {
  id: 'dripnex-jump-image',
  name: 'Jump Image',
  version: '1.0.0',
  description: 'Jump to the next or previous Markdown image in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextImageRange(content, from) : previousImageRange(content, from);
      if (!target) {
        context.notifications.addInfo('No images');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Image', icon: 'Image' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Image', icon: 'Image' },
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
