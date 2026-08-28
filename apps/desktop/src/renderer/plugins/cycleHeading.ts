import type { PluginManifest } from '@dripnex/plugin-api';
import { FENCE, lineAtOffset } from './sourceScan';

const LIST = /^( {0,3})([-*+]|\d+[.)])(\s|$)/;
const HR = /^( {0,3})([-*_])(?:\s*\2){2,}\s*$/;
const SETEXT = /^( {0,3})(=+|-+)[ \t]*$/;
const TOO_MANY_HASHES = /^( {0,3}(?:> ?)* {0,3})#{7,}/;
const ATX = /^( {0,3}(?:> ?)* {0,3})(#{1,6})(?:[ \t]+(.*?)(?:[ \t]+#+)?)?[ \t]*$/;

/** Cycle ATX marks on one line. Lists, fences, setext, and `#######` stay put. */
export function cycleHeadingLine(line: string, nextLine?: string | null): string | null {
  if (FENCE.test(line) || LIST.test(line) || HR.test(line) || SETEXT.test(line)) return null;
  if (TOO_MANY_HASHES.test(line)) return null;
  if (nextLine != null && SETEXT.test(nextLine)) return null;
  if (/^ {4,}/.test(line) || /^\t/.test(line)) return null;

  const atx = line.match(ATX);
  if (atx) {
    const prefix = atx[1] ?? '';
    const level = (atx[2] ?? '#').length;
    const body = (atx[3] ?? '').trim();
    if (level >= 6) return `${prefix}${body}`;
    return `${prefix}${'#'.repeat(level + 1)}${body ? ` ${body}` : ' '}`;
  }

  const quote = line.match(/^( {0,3}(?:> ?)* {0,3})(.*)$/);
  const prefix = quote?.[1] ?? '';
  const rest = quote?.[2] ?? line;
  return `${prefix}#${rest ? ` ${rest}` : ' '}`;
}

/** Cycle the ATX heading on the line containing `offset`. */
export function cycleHeadingAtOffset(
  content: string,
  offset: number
): { from: number; to: number; text: string } | null {
  const here = lineAtOffset(content, offset);
  if (!here || here.inFence) return null;
  const text = cycleHeadingLine(here.line, here.next);
  if (text == null || text === here.line) return null;
  return { from: here.from, to: here.to, text };
}

export const cycleHeadingPlugin: PluginManifest = {
  id: 'dripnex-cycle-heading',
  name: 'Cycle Heading',
  version: '1.0.0',
  description: 'Cycle the ATX heading on the current line (# through ######, then off)',

  activate(context) {
    const cycle = () => {
      const { from } = context.editor.getSelection();
      const next = cycleHeadingAtOffset(context.editor.getContent(), from);
      if (!next) {
        context.log.info('Current line is not a heading candidate');
        return false;
      }
      context.editor.replaceRange(next.from, next.to, next.text);
      return true;
    };

    const unregister = context.registerCommand(
      {
        id: 'cycle',
        name: 'Cycle Heading',
        icon: 'Heading2',
        keybinding: { key: 'h', modifiers: ['Mod', 'Alt'] },
      },
      cycle
    );
    const removeMenu = context.menu.add({ label: 'Cycle Heading', click: cycle });

    return {
      dispose() {
        unregister();
        removeMenu();
      },
    };
  },
};
