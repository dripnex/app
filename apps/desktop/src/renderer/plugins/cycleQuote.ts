import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const SETEXT = /^( {0,3})(=+|-+)[ \t]*$/;
const QUOTE = /^((?: {0,3}> ?)*)(.*)$/;
const MAX_LEVEL = 3;

function lineAtOffset(
  content: string,
  offset: number
): { line: string; from: number; to: number; inFence: boolean; next: string | null } | null {
  const lines = content.split(/\r?\n/);
  let cursor = 0;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const end = cursor + line.length;
    const opensFence = FENCE.test(line);
    if (offset >= cursor && offset <= end + 1) {
      return {
        line,
        from: cursor,
        to: end,
        inFence: inFence || opensFence,
        next: lines[i + 1] ?? null,
      };
    }
    if (opensFence) inFence = !inFence;
    cursor = end + 1;
  }
  return null;
}

/** `>` → `> >` → unwrap at 3. Fences, setext, and indented code stay put. */
export function cycleQuoteLine(line: string, nextLine?: string | null): string | null {
  if (FENCE.test(line) || SETEXT.test(line)) return null;
  if (nextLine != null && SETEXT.test(nextLine)) return null;
  if (/^[ \t]{4,}/.test(line) || /^\t/.test(line)) return null;

  const quoted = line.match(QUOTE);
  const prefix = quoted?.[1] ?? '';
  const rest = quoted?.[2] ?? line;
  const level = prefix.replace(/[^>]/g, '').length;

  if (level >= MAX_LEVEL) return rest;
  if (level === 0) return rest ? `> ${rest}` : '> ';
  return `${prefix}> ${rest}`;
}

/** Cycle the blockquote mark on the line containing `offset`. */
export function cycleQuoteAtOffset(
  content: string,
  offset: number
): { from: number; to: number; text: string } | null {
  const here = lineAtOffset(content, offset);
  if (!here || here.inFence) return null;
  const text = cycleQuoteLine(here.line, here.next);
  if (text == null || text === here.line) return null;
  return { from: here.from, to: here.to, text };
}

export const cycleQuotePlugin: PluginManifest = {
  id: 'dripnex-cycle-quote',
  name: 'Cycle Quote',
  version: '1.0.0',
  description: 'Cycle the blockquote mark on the current line (> through nested, then off)',

  activate(context) {
    const cycle = () => {
      const { from } = context.editor.getSelection();
      const next = cycleQuoteAtOffset(context.editor.getContent(), from);
      if (!next) {
        context.log.info('Current line is not a quote candidate');
        return false;
      }
      context.editor.replaceRange(next.from, next.to, next.text);
      return true;
    };

    const unregister = context.registerCommand(
      {
        id: 'cycle',
        name: 'Cycle Quote',
        icon: 'Quote',
        keybinding: { key: 'q', modifiers: ['Mod', 'Alt'] },
      },
      cycle
    );
    const removeMenu = context.menu.add({ label: 'Cycle Quote', click: cycle });

    return {
      dispose() {
        unregister();
        removeMenu();
      },
    };
  },
};
