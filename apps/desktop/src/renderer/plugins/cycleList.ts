import type { PluginManifest } from '@dripnex/plugin-api';

const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const HR = /^( {0,3})([-*_])(?:\s*\2){2,}\s*$/;
const SETEXT = /^( {0,3})(=+|-+)[ \t]*$/;
const ATX = /^( {0,3}(?:> ?)* {0,3})#{1,6}(?:[ \t]+|$)/;
const TABLE = /^( {0,3}(?:> ?)* {0,3})\|/;
const QUOTE = /^((?: {0,3}> ?)*)(.*)$/;
const TASK = /^([ \t]*)([-*+]|\d+[.)])[ \t]+\[([ xX])\](?:[ \t]+|(?=$))(.*)$/;
const OL = /^([ \t]*)(\d+[.)])[ \t]+(.*)$/;
const UL = /^([ \t]*)([-*+])[ \t]+(.*)$/;

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

/** Bullet → numbered → task → unwrap. Headings, fences, setext, tables, and indented code stay put. */
export function cycleListLine(line: string, nextLine?: string | null): string | null {
  if (FENCE.test(line) || HR.test(line) || SETEXT.test(line)) return null;
  if (ATX.test(line) || TABLE.test(line)) return null;
  if (nextLine != null && SETEXT.test(nextLine)) return null;

  const quoted = line.match(QUOTE);
  const prefix = quoted?.[1] ?? '';
  const rest = quoted?.[2] ?? line;

  const task = rest.match(TASK);
  if (task) {
    const indent = task[1] ?? '';
    const body = (task[4] ?? '').trimEnd();
    return `${prefix}${indent}${body}`;
  }

  const ordered = rest.match(OL);
  if (ordered) {
    const indent = ordered[1] ?? '';
    const body = ordered[3] ?? '';
    return `${prefix}${indent}- [ ] ${body}`;
  }

  const bullet = rest.match(UL);
  if (bullet) {
    const indent = bullet[1] ?? '';
    const body = bullet[3] ?? '';
    return `${prefix}${indent}1. ${body}`;
  }

  if (/^[ \t]{4,}/.test(rest) || /^\t/.test(rest)) return null;
  if (rest.length === 0) return `${prefix}- `;
  return `${prefix}- ${rest}`;
}

/** Cycle the list mark on the line containing `offset`. */
export function cycleListAtOffset(
  content: string,
  offset: number
): { from: number; to: number; text: string } | null {
  const here = lineAtOffset(content, offset);
  if (!here || here.inFence) return null;
  const text = cycleListLine(here.line, here.next);
  if (text == null || text === here.line) return null;
  return { from: here.from, to: here.to, text };
}

export const cycleListPlugin: PluginManifest = {
  id: 'dripnex-cycle-list',
  name: 'Cycle List',
  version: '1.0.0',
  description: 'Cycle the list mark on the current line (bullet, numbered, task, then off)',

  activate(context) {
    const cycle = () => {
      const { from } = context.editor.getSelection();
      const next = cycleListAtOffset(context.editor.getContent(), from);
      if (!next) {
        context.log.info('Current line is not a list candidate');
        return false;
      }
      context.editor.replaceRange(next.from, next.to, next.text);
      return true;
    };

    const unregister = context.registerCommand(
      {
        id: 'cycle',
        name: 'Cycle List',
        icon: 'List',
        keybinding: { key: 'l', modifiers: ['Mod', 'Alt'] },
      },
      cycle
    );
    const removeMenu = context.menu.add({ label: 'Cycle List', click: cycle });

    return {
      dispose() {
        unregister();
        removeMenu();
      },
    };
  },
};
