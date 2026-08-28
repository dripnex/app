import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const WIKI = /\[\[([^[\]|#]{1,200})(?:#[^[\]|]{1,200})?(?:\|[^\]]{1,200})?\]\]/g;

export function unresolvedTargets(
  links: ReadonlyArray<{ targetTitle: string; resolved: boolean }>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (link.resolved) continue;
    const title = link.targetTitle.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

function danglingHits(
  content: string,
  titles: readonly string[]
): Array<{ from: number; to: number }> {
  const want = new Set(titles.map(t => t.toLowerCase()));
  if (want.size === 0) return [];

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
        if (!target || !want.has(target.toLowerCase())) continue;
        const from = cursor + match.index;
        hits.push({ from, to: from + match[0].length });
      }
    }
    if (opensFence) inFence = !inFence;
    cursor = cursor + line.length + 1;
  }
  return hits;
}

/** Next unresolved `[[target]]` at or after offset, wrapping. Does not rewrite the note. */
export function nextDanglingWikilink(
  content: string,
  titles: readonly string[],
  offset: number
): { from: number; to: number } | null {
  const hits = danglingHits(content, titles);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

export const danglingWikilinkPlugin: PluginManifest = {
  id: 'dripnex-dangling-wikilink',
  name: 'Dangling Wikilink',
  version: '1.0.0',
  description: 'Jump to the next wikilink in this note that does not resolve',

  activate(context) {
    const jump = async () => {
      const note = context.app.getCurrentNote();
      if (!note) {
        context.notifications.addInfo('Select a note');
        return false;
      }
      const titles = unresolvedTargets(await context.data.getOutgoingLinks(note.id));
      const target = nextDanglingWikilink(
        context.editor.getContent(),
        titles,
        context.editor.getSelection().from
      );
      if (!target) {
        context.notifications.addInfo('No dangling wikilinks');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'jump', name: 'Jump to Dangling Wikilink', icon: 'Link' },
      () => void jump()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
