import type { PluginManifest } from '@dripnex/plugin-api';

const MARKER = /\[\^(\d+)\]/g;
const TOKEN = /\[\^([^\s\]]+)\](:)?/g;
const FENCE = /^( {0,3})(`{3,}|~{3,})/;

export function nextFootnoteIndex(content: string): number {
  const nums: number[] = [];
  MARKER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKER.exec(content)) !== null) {
    const n = Number(match[1]);
    if (Number.isInteger(n) && n > 0) nums.push(n);
  }
  return (nums.length > 0 ? Math.max(...nums) : 0) + 1;
}

export function insertFootnotePlan(
  content: string,
  from: number,
  to: number
): { from: number; to: number; text: string; definition: string; index: number } {
  const index = nextFootnoteIndex(content);
  const selected = content.slice(from, to);
  return {
    from,
    to,
    text: `${selected}[^${index}]`,
    definition: `\n\n[^${index}]: `,
    index,
  };
}

export interface FootnoteHit {
  id: string;
  kind: 'ref' | 'def';
  from: number;
  to: number;
}

export function footnoteHits(content: string): FootnoteHit[] {
  const out: FootnoteHit[] = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(content)) !== null) {
    const id = match[1];
    if (!id) continue;
    out.push({
      id,
      kind: match[2] === ':' ? 'def' : 'ref',
      from: match.index,
      to: match.index + match[0].length,
    });
  }
  return out;
}

export function jumpFootnoteTarget(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = footnoteHits(content);
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  if (!here) return null;
  const want: FootnoteHit['kind'] = here.kind === 'ref' ? 'def' : 'ref';
  const target = hits.find(h => h.id === here.id && h.kind === want);
  return target ? { from: target.from, to: target.to } : null;
}

export function footnoteIdFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = href.match(/#(?:user-content-)?fn(?:ref)?-([^\s#]+)$/i);
  return match?.[1] ?? null;
}

export function jumpFootnoteById(
  content: string,
  id: string,
  prefer: 'def' | 'ref'
): { from: number; to: number } | null {
  const hits = footnoteHits(content).filter(h => h.id === id);
  const preferred = hits.find(h => h.kind === prefer);
  const hit = preferred ?? hits[0];
  return hit ? { from: hit.from, to: hit.to } : null;
}

function footnoteRefHits(content: string): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;

  for (const line of lines) {
    const opensFence = FENCE.test(line);
    if (!inFence && !opensFence) {
      TOKEN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TOKEN.exec(line)) !== null) {
        if (match[2] === ':') continue;
        const from = cursor + match.index;
        hits.push({ from, to: from + match[0].length });
      }
    }
    if (opensFence) inFence = !inFence;
    cursor = cursor + line.length + 1;
  }
  return hits;
}

/** Next `[^id]` at or after offset, wrapping. Fences and definitions skipped. Does not rewrite. */
export function nextFootnoteRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = footnoteRefHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous `[^id]` at or before offset, wrapping. Fences and definitions skipped. Does not rewrite. */
export function previousFootnoteRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = footnoteRefHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const footnotesPlugin: PluginManifest = {
  id: 'dripnex-footnotes',
  name: 'Footnotes',
  version: '1.0.0',
  description: 'Insert a GFM footnote and jump between marks, or to the next one',

  activate(context) {
    const insert = () => {
      const { from, to } = context.editor.getSelection();
      const content = context.editor.getContent();
      const plan = insertFootnotePlan(content, from, to);
      context.editor.replaceRange(plan.from, plan.to, plan.text);
      const next = context.editor.getContent();
      context.editor.replaceRange(next.length, next.length, plan.definition);
      context.editor.setSelection(next.length + plan.definition.length);
      return true;
    };

    const jump = () => {
      const { from } = context.editor.getSelection();
      const target = jumpFootnoteTarget(context.editor.getContent(), from);
      if (!target) {
        context.log.info('Cursor is not on a footnote');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const jumpAlong = (which: 'next' | 'previous') => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target =
        which === 'next' ? nextFootnoteRange(content, from) : previousFootnoteRange(content, from);
      if (!target) {
        context.notifications.addInfo('No footnotes');
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterInsert = context.registerCommand(
      { id: 'insert', name: 'Insert Footnote', icon: 'Hash' },
      insert
    );
    const unregisterJump = context.registerCommand(
      {
        id: 'jump',
        name: 'Jump to Footnote',
        icon: 'Hash',
        keybinding: { key: 'F12' },
      },
      jump
    );
    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Footnote', icon: 'Hash' },
      () => jumpAlong('next')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Footnote', icon: 'Hash' },
      () => jumpAlong('previous')
    );
    const removeMenu = context.menu.add({ label: 'Insert Footnote', click: insert });
    const unpreview = context.preview.on('a:click', detail => {
      const id = footnoteIdFromHref(detail.href);
      if (!id) return;
      const target = jumpFootnoteById(context.editor.getContent(), id, 'def');
      if (!target) return;
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return false;
    });

    return {
      dispose() {
        unregisterInsert();
        unregisterJump();
        unregisterNext();
        unregisterPrevious();
        removeMenu();
        unpreview();
      },
    };
  },
};
