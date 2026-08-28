import { EditorView } from '@codemirror/view';
import type { PluginManifest } from '@dripnex/plugin-api';
import { lineAtOffset, TASK_LINE } from './sourceScan';

export function toggleTaskAtOffset(
  content: string,
  offset: number
): { from: number; to: number; text: string } | null {
  const here = lineAtOffset(content, offset);
  if (!here || here.inFence) return null;
  const match = here.line.match(TASK_LINE);
  if (!match) return null;
  const prefix = match[1] ?? '';
  const mark = match[2] === 'x' || match[2] === 'X' ? ' ' : 'x';
  const from = here.from + prefix.length;
  return { from, to: from + 3, text: `[${mark}]` };
}

/** Click only toggles when the pointer is on `[ ]` / `[x]`, not the rest of the line. */
export function toggleTaskMarkAtOffset(
  content: string,
  offset: number
): { from: number; to: number; text: string } | null {
  const next = toggleTaskAtOffset(content, offset);
  if (!next) return null;
  if (offset < next.from || offset > next.to) return null;
  return next;
}

function taskClickExtension() {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const next = toggleTaskMarkAtOffset(view.state.doc.toString(), pos);
      if (!next) return false;
      event.preventDefault();
      view.dispatch({
        changes: { from: next.from, to: next.to, insert: next.text },
      });
      return true;
    },
  });
}

export const taskTogglePlugin: PluginManifest = {
  id: 'dripnex-task-toggle',
  name: 'Task Toggle',
  version: '1.0.0',
  description: 'Toggle a GFM checkbox in source: click the mark, or Mod+Shift+Enter',

  activate(context) {
    const toggle = () => {
      const { from } = context.editor.getSelection();
      const next = toggleTaskAtOffset(context.editor.getContent(), from);
      if (!next) {
        context.log.info('Cursor is not on a task line');
        return false;
      }
      context.editor.replaceRange(next.from, next.to, next.text);
      return true;
    };

    const unregister = context.registerCommand(
      {
        id: 'toggle',
        name: 'Toggle Task at Cursor',
        icon: 'CheckSquare',
        keybinding: { key: 'Enter', modifiers: ['Mod', 'Shift'] },
      },
      toggle
    );
    const unregisterClick = context.registerExtensions('task-click', [taskClickExtension()]);

    return {
      dispose() {
        unregister();
        unregisterClick();
      },
    };
  },
};
