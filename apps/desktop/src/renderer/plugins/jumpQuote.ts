import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const QUOTE = /^( {0,3}> ?)/;
const ALERT = /^( {0,3}> ?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*)(.*)$/i;

function quoteOpenHits(content: string): Array<{ from: number; to: number; blockEnd: number }> {
  const hits: Array<{ from: number; to: number; blockEnd: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;
  let inQuote = false;
  let open: { from: number; to: number; blockEnd: number } | null = null;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    const end = cursor + line.length;
    const isQuote = !inFence && !opensFence && QUOTE.test(line);

    if (isQuote) {
      if (!inQuote) {
        inQuote = true;
        if (ALERT.test(line)) {
          open = null;
        } else {
          open = { from: cursor, to: end, blockEnd: end };
          hits.push(open);
        }
      } else if (open) {
        open.blockEnd = end;
      }
    } else {
      inQuote = false;
      open = null;
    }

    if (opensFence) inFence = !inFence;
    cursor = end + 1;
  }
  return hits;
}

function hereQuote(
  hits: Array<{ from: number; to: number; blockEnd: number }>,
  offset: number
): { from: number; to: number; blockEnd: number } | undefined {
  return hits.find(h => offset >= h.from && offset <= h.blockEnd);
}

/** Next `>` opener at or after offset, wrapping. Bodies, alerts, and fences skipped. Does not rewrite. */
export function nextQuoteRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = quoteOpenHits(content);
  if (hits.length === 0) return null;
  const here = hereQuote(hits, offset);
  const after = here ? here.to : offset;
  const next = hits.find(h => h.from >= after) ?? hits[0];
  return next ? { from: next.from, to: next.to } : null;
}

/** Previous quote opener at or before offset, wrapping. Bodies, alerts, and fences skipped. Does not rewrite. */
export function previousQuoteRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = quoteOpenHits(content);
  if (hits.length === 0) return null;
  const here = hereQuote(hits, offset);
  if (here && offset > here.to) return { from: here.from, to: here.to };
  const before = here ? here.from : offset;
  const prev = [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1];
  return prev ? { from: prev.from, to: prev.to } : null;
}

export const jumpQuotePlugin: PluginManifest = {
  id: 'dripnex-jump-quote',
  name: 'Jump Quote',
  version: '1.0.0',
  description: 'Jump to the next or previous blockquote in the current note',

  activate(context) {
    const jump = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextQuoteRange(content, from) : previousQuoteRange(content, from);
      if (!target) {
        context.notifications.addInfo('No quotes');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Quote', icon: 'Quote' },
      () => jump('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Quote', icon: 'Quote' },
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
