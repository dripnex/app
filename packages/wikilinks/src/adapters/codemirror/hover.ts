import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { parseWikilinkAt } from '../../core/parsing.js';

/**
 * Hover a `[[wikilink]]` in the editor. Fires when the target under the
 * pointer changes; does not follow the cursor inside the same span.
 */
export function wikilinkHoverHandler(
  onHover: (target: string, coords: { x: number; y: number }) => void,
  onLeave: () => void
): Extension {
  let current: string | null = null;
  return EditorView.domEventHandlers({
    mousemove(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) {
        if (current) {
          current = null;
          onLeave();
        }
        return false;
      }
      const line = view.state.doc.lineAt(pos);
      const link = parseWikilinkAt(line.text, pos - line.from);
      const target = link?.target.trim() || '';
      if (!target) {
        if (current) {
          current = null;
          onLeave();
        }
        return false;
      }
      if (current === target) return false;
      current = target;
      onHover(target, { x: event.clientX, y: event.clientY });
      return false;
    },
    mouseout() {
      if (!current) return false;
      current = null;
      onLeave();
      return false;
    },
  });
}
