import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { EditorAPI } from '../types';

export interface EditorAPIWithEvents extends EditorAPI {
  /** Fire doc-changed event (called from editor update listener) */
  _notifyDocChanged(content: string): void;
  /** Fire selection-changed event (called from editor update listener) */
  _notifySelectionChanged(sel: { from: number; to: number }): void;
}

/**
 * Create an EditorAPI from an EditorView accessor.
 * The getView function may return null if no editor is mounted.
 */
export function createEditorAPI(getView: () => EditorView | null): EditorAPIWithEvents {
  const docChangedListeners = new Set<(content: string) => void>();
  const selectionChangedListeners = new Set<(sel: { from: number; to: number }) => void>();

  return {
    getContent() {
      const view = getView();
      return view ? view.state.doc.toString() : '';
    },

    getSelection() {
      const view = getView();
      if (!view) return { from: 0, to: 0 };
      const sel = view.state.selection.main;
      return { from: sel.from, to: sel.to };
    },

    replaceRange(from, to, text) {
      const view = getView();
      if (!view) return;
      view.dispatch({
        changes: { from, to, insert: text },
      });
    },

    insertAtCursor(text) {
      const view = getView();
      if (!view) return;
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, insert: text },
        selection: EditorSelection.cursor(pos + text.length),
      });
    },

    setSelection(from, to = from) {
      const view = getView();
      if (!view) return;
      const max = view.state.doc.length;
      const start = Math.max(0, Math.min(from, max));
      const end = Math.max(0, Math.min(to, max));
      view.dispatch({
        selection:
          start === end ? EditorSelection.cursor(start) : EditorSelection.range(start, end),
      });
    },

    getWordCount() {
      const content = this.getContent();
      if (!content.trim()) return 0;
      return content.trim().split(/\s+/).length;
    },

    getCharCount() {
      return this.getContent().length;
    },

    getLineCount() {
      const view = getView();
      return view ? view.state.doc.lines : 0;
    },

    onDocChanged(callback) {
      docChangedListeners.add(callback);
      return () => {
        docChangedListeners.delete(callback);
      };
    },

    onSelectionChanged(callback) {
      selectionChangedListeners.add(callback);
      return () => {
        selectionChangedListeners.delete(callback);
      };
    },

    focus() {
      getView()?.focus();
    },

    _notifyDocChanged(content) {
      for (const cb of docChangedListeners) {
        cb(content);
      }
    },

    _notifySelectionChanged(sel) {
      for (const cb of selectionChangedListeners) {
        cb(sel);
      }
    },
  };
}
