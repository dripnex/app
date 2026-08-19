import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { parseWikilinkAt } from '../../core/parsing.js';

/**
 * Cmd/Ctrl-click a `[[wikilink]]` in the editor to open it.
 */
export function wikilinkClickHandler(onOpen: (target: string, anchor?: string) => void): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const line = view.state.doc.lineAt(pos);
      const link = parseWikilinkAt(line.text, pos - line.from);
      if (!link) return false;
      event.preventDefault();
      onOpen(link.target, link.anchor);
      return true;
    },
  });
}
