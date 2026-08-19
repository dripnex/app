import type { EditorView } from '@codemirror/view';
import { parseWikilinkAt, type WikilinkRef } from '@dripnex/wikilinks';

export function wikilinkAtOffset(text: string, pos: number): WikilinkRef | null {
  if (pos < 0 || pos > text.length) return null;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  const lineBreak = text.indexOf('\n', pos);
  const lineEnd = lineBreak === -1 ? text.length : lineBreak;
  return parseWikilinkAt(text.slice(lineStart, lineEnd), pos - lineStart);
}

export function followWikilinkAtCursor(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const link = wikilinkAtOffset(view.state.doc.toString(), pos);
  if (!link) return false;
  window.dispatchEvent(
    new CustomEvent('dripnex:follow-wikilink', {
      detail: { target: link.target, anchor: link.anchor },
    })
  );
  return true;
}
