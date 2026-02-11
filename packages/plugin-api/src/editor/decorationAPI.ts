import { StateField, StateEffect, type Extension, RangeSet } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';

/**
 * Plugin-friendly decoration API that wraps CM6 decorations.
 * Each instance manages its own StateField + effects for clean lifecycle.
 */
export interface EditorDecorationAPI {
  /** Highlight a line (1-indexed) with a CSS class. Returns a remove function. */
  addLineHighlight(line: number, className: string): () => void;
  /** Add a widget at a document position. Returns a remove function. */
  addWidget(pos: number, dom: HTMLElement): () => void;
  /** Remove all decorations managed by this API instance. */
  clear(): void;
}

interface DecorationEntry {
  id: number;
  from: number;
  to: number;
  decoration: Decoration;
}

let nextEntryId = 0;

const addDecoEffect = StateEffect.define<DecorationEntry>();
const removeDecoEffect = StateEffect.define<number>();
const clearDecoEffect = StateEffect.define<void>();

/** StateField that tracks plugin decorations */
const pluginDecoField = StateField.define<DecorationEntry[]>({
  create() {
    return [];
  },
  update(entries, tr) {
    let result = entries;
    for (const effect of tr.effects) {
      if (effect.is(addDecoEffect)) {
        result = [...result, effect.value];
      } else if (effect.is(removeDecoEffect)) {
        result = result.filter(e => e.id !== effect.value);
      } else if (effect.is(clearDecoEffect)) {
        result = [];
      }
    }
    // Remap positions on document changes
    if (tr.docChanged && result.length > 0) {
      result = result
        .map(e => ({
          ...e,
          from: tr.changes.mapPos(e.from, 1),
          to: tr.changes.mapPos(e.to, -1),
        }))
        .filter(e => e.from <= e.to);
    }
    return result;
  },
  provide(field) {
    return EditorView.decorations.from(field, entries => {
      const sorted = [...entries].sort((a, b) => a.from - b.from);
      const ranges = sorted.map(e => e.decoration.range(e.from, e.to));
      return RangeSet.of(ranges, true);
    });
  },
});

class DomWidgetType extends WidgetType {
  constructor(private readonly domElement: HTMLElement) {
    super();
  }
  toDOM(): HTMLElement {
    return this.domElement;
  }
}

/**
 * Create an EditorDecorationAPI bound to a getView accessor.
 * Returns the API + the CM6 extension that must be registered via registerExtensions().
 */
export function createDecorationAPI(
  getView: () => EditorView | null,
): { api: EditorDecorationAPI; extension: Extension } {
  const api: EditorDecorationAPI = {
    addLineHighlight(line, className) {
      const view = getView();
      if (!view) return () => {};

      const lineObj = view.state.doc.line(Math.min(line, view.state.doc.lines));
      const id = ++nextEntryId;
      const entry: DecorationEntry = {
        id,
        from: lineObj.from,
        to: lineObj.from, // line decorations use from === to
        decoration: Decoration.line({ class: className }),
      };

      view.dispatch({ effects: addDecoEffect.of(entry) });
      return () => {
        const v = getView();
        if (v) v.dispatch({ effects: removeDecoEffect.of(id) });
      };
    },

    addWidget(pos, dom) {
      const view = getView();
      if (!view) return () => {};

      const id = ++nextEntryId;
      const clampedPos = Math.min(pos, view.state.doc.length);
      const entry: DecorationEntry = {
        id,
        from: clampedPos,
        to: clampedPos,
        decoration: Decoration.widget({ widget: new DomWidgetType(dom), side: 1 }),
      };

      view.dispatch({ effects: addDecoEffect.of(entry) });
      return () => {
        const v = getView();
        if (v) v.dispatch({ effects: removeDecoEffect.of(id) });
      };
    },

    clear() {
      const view = getView();
      if (view) view.dispatch({ effects: clearDecoEffect.of(undefined) });
    },
  };

  return { api, extension: pluginDecoField };
}
