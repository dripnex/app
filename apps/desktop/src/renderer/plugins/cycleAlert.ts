import type { PluginManifest } from '@dripnex/plugin-api';
import { FENCE, lineAtOffset } from './sourceScan';

const SETEXT = /^( {0,3})(=+|-+)[ \t]*$/;
const QUOTE = /^((?: {0,3}> ?)*)(.*)$/;
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*)$/i;
const TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const;

function lead(prefix: string): string {
  if (!prefix) return '> ';
  return prefix.endsWith(' ') ? prefix : `${prefix} `;
}

function mark(prefix: string, type: (typeof TYPES)[number], body: string): string {
  return `${lead(prefix)}[!${type}]${body ? ` ${body}` : ''}`;
}

/** `> [!NOTE]` → TIP → … → CAUTION → quote without the alert. Fences, setext, indented code stay put. */
export function cycleAlertLine(line: string, nextLine?: string | null): string | null {
  if (FENCE.test(line) || SETEXT.test(line)) return null;
  if (nextLine != null && SETEXT.test(nextLine)) return null;
  if (/^[ \t]{4,}/.test(line) || /^\t/.test(line)) return null;

  const quoted = line.match(QUOTE);
  const prefix = quoted?.[1] ?? '';
  const rest = quoted?.[2] ?? line;
  const alert = rest.match(ALERT);

  if (!alert) {
    return mark(prefix, 'NOTE', rest);
  }

  const current = (alert[1] ?? 'NOTE').toUpperCase();
  const body = (alert[2] ?? '').trim();
  const index = TYPES.indexOf(current as (typeof TYPES)[number]);
  if (index < 0 || index >= TYPES.length - 1) {
    return body ? `${lead(prefix)}${body}` : lead(prefix);
  }
  return mark(prefix, TYPES[index + 1] ?? 'NOTE', body);
}

/** Cycle the GitHub alert mark on the line containing `offset`. */
export function cycleAlertAtOffset(
  content: string,
  offset: number
): { from: number; to: number; text: string } | null {
  const here = lineAtOffset(content, offset);
  if (!here || here.inFence) return null;
  const text = cycleAlertLine(here.line, here.next);
  if (text == null || text === here.line) return null;
  return { from: here.from, to: here.to, text };
}

export const cycleAlertPlugin: PluginManifest = {
  id: 'dripnex-cycle-alert',
  name: 'Cycle Alert',
  version: '1.0.0',
  description: 'Cycle the GitHub alert type on the current line (NOTE through CAUTION, then off)',

  activate(context) {
    const cycle = () => {
      const { from } = context.editor.getSelection();
      const next = cycleAlertAtOffset(context.editor.getContent(), from);
      if (!next) {
        context.log.info('Current line is not an alert candidate');
        return false;
      }
      context.editor.replaceRange(next.from, next.to, next.text);
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'cycle', name: 'Cycle Alert', icon: 'AlertTriangle' },
      cycle
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
